// Unit tests — attachment storage guards (src/lib/server/storage.ts)
// validateFile + HMAC download-signature round trip are pure logic (no fs I/O).
// AUTH_SECRET is provided by vitest.config.ts env.
import { describe, test, expect } from "vitest";
import {
  validateFile,
  signedDownloadUrl,
  verifyDownloadSignature,
} from "@/lib/server/storage";

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC = "application/msword";
const MD = "text/markdown";
const TXT = "text/plain";

describe("validateFile", () => {
  test("rejects a disallowed type", () => {
    expect(() => validateFile("application/zip", 1000)).toThrow("نوع فایل مجاز نیست");
  });

  test("rejects oversize (>20MB)", () => {
    expect(() => validateFile(PDF, 20 * 1024 * 1024 + 1)).toThrow("حجم فایل حداکثر");
  });

  test("rejects zero-size", () => {
    expect(() => validateFile(PDF, 0)).toThrow("فایل خالی است");
  });

  test("accepts each of the 5 allowed types", () => {
    expect(() => validateFile(PDF, 100)).not.toThrow();
    expect(() => validateFile(DOCX, 100)).not.toThrow();
    expect(() => validateFile(DOC, 100)).not.toThrow();
    expect(() => validateFile(MD, 100)).not.toThrow();
    expect(() => validateFile(TXT, 100)).not.toThrow();
  });

  test("accepts exactly the 20MB boundary", () => {
    expect(() => validateFile(PDF, 20 * 1024 * 1024)).not.toThrow();
  });
});

describe("signedDownloadUrl / verifyDownloadSignature", () => {
  test("round trip: freshly signed URL verifies", () => {
    const url = signedDownloadUrl("att-1");
    expect(url).toContain("/api/v1/attachments/att-1/download?exp=");
    const params = new URLSearchParams(url.split("?")[1]);
    expect(
      verifyDownloadSignature("att-1", Number(params.get("exp")), params.get("sig")!)
    ).toBe(true);
  });

  test("expired signature (exp in the past) → false", () => {
    const url = signedDownloadUrl("att-1", -1); // already expired
    const params = new URLSearchParams(url.split("?")[1]);
    expect(
      verifyDownloadSignature("att-1", Number(params.get("exp")), params.get("sig")!)
    ).toBe(false);
  });

  test("tampered signature → false", () => {
    const url = signedDownloadUrl("att-1");
    const params = new URLSearchParams(url.split("?")[1]);
    const sig = params.get("sig")!;
    const broken = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(
      verifyDownloadSignature("att-1", Number(params.get("exp")), broken)
    ).toBe(false);
  });

  test("signature bound to the attachment id — different id → false", () => {
    const url = signedDownloadUrl("att-1");
    const params = new URLSearchParams(url.split("?")[1]);
    expect(
      verifyDownloadSignature("att-2", Number(params.get("exp")), params.get("sig")!)
    ).toBe(false);
  });

  test("TTL is reflected in exp (default 1h)", () => {
    const before = Date.now();
    const url = signedDownloadUrl("att-1");
    const exp = Number(new URLSearchParams(url.split("?")[1]).get("exp"));
    expect(exp).toBeGreaterThanOrEqual(before + 3600 * 1000 - 1000);
    expect(exp).toBeLessThanOrEqual(Date.now() + 3600 * 1000 + 1000);
  });
});
