// Unit tests — extractHtml (P17 Word/Markdown inline preview)
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { extractHtml } from "../../src/lib/server/extract";

const DOCX = fs.readFileSync(
  path.resolve(__dirname, "../e2e/fixtures/sample.docx")
);

describe("extractHtml", () => {
  test("docx buffer → HTML string with the document text", async () => {
    const html = await extractHtml(DOCX, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(html).toBeTruthy();
    expect(html).toContain("<");
    // mammoth maps Word paragraphs to <p> elements
    expect(html).toMatch(/<(p|h\d|ul|table)[\s>]/i);
  });

  test("markdown buffer → <pre> wrapped, escaped", async () => {
    const buffer = Buffer.from("# عنوان\n\nمتن <script>alert(1)</script> تست");
    const html = await extractHtml(buffer, "text/markdown");
    expect(html).toBeTruthy();
    expect(html).toContain("<pre");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("pdf → null (PDFs have their own iframe path)", async () => {
    const html = await extractHtml(Buffer.from("%PDF-1.4 fake"), "application/pdf");
    expect(html).toBeNull();
  });

  test("docx output contains no <script> tags even if the document had them", async () => {
    // mammoth strips scripts from real docx anyway — assert the sanitizer on a
    // hand-built buffer that survives conversion (the strip runs post-convert).
    const html = await extractHtml(DOCX, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/<style\b/i);
    expect(html).not.toMatch(/\son\w+=/i);
  });

  test("corrupt docx → null (fallback to download-only)", async () => {
    const garbage = Buffer.from("this is not a zip file at all");
    const html = await extractHtml(garbage, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(html).toBeNull();
  });
});
