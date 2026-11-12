// P8 — E2E infrastructure: one ephemeral app + one real classroom-service +
// a tiny Caddy-equivalent gateway. The app copy and dev lock are owned by
// tests/helpers/server.ts (5 invariants preserved — read its header comments
// before touching anything here). This file only adds the two pieces vitest
// never needed: the socket service and the gateway.
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import net from "node:net";

const APP_PORT = 3002; // tests/helpers/server.ts TEST_PORT (never 3000/3001)
const CLASSROOM_PORT = 3005; // E2E classroom (3003 = maintainer's dev service)
export const GATEWAY_PORT = 3100;

// The client contract (use-classroom.ts) hardcodes XTransformPort=3003 —
// that value names the PRODUCTION classroom port, not ours. The gateway maps
// the contract value (3003) to this run's classroom (CLASSROOM_PORT); any
// other transform target falls through to the app.
function targetPort(reqUrl: string): number {
  const url = new URL(reqUrl, "http://localhost");
  return url.searchParams.get("XTransformPort") === "3003" ? CLASSROOM_PORT : APP_PORT;
}

// Stateful chunked-transfer decoder: feed raw body bytes; decoded bytes come
// back via onPiece; onDone fires at the terminal chunk. (Upstream keep-alive
// means end/close never fire — framing must drive response completion.)
function createChunkDecoder(onPiece: (b: Buffer) => void, onDone: () => void) {
  let pending = Buffer.alloc(0);
  let remaining = -1; // -1 = expect size line, -2 = expect chunk CRLF, >0 = body bytes left
  return function decode(chunk: Buffer): void {
    pending = Buffer.concat([pending, chunk]);
    for (;;) {
      if (remaining > 0) {
        if (pending.length === 0) return;
        const take = Math.min(remaining, pending.length);
        onPiece(pending.slice(0, take));
        pending = pending.slice(take);
        remaining -= take;
        if (remaining === 0) remaining = -2;
        continue;
      }
      const idx = pending.indexOf("\r\n");
      if (idx === -1) return;
      if (remaining === -2) {
        pending = pending.slice(idx + 2); // consume the chunk-terminating CRLF
        remaining = -1;
        continue;
      }
      const sizeText = pending.slice(0, idx).toString("utf8").split(";")[0].trim();
      const size = parseInt(sizeText, 16);
      if (Number.isNaN(size)) return; // malformed — stop decoding
      pending = pending.slice(idx + 2);
      if (size === 0) {
        onDone(); // terminal chunk; trailers dropped
        return;
      }
      remaining = size;
    }
  };
}

function pipe(req: IncomingMessage, res: ServerResponse, port: number) {
  const proxied = { ...req.headers, host: `localhost:${port}` };
  const upstream = net.connect(port, "127.0.0.1", () => {
    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries(proxied).map(([k, v]) => `${k}: ${v}`).join("\r\n") +
        "\r\n\r\n"
    );
    // end:false — for a GET the request stream ends immediately; piping with
    // the default end:true would FIN the upstream socket before it answers
    // (observed: both upstreams closed with empty 200s).
    req.pipe(upstream, { end: false });
  });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (!res.writableEnded) res.end();
    upstream.destroy(); // one short-lived upstream per request
  };

  // Parse the upstream status line + headers, then forward the body and END
  // the response explicitly at its framing boundary (content-length bytes or
  // the chunked terminal chunk).
  let buffer = Buffer.alloc(0);
  let headerDone = false;
  let contentLength: number | null = null;
  let received = 0;
  let bodyHandler: ((chunk: Buffer) => void) | null = null;

  upstream.on("data", (rawChunk) => {
    const chunk = Buffer.from(rawChunk as unknown as Uint8Array);
    if (finished) return;
    if (headerDone) {
      bodyHandler!(chunk);
      return;
    }
    buffer = Buffer.concat([buffer, chunk]);
    const idx = buffer.indexOf("\r\n\r\n");
    if (idx === -1) return;
    const lines = buffer.slice(0, idx).toString("utf8").split("\r\n");
    const status = Number(lines[0].split(" ")[1]) || 502;
    const headers: Record<string, string> = {};
    let isChunked = false;
    for (const line of lines.slice(1)) {
      const c = line.indexOf(":");
      if (c === -1) continue;
      const k = line.slice(0, c).trim().toLowerCase();
      const v = line.slice(c + 1).trim();
      if (k === "transfer-encoding") {
        if (v.includes("chunked")) isChunked = true;
        continue; // node re-frames the body itself
      }
      if (k === "content-length") {
        contentLength = Number(v);
        continue;
      }
      if (k === "connection" || k === "keep-alive") continue;
      headers[k] = v;
    }
    res.writeHead(status, headers);
    headerDone = true;
    const rest = buffer.slice(idx + 4);
    buffer = Buffer.alloc(0);
    if (isChunked) {
      bodyHandler = createChunkDecoder(
        (piece) => {
          if (!finished && piece.length) res.write(piece);
        },
        finish
      );
    } else {
      bodyHandler = (piece) => {
        if (finished || !piece.length) return;
        res.write(piece);
        received += piece.length;
        if (contentLength !== null && received >= contentLength) finish();
      };
    }
    if (rest.length) bodyHandler(rest);
  });

  upstream.on("end", () => finish());
  upstream.on("close", () => {
    if (!res.writableEnded) res.end();
  });
  upstream.on("error", () => {
    if (finished) return;
    finished = true;
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
    }
    res.end(JSON.stringify({ ok: false, error: "upstream unavailable" }));
  });
  req.on("aborted", () => upstream.destroy());
  res.on("close", () => upstream.destroy());
}

