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
let uploadsDir: string | null = null;

/** Port for the ephemeral server. NEVER 3000 (dev server). 3001 is occupied by a
 * root-owned docker-proxy on the maintainer's machine, so the default is 3002. */
export const TEST_PORT = process.env.TEST_PORT ?? "3002";

export async function startTestServer(): Promise<{ baseUrl: string }> {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");

  // Fresh DB per test run
  testDbPath = `/tmp/oeg-test-${Date.now()}.db`;
  const dbUrl = `file:${testDbPath}`;

  // Attachment uploads (ADR-0012) must not land inside the app copy: this
  // process's Turbopack watcher has no .git dir to root ignore rules at, so a
  // runtime write into the watched tree re-triggers Fast Refresh and remounts
  // the SPA mid-test (P9 flake lesson). Throwaway dir, same isolation model as
  // the throwaway DB above.
  uploadsDir = `/tmp/oeg-test-uploads-${Date.now()}`;

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
  try {
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
  } catch (e) {
    console.error("[helper] db push/seed FAILED:", e);
    throw e;
  }

  // Start an isolated dev server on TEST_PORT (package.json's dev script
  // hardcodes -p 3000, so spawn next directly with an explicit port).
  const baseUrl = `http://localhost:${TEST_PORT}`;
  const nextBin = path.join(appCopyDir, "node_modules", "next", "dist", "bin", "next");
  // Spawn under real Node — never under the vitest runtime. Under bun,
  // process.versions.openssl reports BoringSSL's compat string "1.1.0",
  // which makes Prisma's runtime probe demand a debian-openssl-1.1.x engine
  // that this artifact doesn't ship (issue #4). Real Node (OpenSSL 3) matches
  // the shipped debian-openssl-3.0.x engine on every machine.
  proc = spawn("node", [nextBin, "dev", "-p", TEST_PORT], {
    cwd: appCopyDir,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      UPLOADS_DIR: uploadsDir,
      AUTH_SECRET:
        process.env.AUTH_SECRET || "test-secret-at-least-32-bytes-long-for-vitest-only",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group → group-kill takes next-server children too
  });
  const serverLogPath = path.join(appCopyDir, "server-stderr.log");
  proc.stderr!.pipe(fs.createWriteStream(serverLogPath));
  (proc as ChildProcess & { __serverLog?: string }).__serverLog = serverLogPath;

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
  // dump the tail of the ephemeral server log for CI debugging (issue #4)
  const logPath = (proc as (ChildProcess & { __serverLog?: string }) | null)?.__serverLog;
  if (proc && logPath && fs.existsSync(logPath)) {
    try {
      const tail = fs.readFileSync(logPath, "utf8").slice(-4000);
      console.error("[helper] ===== ephemeral server log tail =====\n" + tail);
    } catch { /* best effort */ }
  }
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
  if (uploadsDir && fs.existsSync(uploadsDir)) {
    try {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
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

// ===== Test factories & utilities (P7) =====

export const DEMO_USERS = {
  founder: { email: "montajebii@montamooz.ir", password: "123456", fullName: "محمدرضا منتجبی" },
  teacher1: { email: "ali.rezaei@montamooz.ir", password: "123456" },
  teacher2: { email: "z.ahmadi@montamooz.ir", password: "123456" },
  teacher3: { email: "s.mohammadi@montamooz.ir", password: "123456" },
  teacher4: { email: "m.karimi@montamooz.ir", password: "123456" },
  teacher5: { email: "f.hosseini@montamooz.ir", password: "123456" },
  student: { email: "hossein@montamooz.ir", password: "123456" },
} as const;

/** Unique synthetic client IP per call — P10: auth endpoints are rate-limited
 * per IP, so the helpers must not share one "unknown" bucket. */
function randomXff(): Record<string, string> {
  return {
    "X-Forwarded-For": `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  };
}

/** Login as an existing (demo) user → "ma_session=..." cookie. */
export async function loginAs(baseUrl: string, email: string, password = "123456"): Promise<string> {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...randomXff() },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error(`No session cookie for ${email}`);
  return setCookie.split(";")[0];
}

/** Register a fresh user → cookie + public user. Unique email by default. */
export async function registerUser(
  baseUrl: string,
  overrides: { email?: string; password?: string; fullName?: string; role?: string } = {}
): Promise<{ cookie: string; user: { id: string; fullName: string; role: string } }> {
  const email =
    overrides.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@montamooz.ir`;
  const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...randomXff() },
    body: JSON.stringify({
      email,
      password: overrides.password ?? "test-password-1234",
      fullName: overrides.fullName ?? "کاربر تست",
      role: overrides.role ?? "معلم",
    }),
  });
  if (res.status !== 201) throw new Error(`Register failed: ${res.status} ${await res.text()}`);
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
  const body = await res.json();
  return { cookie, user: body.user };
}

/** Small JSON API helper with cookie support.
 *
 * P10: every call carries a unique X-Forwarded-For unless the caller sets one —
 * auth endpoints are rate-limited per IP now (register 3/h!), and a whole
 * integration run from one implicit "unknown" IP would trip its own limits.
 * Rate-limit tests pass a FIXED header to fill a shared bucket deliberately. */
export async function api<T = unknown>(
  baseUrl: string,
  path: string,
  init: RequestInit & { cookie?: string; json?: unknown } = {}
): Promise<{ status: number; data: T; headers: Headers }> {
  const { cookie, json, ...rest } = init;
  const given = (init.headers as Record<string, string>) ?? {};
  const hasXff = Object.keys(given).some((k) => k.toLowerCase() === "x-forwarded-for");
  const headers: Record<string, string> = {
    ...given,
    ...(!hasXff
      ? { "X-Forwarded-For": `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` }
      : {}),
    ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };
  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : init.body,
  });
  const data = (res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : await res.text()) as T;
  return { status: res.status, data, headers: res.headers };
}

