// Test helper — ephemeral Next dev server + throwaway SQLite DB for integration tests.
// Single-file usage: only tests/integration/auth.test.ts starts the server (P4 scope).
//
// WHY A PROJECT COPY: Next.js 16 dev mode takes an exclusive flock at
// `<appDir>/.next/dev/lock`, so a second `next dev` cannot run alongside the
// maintainer's dev server in the same directory (it exits with
// "Unable to acquire lock"). The lock path is keyed to the app dir, so we rsync
// the app surface into /tmp and run the ephemeral server from there — its own
// .next directory means its own lock. node_modules is symlinked (no reinstall).
import { spawn, execSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

let proc: ChildProcess | null = null;
let testDbPath: string | null = null;
let appCopyDir: string | null = null;

/** Port for the ephemeral server. NEVER 3000 (dev server). 3001 is occupied by a
 * root-owned docker-proxy on the maintainer's machine, so the default is 3002. */
export const TEST_PORT = process.env.TEST_PORT ?? "3002";

export async function startTestServer(): Promise<{ baseUrl: string }> {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");

  // Fresh DB per test run
  testDbPath = `/tmp/oeg-test-${Date.now()}.db`;
  const dbUrl = `file:${testDbPath}`;

  // Isolated app copy (own .next → own dev lock)
  appCopyDir = `/tmp/oeg-test-app-${Date.now()}`;
  execSync(
    `rsync -a ` +
      `--exclude=.next --exclude=node_modules --exclude=.git --exclude=.env* ` +
      `--exclude=db --exclude=coverage --exclude=tests --exclude=docs ` +
      `--exclude=.zscripts --exclude=.zwork --exclude='*.log' ` +
      `--exclude='.remember' --exclude='.freebuff' ` +
      `${repoRoot}/ ${appCopyDir}/`,
    { stdio: "pipe" }
  );
  // node_modules via HARDLINKS (zero-cost): Turbopack rejects a symlinked
  // node_modules that points outside the project root. We spawn next via its
  // direct bin path (NOT `bunx next`) — bunx re-manages the package tree on
  // startup and, through the hardlinks, that rewrite propagates into the
  // repo's node_modules (P4 lesson: it corrupted node_modules/next in place).
  execSync(
    `rsync -a --link-dest=${repoRoot}/node_modules ${repoRoot}/node_modules/ ${appCopyDir}/node_modules/`,
    { stdio: "pipe" }
  );

  // Push schema + seed against the throwaway DB (seed.ts is the verified fixture)
  execSync("bunx prisma db push --skip-generate --accept-data-loss", {
    cwd: appCopyDir,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });
  execSync("bun prisma/seed.ts", {
    cwd: appCopyDir,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });

  // Start an isolated dev server on TEST_PORT (package.json's dev script
  // hardcodes -p 3000, so spawn next directly with an explicit port).
  const baseUrl = `http://localhost:${TEST_PORT}`;
  const nextBin = path.join(appCopyDir, "node_modules", "next", "dist", "bin", "next");
  proc = spawn(process.execPath, [nextBin, "dev", "-p", TEST_PORT], {
    cwd: appCopyDir,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      AUTH_SECRET:
        process.env.AUTH_SECRET || "test-secret-at-least-32-bytes-long-for-vitest-only",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group → group-kill takes next-server children too
  });

  // Wait for "Ready" in stdout (up to 60s); surface stderr on early exit
  await new Promise<void>((resolve, reject) => {
    let stderrTail = "";
    const timeout = setTimeout(() => reject(new Error("Server startup timeout")), 60_000);
    proc!.stdout!.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("Ready")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    proc!.stderr!.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-2000);
    });
    proc!.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`dev server exited early (code ${code})\n${stderrTail}`));
    });
  });

  return { baseUrl };
}

export async function stopTestServer(): Promise<void> {
  if (proc) {
    try {
      // kill the whole process group (next dev spawns next-server children)
      process.kill(-proc.pid!, "SIGKILL");
    } catch {
      proc.kill("SIGKILL");
    }
    proc = null;
  }
  if (testDbPath && fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch {
      /* best effort */
    }
    testDbPath = null;
  }
  if (appCopyDir && fs.existsSync(appCopyDir)) {
    try {
      fs.rmSync(appCopyDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    appCopyDir = null;
  }
}
