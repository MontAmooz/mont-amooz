// OpenEdu Git — classroom socket.io service (virtual classroom: chat + whiteboard)
// Independent bun mini-service. Port 3003. io path MUST stay "/" (Caddy gateway
// forwards /?XTransformPort=3003 here). Plain HTTP /health on the same port.
//
// Protocol (per contract):
//   client connects: io("/?XTransformPort=3003", { auth: { ticket } })
//   server → socket:  room:welcome { snapshot, members, me }
//   server → others:  room:member-joined { member } / room:member-left { uid }
//   client → server:  chat:relay { message }      → others: chat:new { message }
//                     board:stroke { stroke }     → others: board:stroke { stroke }
//                     board:clear {}              → others: board:cleared {}
//                     board:undo {}               → others: board:undo { uid }
import { createServer } from "node:http";
import crypto from "node:crypto";
import { Server, type Socket } from "socket.io";

// Port: 3003 by default; overridable via PORT env so E2E can run an isolated
// instance alongside the dev service (the gateway only rewrites the query, so
// callers choose the port via their own reverse proxy).
const PORT = parseInt(process.env.PORT || "3003", 10);
const SECRET = (() => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_SECRET is required (>=16 chars). Generate via: openssl rand -hex 32. " +
      "See .env.example for setup."
    );
  }
  return s;
})();
const SNAPSHOT_CAP = 800; // max strokes kept per room
const MAX_POINTS = 2000; // max points per stroke

// ---------- types ----------

interface Member {
  uid: string;
  name: string;
  role: "teacher" | "student";
  online: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  uid: string;
  color: string;
  width: number;
  tool: "pen" | "eraser";
  points: Point[];
}

interface RoomState {
  members: Map<string, Member>; // uid → member (online)
  socketCounts: Map<string, number>; // uid → open socket count (multi-tab dedupe)
  snapshot: Stroke[];
}

interface TicketPayload {
  uid: string;
  sid: string;
  role: "teacher" | "student";
  name: string;
  exp: number;
}

// ---------- ticket verification (local reimplementation — NO imports from src/) ----------

function verifyTicket(ticket: unknown): TicketPayload | null {
  try {
    if (typeof ticket !== "string" || !ticket.includes(".")) return null;
    const [payload, sig] = ticket.split(".");
    if (!payload || !sig) return null;
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof data.uid !== "string" || typeof data.sid !== "string") return null;
    if (data.role !== "teacher" && data.role !== "student") return null;
    if (typeof data.name !== "string") return null;
    if (typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return data as TicketPayload;
  } catch {
    return null;
  }
}

// ---------- payload validation ----------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Validate a chat message payload; sender is overridden with the ticket identity. */
function sanitizeChatMessage(raw: unknown, uid: string, name: string) {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.id !== "string" || raw.id.length < 1 || raw.id.length > 64) return null;
  if (typeof raw.body !== "string" || raw.body.length < 1 || raw.body.length > 2000) return null;
  if (typeof raw.createdAt !== "string" || raw.createdAt.length > 64) return null;
  return {
    id: raw.id,
    body: raw.body,
    createdAt: raw.createdAt,
    sender: { id: uid, fullName: name }, // never trust the client's sender
  };
}

/** Validate a whiteboard stroke; uid is overridden with the ticket identity. */
function sanitizeStroke(raw: unknown, uid: string): Stroke | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.color !== "string" || raw.color.length > 32) return null;
  if (typeof raw.width !== "number" || !Number.isFinite(raw.width) || raw.width <= 0 || raw.width > 100) {
    return null;
  }
  if (raw.tool !== "pen" && raw.tool !== "eraser") return null;
  if (!Array.isArray(raw.points) || raw.points.length < 1 || raw.points.length > MAX_POINTS) {
    return null;
  }
  const points: Point[] = [];
  for (const p of raw.points) {
    if (!isPlainObject(p)) return null;
    if (typeof p.x !== "number" || typeof p.y !== "number") return null;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    // normalized 0..1 — tolerate a tiny overshoot, clamp it
    points.push({ x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) });
  }
  return { uid, color: raw.color, width: raw.width, tool: raw.tool, points };
}

// ---------- room registry ----------

const rooms = new Map<string, RoomState>();

function getRoom(room: string): RoomState {
  let state = rooms.get(room);
  if (!state) {
    state = { members: new Map(), socketCounts: new Map(), snapshot: [] };
    rooms.set(room, state);
  }
  return state;
}

// ---------- HTTP server (health endpoint; socket.io handles engine.io traffic) ----------

function httpHandler(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  try {
    if (req.url && req.url.split("?")[0] === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "not found" }));
  } catch {
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
}

