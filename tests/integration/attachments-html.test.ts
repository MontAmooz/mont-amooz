// Integration tests — attachment HTML preview endpoint (P17)
// Same signed-URL contract as /download; only Word/Markdown/text convert.
import { describe, test, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { api, createPamphlet, registerUser } from "../helpers/server";
import { signedDownloadUrl } from "../../src/lib/server/storage";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MD_MIME = "text/markdown";
const PDF_MIME = "application/pdf";
const DOCX = fs.readFileSync(path.resolve(__dirname, "../e2e/fixtures/sample.docx"));

beforeAll(async () => {
  // warm the upload + html routes (mammoth/pdfjs cold compiles)
  await api(baseUrl(), "/api/v1/pamphlets/warm/attachments", { method: "POST" });
}, 60_000);

function docxFile(): File {
  return new File([DOCX], "sample.docx", { type: DOCX_MIME });
}
function mdFile(): File {
  return new File([Buffer.from("# پیوست HTML\n\nمتن پیش‌نمایش مارک‌داون با بیش از یک خط.")], "note.md", { type: MD_MIME });
}
function pdfFile(): File {
  return new Blob(["%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"], { type: PDF_MIME }) as unknown as File;
}

async function upload(pamphletId: string, cookie: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return api<{ id: string; signedUrl: string }>(
    baseUrl(),
    `/api/v1/pamphlets/${pamphletId}/attachments`,
    { method: "POST", cookie, body: fd }
  );
}

/** Split a signed URL into its exp/sig query pair. */
function sigPair(signedUrl: string): { exp: string; sig: string } {
  const url = new URL(signedUrl, "http://localhost:3002");
  return { exp: url.searchParams.get("exp") ?? "", sig: url.searchParams.get("sig") ?? "" };
}

describe("GET /attachments/[id]/html (P17)", () => {
  test("unsigned / tampered / expired / unknown-id → rejected", async () => {
    const author = await registerUser(baseUrl());
    const pamphletId = await createPamphlet(baseUrl(), author.cookie);
    const up = await upload(pamphletId, author.cookie, docxFile());
    expect(up.status).toBe(201);
    const { exp, sig } = sigPair(up.data.signedUrl);

    // no signature at all
    const noSig = await api(baseUrl(), `/api/v1/attachments/${up.data.id}/html`);
    expect(noSig.status).toBe(403);

    // tampered signature
    const tampered = await api(
      baseUrl(),
      `/api/v1/attachments/${up.data.id}/html?exp=${exp}&sig=${sig.slice(0, -2)}xx`
    );
    expect(tampered.status).toBe(403);

    // expired (signedDownloadUrl with a negative TTL → exp in the past, sig valid)
    const expiredUrl = new URL(signedDownloadUrl(up.data.id, -3600), "http://localhost:3002");
    const expired = await api(
      baseUrl(),
      `/api/v1/attachments/${up.data.id}/html?exp=${expiredUrl.searchParams.get("exp")}&sig=${expiredUrl.searchParams.get("sig")}`
    );
    expect(expired.status).toBe(403);

    // unknown attachment id (with a syntactically valid pair for that id)
    const ghostUrl = new URL(signedDownloadUrl("nonexistent-attachment-id"), "http://localhost:3002");
    const ghost = await api(
      baseUrl(),
      `/api/v1/attachments/nonexistent-attachment-id/html?exp=${ghostUrl.searchParams.get("exp")}&sig=${ghostUrl.searchParams.get("sig")}`
    );
    expect(ghost.status).toBe(404);
  });

  test("docx with valid sig → 200 text/html, nosniff, body has content", async () => {
    const author = await registerUser(baseUrl());
    const pamphletId = await createPamphlet(baseUrl(), author.cookie);
    const up = await upload(pamphletId, author.cookie, docxFile());
    expect(up.status).toBe(201);
    const { exp, sig } = sigPair(up.data.signedUrl);

    const r = await fetch(`${baseUrl()}/api/v1/attachments/${up.data.id}/html?exp=${exp}&sig=${sig}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    const body = await r.text();
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toMatch(/<script\b/i);
  });

  test("markdown with valid sig → 200 <pre> body", async () => {
    const author = await registerUser(baseUrl());
    const pamphletId = await createPamphlet(baseUrl(), author.cookie);
    const up = await upload(pamphletId, author.cookie, mdFile());
    expect(up.status).toBe(201);
    const { exp, sig } = sigPair(up.data.signedUrl);

    const r = await fetch(`${baseUrl()}/api/v1/attachments/${up.data.id}/html?exp=${exp}&sig=${sig}`);
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain("<pre");
    expect(body).toContain("پیش‌نمایش مارک‌داون");
  });

  test("pdf with valid sig → 400 «فایل PDF به‌صورت HTML قابل نمایش نیست»", async () => {
    const author = await registerUser(baseUrl());
    const pamphletId = await createPamphlet(baseUrl(), author.cookie);
    const up = await upload(pamphletId, author.cookie, pdfFile());
    expect(up.status).toBe(201);
    const { exp, sig } = sigPair(up.data.signedUrl);

    const r = await api<{ error: string }>(
      baseUrl(),
      `/api/v1/attachments/${up.data.id}/html?exp=${exp}&sig=${sig}`
    );
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe(
      "فایل PDF به‌صورت HTML قابل نمایش نیست"
    );
  });

  test("pamphlet detail attachment item carries htmlUrl (null for PDF)", async () => {
    const author = await registerUser(baseUrl());
    const pamphletId = await createPamphlet(baseUrl(), author.cookie);
    const docxUp = await upload(pamphletId, author.cookie, docxFile());
    const pdfUp = await upload(pamphletId, author.cookie, pdfFile());
    expect(docxUp.status).toBe(201);
    expect(pdfUp.status).toBe(201);

    const detail = await api<{
      attachments: Array<{ id: string; contentType: string; htmlUrl: string | null; signedUrl: string }>;
    }>(baseUrl(), `/api/v1/pamphlets/${pamphletId}`);
    expect(detail.status).toBe(200);
    const byId = new Map(detail.data.attachments.map((a) => [a.id, a]));
    expect(byId.get(docxUp.data.id)!.htmlUrl).toContain(`/api/v1/attachments/${docxUp.data.id}/html?`);
    expect(byId.get(pdfUp.data.id)!.htmlUrl).toBeNull();
    expect(byId.get(pdfUp.data.id)!.signedUrl).toContain("/download?");
  });
});
