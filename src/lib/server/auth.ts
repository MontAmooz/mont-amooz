// مُنت‌آموز — server-side auth (scrypt hashing + HMAC-signed session token)
// Only import from API routes (server context).
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/constants";

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

// ---------- password hashing (scrypt) ----------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// ---------- session token (HMAC-SHA256, JWT-like) ----------

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = b64url(
    JSON.stringify({ uid: userId, iat: Date.now(), exp: Date.now() + SESSION_MAX_AGE * 1000 })
  );
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (Date.now() > data.exp) return null;
    return data.uid;
  } catch {
    return null;
  }
}

// ---------- cookie helpers ----------

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // sandbox runs behind http proxy
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

/** Returns the logged-in user row, or null. */
export async function getCurrentUser() {
  const store = await cookies();
  const uid = parseSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  return db.user.findUnique({
    where: { id: uid },
    select: {
      id: true, email: true, fullName: true, title: true, bio: true,
      expertise: true, role: true, createdAt: true, updatedAt: true,
    },
  });
}

/** Public user shape (no email). */
export function toPublicUser(u: {
  id: string; fullName: string; title?: string | null; bio?: string | null;
  expertise?: string | null; role: string; createdAt: Date;
}) {
  return {
    id: u.id,
    fullName: u.fullName,
    title: u.title,
    bio: u.bio,
    expertise: u.expertise,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

// ---------- Phase 2 — classroom room tickets (HMAC, same SECRET as sessions) ----------

export type RoomRole = "teacher" | "student";

export interface RoomTicketPayload {
  uid: string; // user id
  sid: string; // session id
  role: RoomRole;
  name: string; // display name
  exp: number; // epoch ms
}

/** 6 hours in ms — validity window of a room ticket. */
export const ROOM_TICKET_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Sign a classroom room ticket: base64url(payload) + "." + base64url(HMAC-SHA256). */
export function signTicket(payload: RoomTicketPayload): string {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/**
 * Verify a classroom room ticket (signature + expiry + shape).
 * The socket mini-service reimplements this logic locally (no imports from src/).
 */
export function verifyTicket(ticket: string | undefined | null): RoomTicketPayload | null {
  if (!ticket) return null;
  const [payload, sig] = ticket.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof data.uid !== "string" || typeof data.sid !== "string") return null;
    if (data.role !== "teacher" && data.role !== "student") return null;
    if (typeof data.name !== "string" || typeof data.name.length === "undefined") return null;
    if (typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return data as RoomTicketPayload;
  } catch {
    return null;
  }
}
