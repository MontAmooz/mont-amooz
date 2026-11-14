// Integration tests — pamphlet attachments (ADR-0012)
// Upload (multipart), listing, signed download, deletion. The ephemeral server
// signs/verifies with the same AUTH_SECRET vitest provides, so expired/tampered
// URLs are minted locally via the storage helpers.
import { describe, test, expect, beforeAll } from "vitest";
import fs from "node:fs";
import { api, createPamphlet, registerUser } from "../helpers/server";
import { signedDownloadUrl } from "../../src/lib/server/storage";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

// Warm the upload route once: its first Turbopack compile pulls mammoth +
// pdf-parse/pdfjs and can exceed the 15s per-test timeout on a cold server
// (seen twice as a 242/1 flake). beforeAll runs under the 60s hookTimeout.
beforeAll(async () => {
  const warm = await api(baseUrl(), "/api/v1/pamphlets/warm/attachments", { method: "POST" });
  expect([401, 404]).toContain(warm.status); // 401 (route exists) is the goal
}, 60_000);

const PDF_MIME = "application/pdf";
const MD_MIME = "text/markdown";

function pdfBlob(): Blob {
  // Minimal %PDF-prefixed payload — enough for file-type magic-byte detection.
  return new Blob(["%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"], {
    type: PDF_MIME,
  });
}

function mdFile(): File {
  return new File([Buffer.from("# جزوهٔ پیوست‌دار\n\nمتن جستجونیک: کلمهٔ یکتای کوانتومی\n")], "sample.md", {
    type: MD_MIME,
  });
}

/** Upload an attachment; returns the 201 response. */
function upload(pamphletId: string, cookie: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return api<{ id: string; signedUrl: string }>(
    baseUrl(),
    `/api/v1/pamphlets/${pamphletId}/attachments`,
    { method: "POST", cookie, body: fd }
  );
}

describe("Attachments — POST /pamphlets/[id]/attachments", () => {
  test("unauthenticated → 401", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    const r = await upload(id, "", pdfBlob() as unknown as File);
    expect(r.status).toBe(401);
  });

  test("non-owner → 403 «فقط نویسندهٔ جزوه می‌تواند پیوست اضافه کند»", async () => {
    const author = await registerUser(baseUrl());
    const other = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    const r = await upload(id, other.cookie, pdfBlob() as unknown as File);
    expect(r.status).toBe(403);
    expect((r.data as unknown as { error: string }).error).toBe(
      "فقط نویسندهٔ جزوه می‌تواند پیوست اضافه کند"
    );
  });

  test("disallowed type → 400 with Persian message", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    const zip = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "evil.zip", {
      type: "application/zip",
    });
    const r = await upload(id, author.cookie, zip);
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toContain("نوع فایل");
  });

  test("oversize file → 400 «حجم فایل حداکثر ۲۰ مگابایت است»", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    const big = new File([new Uint8Array(20 * 1024 * 1024 + 1)], "big.pdf", {
      type: PDF_MIME,
    });
    const r = await upload(id, author.cookie, big);
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("حجم فایل حداکثر ۲۰ مگابایت است");
  });

  test("valid upload → 201 { id, signedUrl }", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    const r = await upload(id, author.cookie, pdfBlob() as unknown as File);
    expect(r.status).toBe(201);
    expect(r.data.id).toBeTruthy();
    expect(r.data.signedUrl).toContain(`/api/v1/attachments/${r.data.id}/download?`);
  });

  test("binary file whose magic bytes contradict the declared type → 400", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    const zipAsPdf = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "f.pdf", {
      type: PDF_MIME,
    });
    const r = await upload(id, author.cookie, zipAsPdf);
    expect(r.status).toBe(400);
    expect((r.data as unknown as { error: string }).error).toBe("نوع فایل تشخیص داده نشد");
  });
});

