// P8 — server orchestrator. Runs under BUN (native ESM — import.meta works),
// owns the lifecycle of the four-piece stack and dies on SIGTERM:
//   1. ephemeral app copy + next dev :3002   (tests/helpers/server.ts, untouched)
//   2. gateway :3100                          (./infra, Caddy contract)
//   3. real classroom-service :3005           (./infra)
// Playwright's global-setup (CJS) spawns this process and teardown signals it.
// Rationale: @playwright/test transpiles *its* files as CJS (no "type":"module"
// in package.json), and helpers/server.ts uses import.meta — so the helper must
// not be imported from Playwright's runtime, only from this bun process.
//
// Secrets: no secret material lives in this file. The auth secret must arrive
// via the environment (locally bun auto-loads the repo .env; CI injects a
// per-run random value) — tickets are HMAC-signed by the app copy and verified
// by the classroom service, so the inherited value is exactly what must match.
import { startTestServer, stopTestServer } from "../helpers/server";
import { startGateway, stopGateway, startClassroom, stopClassroom, warmApp } from "./infra";
import fs from "node:fs";

const READY_FILE = "/tmp/oeg-e2e-ready.txt";

async function up() {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
    throw new Error(
      "AUTH_SECRET missing/short in environment — global-setup must provide it (see ADR-0004)"
    );
  }
  // P7 lesson: a Turbopack font-fetch race POISONS the app copy's build cache
  // permanently (next/font module-not-found on every subsequent request), so
  // retrying against the same .next never recovers. Each attempt gets a fresh
  // copy (startTestServer rsyncs + warmApp compiles); three copies ≈ 3 chances
  // against the race, still bounded by global-setup's waitFor.
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { baseUrl } = await startTestServer();
      if (!baseUrl.endsWith(":3002")) {
        throw new Error(`E2E expects the app on 3002, got ${baseUrl}`);
      }
      // Warm the fresh copy sequentially before ANY browser traffic: Turbopack's
      // next/font import map is built on first compile and Chromium's parallel
      // subresource storm can hit it mid-build ("queries have exactly one entry").
      await warmApp(baseUrl);

      const gwUrl = await startGateway();
      // classroom inherits this process's env (incl. the validated env secret)
      await startClassroom();
      // warm again through the gateway so the first browser hit is already cached
      await warmApp(gwUrl);

      fs.writeFileSync(READY_FILE, JSON.stringify({ gwUrl, appUrl: baseUrl }));
      console.log(`[e2e-main] ready (attempt ${attempt}) — gateway ${gwUrl} → app ${baseUrl}`);
      return;
    } catch (e) {
      lastErr = e;
      console.error(`[e2e-main] attempt ${attempt}/3 failed:`, e instanceof Error ? e.message : e);
      // tear the stack down so the next attempt starts from a clean copy
      try {
        await stopGateway();
        await stopClassroom();
        await stopTestServer(); // deletes the (possibly poisoned) app copy
      } catch (teardownErr) {
        console.error("[e2e-main] attempt teardown error:", teardownErr);
      }
    }
  }
  throw lastErr;
}

async function down() {
  try {
    fs.unlinkSync(READY_FILE);
  } catch {
    /* best effort */
  }
  try {
    await stopClassroom();
    await stopGateway();
    await stopTestServer();
  } catch (e) {
    console.error("[e2e-main] teardown error:", e);
  }
  process.exit(0);
}

process.on("SIGTERM", () => void down());
process.on("SIGINT", () => void down());

up().catch(async (e) => {
  console.error("[e2e-main] startup failed:", e);
  await down();
  process.exit(1);
});