let gateway: Server | null = null;

export async function startGateway(): Promise<string> {
  gateway = createServer((req, res) => pipe(req, res, targetPort(req.url ?? "/")));
  // WebSocket upgrades must be tunneled byte-for-byte — socket.io speaks
  // engine.io and Next dev streams HMR over the upgraded socket. The header
  // block must end with EXACTLY one empty line (a stray extra CRLF desyncs
  // frame parsing — observed as WS_ERR_INVALID_OPCODE on the app).
  gateway.on("upgrade", (req, clientSocket, head) => {
    const port = targetPort(req.url ?? "/");
    const upstream = net.connect(port, "127.0.0.1", () => {
      const headerBlock =
        `${req.method} ${req.url} HTTP/1.1\r\n` +
        Object.entries({ ...req.headers, host: `localhost:${port}` })
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n";
      upstream.write(headerBlock);
      if (head.length) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => upstream.destroy());
  });
  await new Promise<void>((resolve, reject) => {
    gateway!.once("error", reject);
    gateway!.listen(GATEWAY_PORT, () => resolve());
  });
  return `http://localhost:${GATEWAY_PORT}`;
}

export async function stopGateway(): Promise<void> {
  if (gateway) {
    try {
      gateway.closeAllConnections();
      await new Promise<void>((resolve) => gateway!.close(() => resolve()));
    } catch {
      /* best effort */
    }
    gateway = null;
  }
}

// Spawn the REAL classroom-service (bun) on CLASSROOM_PORT. It inherits the
// orchestrator's whole environment — server-main.ts has already put the app's
// auth secret there, and tickets are HMAC-signed by the app and verified by
// the service, so the inherited value is exactly the one that must match.
let classroomProc: ReturnType<typeof import("node:child_process").spawn> | null = null;

export async function startClassroom(): Promise<void> {
  const { spawn } = await import("node:child_process");
  const path = await import("node:path");
  const fs = await import("node:fs");

  const serviceDir = path.resolve(import.meta.dirname, "..", "..", "mini-services", "classroom-service");
  // classroom-service has its own bun.lock/node_modules (P2 decision). Probe
  // for the real dependency (socket.io) instead of trusting the dir; install
  // via a spawned bun (NO execSync — spawning /bin/sh fails under bun here).
  const depsReady = fs.existsSync(path.join(serviceDir, "node_modules", "socket.io", "package.json"));
  if (!depsReady) {
    await new Promise<void>((resolve, reject) => {
      const install = spawn("bun", ["install", "--frozen-lockfile"], {
        cwd: serviceDir,
        stdio: ["ignore", "inherit", "inherit"],
      });
      install.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`bun install exited ${code}`))));
      install.on("error", reject);
    });
  }

  classroomProc = spawn("bun", ["index.ts"], {
    cwd: serviceDir,
    env: { ...process.env, PORT: String(CLASSROOM_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true, // own process group → group-kill reaps children
  });
  let stderrTail = "";
  classroomProc.stderr?.on("data", (c: Buffer) => {
    stderrTail = (stderrTail + c.toString()).slice(-2000);
  });
  classroomProc.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[e2e] classroom exited early (code ${code})\n${stderrTail}`);
    }
  });

  // Poll the service's own /health directly (the gateway is started separately;
  // gateway.spec.ts proves the rewrite path end-to-end).
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${CLASSROOM_PORT}/health`);
      if (res.ok) {
        const body = (await res.json()) as { ok?: boolean };
        if (body.ok) return;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`classroom-service did not become healthy on :${CLASSROOM_PORT}\n${stderrTail}`);
}

export async function stopClassroom(): Promise<void> {
  if (classroomProc?.pid) {
    try {
      process.kill(-classroomProc.pid, "SIGKILL");
    } catch {
      classroomProc.kill("SIGKILL");
    }
    classroomProc = null;
  }
}

// Warm the app copy's first compile with ONE sequential request before any
// browser touches it. A fresh /tmp copy compiles the shell on first hit; under
// Chromium's parallel subresource storm that first compile can hit the
// next/font/google Turbopack race ("queries have exactly one entry") — warmed
// sequentially here, the race is gone and later hits are cache-served.
export async function warmApp(baseUrl: string): Promise<void> {
  // 45s per warm-up: a fresh /tmp copy compiles the shell + fonts in ~5-15s;
  // the font race either resolves on a retry or leaves the copy permanently
  // broken, in which case we want to fail fast (up() rebuilds nothing).
  const deadline = Date.now() + 45_000;
  let sawError = false;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl + "/");
      const html = await res.text();
      if (res.ok && html.includes('lang="fa"')) return; // shell compiled
      if (!res.ok) sawError = true;
    } catch {
      sawError = true;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error(sawError
    ? "app copy did not compile a healthy shell (font/turbopack race?)"
    : "app copy warm-up timeout");
}