const httpServer = createServer();

const io = new Server(httpServer, {
  // DO NOT change the path — the Caddy gateway forwards /?XTransformPort=3003 here
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1 MB — strokes with many points stay well under this
});

// engine.io with path "/" claims EVERY url prefix, which would swallow /health.
// Re-wrap: route /health (and other non-socket paths) to the plain HTTP handler,
// and let socket.io's own listener handle engine.io traffic (always carries EIO=).
const ioRequestListener = httpServer.listeners("request")[0] as (
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse
) => void;
httpServer.removeAllListeners("request");
httpServer.on("request", (req, res) => {
  try {
    const url = req.url ?? "/";
    if (url.split("?")[0] === "/health" || !url.includes("EIO=")) {
      httpHandler(req, res);
      return;
    }
    ioRequestListener.call(httpServer, req, res);
  } catch (err) {
    console.error("[classroom] http dispatch error:", err);
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
});

io.on("connection", (socket: Socket) => {
  let room = "";
  let state: RoomState | null = null;
  let uid = "";
  let sid = "";
  let role: "teacher" | "student" = "student";
  let name = "";

  try {
    const payload = verifyTicket(socket.handshake.auth?.ticket);
    if (!payload) {
      socket.disconnect(true);
      return;
    }
    uid = payload.uid;
    sid = payload.sid;
    role = payload.role;
    name = payload.name;
    socket.data = { uid, sid, role, name };

    room = `session:${sid}`;
    state = getRoom(room);
    socket.join(room);

    const count = (state.socketCounts.get(uid) ?? 0) + 1;
    state.socketCounts.set(uid, count);

    const me: Member = { uid, name, role, online: true };
    const isNewMember = !state.members.has(uid);
    if (isNewMember) {
      state.members.set(uid, me);
      socket.to(room).emit("room:member-joined", { member: me });
    }

    socket.emit("room:welcome", {
      snapshot: state.snapshot,
      members: Array.from(state.members.values()),
      me,
    });
  } catch (err) {
    console.error("[classroom] connection error:", err);
    try {
      socket.disconnect(true);
    } catch {
      /* ignore */
    }
    return;
  }

  // ----- chat relay (message is persisted via REST by the sender) -----
  socket.on("chat:relay", (data: unknown) => {
    try {
      if (!state) return;
      const message = sanitizeChatMessage(
        isPlainObject(data) ? data.message : null,
        uid,
        name
      );
      if (!message) return;
      socket.to(room).emit("chat:new", { message });
    } catch (err) {
      console.error("[classroom] chat:relay error:", err);
    }
  });

  // ----- whiteboard: stroke -----
  socket.on("board:stroke", (data: unknown) => {
    try {
      if (!state) return;
      const stroke = sanitizeStroke(isPlainObject(data) ? data.stroke : null, uid);
      if (!stroke) return;
      state.snapshot.push(stroke);
      if (state.snapshot.length > SNAPSHOT_CAP) {
        state.snapshot.splice(0, state.snapshot.length - SNAPSHOT_CAP);
      }
      socket.to(room).emit("board:stroke", { stroke });
    } catch (err) {
      console.error("[classroom] board:stroke error:", err);
    }
  });

  // ----- whiteboard: clear -----
  socket.on("board:clear", () => {
    try {
      if (!state) return;
      state.snapshot = [];
      socket.to(room).emit("board:cleared", {});
    } catch (err) {
      console.error("[classroom] board:clear error:", err);
    }
  });

  // ----- whiteboard: undo my last stroke -----
  socket.on("board:undo", () => {
    try {
      if (!state) return;
      for (let i = state.snapshot.length - 1; i >= 0; i--) {
        if (state.snapshot[i].uid === uid) {
          state.snapshot.splice(i, 1);
          break;
        }
      }
      socket.to(room).emit("board:undo", { uid });
    } catch (err) {
      console.error("[classroom] board:undo error:", err);
    }
  });

  socket.on("error", (err: unknown) => {
    console.error("[classroom] socket error:", err);
  });

  // ----- disconnect: dedupe by uid, leave only when the last tab closes -----
  socket.on("disconnect", () => {
    try {
      if (!state) return;
      const count = (state.socketCounts.get(uid) ?? 1) - 1;
      if (count <= 0) {
        state.socketCounts.delete(uid);
        state.members.delete(uid);
        socket.to(room).emit("room:member-left", { uid });
      } else {
        state.socketCounts.set(uid, count);
      }
    } catch (err) {
      console.error("[classroom] disconnect error:", err);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[classroom] OpenEdu Git classroom service listening on :${PORT}`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});
