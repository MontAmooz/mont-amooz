// Unit tests — HMAC room-ticket signing (src/lib/server/auth.ts)
// signTicket/verifyTicket are pure crypto (no Next request context needed).
// AUTH_SECRET is provided by vitest.config.ts env (the module throws without it).
import { describe, test, expect } from "vitest";
import { signTicket, verifyTicket } from "@/lib/server/auth";

const payload = {
  uid: "u1",
  sid: "s1",
  role: "teacher" as const,
  name: "علی",
  exp: Date.now() + 3_600_000,
};

describe("signTicket / verifyTicket round-trip", () => {
  test("valid ticket verifies to the identical payload", () => {
    const ticket = signTicket(payload);
    const out = verifyTicket(ticket);
    expect(out).not.toBeNull();
    expect(out!.uid).toBe("u1");
    expect(out!.sid).toBe("s1");
    expect(out!.role).toBe("teacher");
    expect(out!.name).toBe("علی");
    expect(out!.exp).toBe(payload.exp);
  });

  test("tampered payload (uid changed) → null", () => {
    const ticket = signTicket(payload);
    const [body, sig] = ticket.split(".");
    // swap u1 for u2 inside the payload, keep the original signature
    const forged = Buffer.from(
      JSON.stringify({ ...payload, uid: "u2" })
    ).toString("base64url");
    expect(verifyTicket(`${forged}.${sig}`)).toBeNull();
  });

  test("tampered signature → null", () => {
    const ticket = signTicket(payload);
    const [body] = ticket.split(".");
    expect(verifyTicket(`${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)).toBeNull();
  });

  test("expired ticket → null", () => {
    const ticket = signTicket({ ...payload, exp: Date.now() - 1000 });
    expect(verifyTicket(ticket)).toBeNull();
  });

  test("malformed: random string without dot → null", () => {
    expect(verifyTicket("garbage-ticket")).toBeNull();
  });

  test("ACTUAL: trailing garbage after the signature is ignored (lenient parsing)", () => {
    // token.split(".") destructures only [payload, sig]; segments beyond the
    // second are dropped — `${ticket}.extra` still verifies. Captured as-is;
    // hardening note in /tmp/oeg-diag/22-bugs-found.md (enforce 2 segments at P6).
    const ticket = signTicket(payload);
    expect(verifyTicket(`${ticket}.extra`)).not.toBeNull();
    expect(verifyTicket(`${ticket}.extra`)!.uid).toBe("u1");
  });

  test("malformed: empty → null", () => {
    expect(verifyTicket("")).toBeNull();
    expect(verifyTicket(null)).toBeNull();
    expect(verifyTicket(undefined)).toBeNull();
  });

  test("deterministic: same input → same signature", () => {
    expect(signTicket(payload)).toBe(signTicket(payload));
  });

  test("different payloads → different signatures", () => {
    const a = signTicket(payload);
    const b = signTicket({ ...payload, uid: "u2" });
    expect(a).not.toBe(b);
  });
});