describe("Attachments — GET list + detail integration", () => {
  test("list returns the attachment with a signedUrl", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    const up = await upload(id, author.cookie, mdFile());
    expect(up.status).toBe(201);

    const list = await api<{ items: Array<{ id: string; signedUrl: string; fileName: string }> }>(
      baseUrl(),
      `/api/v1/pamphlets/${id}/attachments`
    );
    expect(list.status).toBe(200);
    expect(list.data.items).toHaveLength(1);
    expect(list.data.items[0].fileName).toBe("sample.md");
    expect(list.data.items[0].signedUrl).toContain("/download?");
  });

  test("pamphlet detail exposes attachments + summary flags", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    await upload(id, author.cookie, mdFile());

    const detail = await api<{
      hasAttachment: boolean;
      attachmentType: string | null;
      attachments: Array<{ id: string; contentType: string }>;
    }>(baseUrl(), `/api/v1/pamphlets/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.data.hasAttachment).toBe(true);
    expect(detail.data.attachmentType).toBe("md");
    expect(detail.data.attachments).toHaveLength(1);
    expect(detail.data.attachments[0].contentType).toBe(MD_MIME);
  });

  test("search finds the pamphlet through the attachment's extracted text", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie, {
      title: `جزوهٔ جستجو ${Date.now()}`,
    });
    await upload(id, author.cookie, mdFile()); // contains «کوانتومی»

    const list = await api<{ items: Array<{ id: string }> }>(
      baseUrl(),
      `/api/v1/pamphlets?query=${encodeURIComponent("کوانتومی")}`
    );
    expect(list.status).toBe(200);
    expect(list.data.items.some((p) => p.id === id)).toBe(true);
  });

  test("real PDF's text layer is extracted and searchable (pdfjs worker fix)", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie, {
      title: `جزوهٔ PDFی ${Date.now()}`,
    });
    const bytes = fs.readFileSync(
      new URL("../e2e/fixtures/sample.pdf", import.meta.url)
    );
    const pdf = new File([bytes], "sample.pdf", { type: PDF_MIME });
    const up = await upload(id, author.cookie, pdf);
    expect(up.status).toBe(201);

    const list = await api<{ items: Array<{ id: string }> }>(
      baseUrl(),
      `/api/v1/pamphlets?query=MontAmooz`
    );
    expect(list.status).toBe(200);
    expect(list.data.items.some((p) => p.id === id)).toBe(true);
  });
});

describe("Attachments — GET download (signed URL)", () => {
  async function fixture() {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    const up = await upload(id, author.cookie, pdfBlob() as unknown as File);
    expect(up.status).toBe(201);
    return { author, pamphletId: id, attachmentId: up.data.id };
  }

  test("no signature → 403", async () => {
    const { attachmentId } = await fixture();
    const r = await api(baseUrl(), `/api/v1/attachments/${attachmentId}/download`);
    expect(r.status).toBe(403);
    expect((r.data as unknown as { error: string }).error).toBe("لینک دانلود منقضی یا نامعتبر است");
  });

  test("expired signature → 403", async () => {
    const { attachmentId } = await fixture();
    const r = await api(baseUrl(), signedDownloadUrl(attachmentId, -1));
    expect(r.status).toBe(403);
  });

  test("tampered signature → 403", async () => {
    const { attachmentId } = await fixture();
    const url = signedDownloadUrl(attachmentId);
    const u = new URL(url, "http://x");
    const sig = u.searchParams.get("sig")!;
    u.searchParams.set("sig", (sig[0] === "A" ? "B" : "A") + sig.slice(1));
    const r = await api(baseUrl(), u.pathname + u.search);
    expect(r.status).toBe(403);
  });

  test("valid signature → 200 with the stored bytes + content type", async () => {
    const { attachmentId } = await fixture();
    const res = await fetch(`${baseUrl()}${signedDownloadUrl(attachmentId)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(PDF_MIME);
    const text = await res.text();
    expect(text.startsWith("%PDF-1.4")).toBe(true);
  });
});

describe("Attachments — DELETE /attachments/[id]", () => {
  test("non-owner → 403", async () => {
    const author = await registerUser(baseUrl());
    const other = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    const up = await upload(id, author.cookie, mdFile());
    const r = await api(baseUrl(), `/api/v1/attachments/${up.data.id}`, {
      method: "DELETE",
      cookie: other.cookie,
    });
    expect(r.status).toBe(403);
  });

  test("owner → 204; row disappears from the list", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    const up = await upload(id, author.cookie, mdFile());
    const del = await api(baseUrl(), `/api/v1/attachments/${up.data.id}`, {
      method: "DELETE",
      cookie: author.cookie,
    });
    expect(del.status).toBe(204);

    const list = await api<{ items: unknown[] }>(
      baseUrl(),
      `/api/v1/pamphlets/${id}/attachments`
    );
    expect(list.data.items).toHaveLength(0);
  });

  test("metadata endpoint exposes no storageKey", async () => {
    const author = await registerUser(baseUrl());
    const id = await createPamphlet(baseUrl(), author.cookie);
    const up = await upload(id, author.cookie, mdFile());
    const meta = await api<Record<string, unknown>>(
      baseUrl(),
      `/api/v1/attachments/${up.data.id}`
    );
    expect(meta.status).toBe(200);
    expect(meta.data.fileName).toBe("sample.md");
    expect(JSON.stringify(meta.data)).not.toContain("storageKey");
  });
});