const MIN_PAMPHLET_CONTENT = "# عنوان\n\nاین محتوا برای تست است و بیش از سی نویسه دارد.\n";

/** Create a pamphlet under the given session → its id. */
export async function createPamphlet(
  baseUrl: string,
  cookie: string,
  overrides: Partial<{
    title: string;
    description: string;
    grade: string;
    subject: string;
    chapter: string;
    teachingMethod: string;
    difficulty: string;
    content: string;
  }> = {}
): Promise<string> {
  const res = await api<{ id: string }>(baseUrl, "/api/v1/pamphlets", {
    method: "POST",
    cookie,
    json: {
      title: overrides.title ?? `جزوهٔ تست ${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: overrides.description,
      grade: overrides.grade ?? "دهم",
      subject: overrides.subject ?? "ریاضی",
      chapter: overrides.chapter,
      teachingMethod: overrides.teachingMethod ?? "مفهومی",
      difficulty: overrides.difficulty ?? "متوسط",
      content: overrides.content ?? MIN_PAMPHLET_CONTENT,
    },
  });
  if (res.status !== 201) {
    throw new Error(`createPamphlet: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.id;
}

/** Create a batch of teaching slots under the given session → the created slot ids (in order). */
export async function createSlots(
  baseUrl: string,
  cookie: string,
  slots: Array<{ startAt?: string; durationMinutes?: number; price?: number }> = [{}]
): Promise<string[]> {
  const startAts: string[] = [];
  const list = slots.map((s) => {
    const startAt = s.startAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    startAts.push(startAt);
    return { startAt, durationMinutes: s.durationMinutes, price: s.price ?? 100000 };
  });
  const res = await api<{ created: number }>(baseUrl, "/api/v1/slots", {
    method: "POST",
    cookie,
    json: { slots: list },
  });
  if (res.status !== 201) throw new Error(`createSlots: ${res.status} ${JSON.stringify(res.data)}`);

  const mine = await api<{ items: Array<{ id: string; startAt: string }> }>(
    baseUrl,
    "/api/v1/slots/mine",
    { cookie }
  );
  const ids: string[] = [];
  for (const startAt of startAts) {
    const hit = mine.data.items
      .filter((s) => s.startAt === startAt)
      .sort((a, b) => (a.id < b.id ? 1 : -1))[0];
    if (!hit) throw new Error(`createSlots: slot at ${startAt} not found in /slots/mine`);
    ids.push(hit.id);
  }
  return ids;
}

/** Ensure the wallet behind `cookie` holds ≥ `amount`; returns the new balance. */
export async function ensureWalletBalance(
  baseUrl: string,
  cookie: string,
  amount = 500000
): Promise<number> {
  const w = await api<{ balance: number }>(baseUrl, "/api/v1/wallet", { cookie });
  if (w.data.balance >= amount) return w.data.balance;
  const need = Math.ceil((amount - w.data.balance) / 1000) * 1000;
  const dep = await api<{ authority: string }>(baseUrl, "/api/v1/wallet/deposit", {
    method: "POST",
    cookie,
    json: { amount: need },
  });
  if (dep.status !== 201) throw new Error(`deposit: ${dep.status} ${JSON.stringify(dep.data)}`);
  const ver = await api<{ balance: number }>(baseUrl, "/api/v1/wallet/deposit/verify", {
    method: "POST",
    cookie,
    json: { authority: dep.data.authority, result: "success" },
  });
  if (ver.status !== 200) throw new Error(`verify: ${ver.status} ${JSON.stringify(ver.data)}`);
  return ver.data.balance;
}

const VALID_LESSON = {
  title: "درس تست",
  videoUrl: "https://example.com/lesson.mp4",
  isFreePreview: false,
};

/** Create a course (PUBLISHED by default) → its id + lesson ids (in order). */
export async function createCourse(
  baseUrl: string,
  cookie: string,
  overrides: Partial<{
    title: string;
    description: string;
    grade: string;
    subject: string;
    price: number;
    status: string;
    lessonCount: number;
  }> = {}
): Promise<{ id: string; lessonIds: string[] }> {
  const lessonCount = overrides.lessonCount ?? 2;
  const res = await api<{ id: string }>(baseUrl, "/api/v1/courses", {

      method: "POST",
      cookie,
      json: {
        title: overrides.title ?? `دورهٔ تست ${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: overrides.description ?? "توضیحات دورهٔ تست",
        grade: overrides.grade ?? "دهم",
        subject: overrides.subject ?? "ریاضی",
        price: overrides.price ?? 100000,
        status: overrides.status ?? "PUBLISHED",
        lessons: Array.from({ length: lessonCount }, (_, i) => ({
          ...VALID_LESSON,
          title: `${VALID_LESSON.title} ${i + 1}`,
        })),
      },
    }
  );
  if (res.status !== 201) throw new Error(`createCourse: ${res.status} ${JSON.stringify(res.data)}`);
  const detail = await api<{ lessons: Array<{ id: string }> }>(
    baseUrl,
    `/api/v1/courses/${res.data.id}`,
    { cookie }
  );
  if (detail.status !== 200) throw new Error(`createCourse detail: ${detail.status}`);
  return { id: res.data.id, lessonIds: detail.data.lessons.map((l) => l.id) };
}
