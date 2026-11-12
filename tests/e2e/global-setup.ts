// P8 — Playwright globalSetup. CJS-safe: spawns tests/e2e/server-main.ts
// under bun (which owns the ESM-importing helpers), waits for its ready file,
// and hands the gateway URL to the config via E2E_BASE_URL.
// The auth secret is NOT handled here: the spawned bun process auto-loads the
// repo .env locally, and CI injects the env var (inherited either way — see
// ADR-0004; helpers/server.ts keeps its own vitest-only fallback).
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const READY_FILE = "/tmp/oeg-e2e-ready.txt";
const URL_FILE = "/tmp/oeg-e2e-url.txt";

let main: ReturnType<typeof spawn> | null = null;

async function waitFor<T>(poll: () => T | null, ms: number, what: string): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const v = poll();
    if (v !== null) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout waiting for ${what}`);
}

export default async function globalSetup(): Promise<string> {
  for (const f of [READY_FILE, URL_FILE]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* best effort */
    }
  }

  const mainPath = path.resolve(__dirname, "server-main.ts");
  main = spawn("bun", [mainPath], {
    cwd: path.resolve(__dirname, "..", ".."), // repo root → bun loads .env here
    env: { ...process.env }, // CI: e2e.yml injects the env var; local: .env
    stdio: ["ignore", "inherit", "inherit"],
    detached: true, // own process group → teardown kills the whole stack
  });
  main.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[e2e] orchestrator exited (code ${code})`);
    }
  });

  const gwUrl = await waitFor<string | null>(() => {
    try {
      return JSON.parse(fs.readFileSync(READY_FILE, "utf8")).gwUrl as string;
    } catch {
      return null;
    }
  }, 420_000, "E2E stack readiness");
  if (!gwUrl) throw new Error("ready file missing gwUrl");
  if (!main.pid) throw new Error("orchestrator died during startup");

  fs.writeFileSync(URL_FILE, gwUrl);
  process.env.E2E_BASE_URL = gwUrl;
  return gwUrl;
}

export async function globalTeardown(): Promise<void> {
  if (main?.pid) {
    try {
      process.kill(-main.pid, "SIGTERM"); // orchestrator tears the stack down
    } catch {
      main.kill("SIGTERM");
    }
    main = null;
  }
  for (const f of [READY_FILE, URL_FILE]) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* best effort */
    }
  }
}
