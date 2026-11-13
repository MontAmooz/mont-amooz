// Unit tests — attachment text extraction (src/lib/server/extract.ts)
// Best-effort contract: success → text, any failure → null (never throws).
import { describe, test, expect } from "vitest";
import { extractText } from "@/lib/server/extract";

const MD = "text/markdown";
const TXT = "text/plain";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("extractText", () => {
  test("markdown text extracts verbatim", async () => {
    const buf = Buffer.from("# عنوان\n\nمتن آزمایشی جزوه", "utf-8");
    expect(await extractText(buf, MD)).toBe("# عنوان\n\nمتن آزمایشی جزوه");
  });

  test("plain text extracts verbatim", async () => {
    const buf = Buffer.from("hello from a txt attachment", "utf-8");
    expect(await extractText(buf, TXT)).toBe("hello from a txt attachment");
  });

  test("corrupt PDF returns null (non-fatal)", async () => {
    const buf = Buffer.from("this is definitely not a pdf", "utf-8");
    expect(await extractText(buf, "application/pdf")).toBeNull();
  });

  test("corrupt docx returns null (non-fatal)", async () => {
    const buf = Buffer.from("not a zip, therefore not a docx", "utf-8");
    expect(await extractText(buf, DOCX)).toBeNull();
  });

  test("unknown content type returns null", async () => {
    expect(await extractText(Buffer.from("x"), "application/zip")).toBeNull();
  });
});
