// مُنت‌آموز — text extraction for attachment search (ADR-0012).
// Best-effort: any failure returns null (the upload still succeeds; the file
// just isn't searchable). Extraction is capped at 50k chars — search operates
// on the head of the document, and SQLite rows stay small.
import path from "node:path";
import mammoth from "mammoth";

const MAX_EXTRACT = 50000;

/**
 * pdfjs's default workerSrc ("./pdf.worker.mjs") only resolves when the import
 * runs from plain Node — under Turbopack the rewritten chunk path doesn't exist
 * and extraction 500s into null. Point it at the shipped worker file instead;
 * the app copy always carries node_modules (hardlinked), so cwd-relative works
 * in dev AND in the test server's ephemeral copy.
 */
let workerReady = false;
async function ensurePdfWorker(): Promise<void> {
  if (workerReady) return;
  const { PDFParse } = await import("pdf-parse");
  PDFParse.setWorker(
    path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs")
  );
  workerReady = true;
}

export async function extractText(
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  try {
    if (contentType === "application/pdf") {
      // pdf-parse v2 class API (ESM). Dynamic import keeps it out of the
      // server bundle until a PDF actually needs extraction.
      const { PDFParse } = await import("pdf-parse");
      await ensurePdfWorker();
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return result.text.slice(0, MAX_EXTRACT);
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    }
    if (
      contentType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      contentType === "application/msword"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.slice(0, MAX_EXTRACT);
    }
    if (contentType === "text/markdown" || contentType === "text/plain") {
      return buffer.toString("utf-8").slice(0, MAX_EXTRACT);
    }
    return null;
  } catch (e) {
    console.error("extractText failed:", e);
    return null;
  }
}
