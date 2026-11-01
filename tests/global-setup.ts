// P7 — one ephemeral server for the whole test run (vitest globalSetup).
// The helpers' spawn logic is untouched; this only manages the lifecycle.
// vitest runs globalSetup in its own process, so the baseUrl is handed to
// test workers through a file (env vars do not cross that boundary).
import { startTestServer, stopTestServer } from "./helpers/server";
import fs from "node:fs";

const URL_FILE = "/tmp/oeg-test-url.txt";

export async function setup() {
  // globalSetup runs outside the vitest worker, so `test.env` from the config
  // does NOT apply here — seed.ts imports src/lib/server/auth.ts which throws
  // without a secret (ADR-0004). Provide it before anything spawns.
  process.env.AUTH_SECRET =
    process.env.AUTH_SECRET || "test-secret-at-least-32-bytes-long-for-vitest-only";
  const s = await startTestServer();
  fs.writeFileSync(URL_FILE, s.baseUrl);
}

export async function teardown() {
  try {
    fs.unlinkSync(URL_FILE);
  } catch {
    /* best effort */
  }
  await stopTestServer();
}
