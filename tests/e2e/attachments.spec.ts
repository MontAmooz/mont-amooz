// P9 — pamphlet attachments (ADR-0012): wizard upload → پیوست‌ها tab →
// signed download → owner delete. The PDF-first default-tab rule (short
// content + PDF attachment) is exercised implicitly in test 1.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { DEMO_FOUNDER, apiLogin, pageWithCookie } from "./utils";

const SAMPLE_PDF = path.join(__dirname, "fixtures", "sample.pdf");

test("creating a pamphlet with a PDF attachment shows the پیوست‌ها tab with an embedded PDF", async ({ page }) => {
  test.setTimeout(90000);
  const cookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const p = await pageWithCookie(page.context().browser()!, cookie);

  await p.goto("#/create");
  await expect(p.getByLabel("مراحل بارگذاری")).toBeVisible({ timeout: 20000 });

  // step 0: identity
  await p.getByPlaceholder("مثلاً: جزوهٔ کامل ریاضی نهم — فصل معادله‌ها").fill(`جزوهٔ پیوست‌دار E2E ${Date.now()}`);
  await p.getByLabel("پایهٔ تحصیلی").click();
  await p.getByRole("option", { name: "دهم", exact: true }).click();
  await p.getByLabel("درس", { exact: true }).click();
  await p.getByRole("option", { name: "ریاضی", exact: true }).click();
  await p.getByLabel("روش تدریس").click();
  await p.getByRole("option", { name: "مفهومی", exact: true }).click();
  await p.getByLabel("سطح جزوه").click();
  await p.getByRole("option", { name: "متوسط", exact: true }).click();
  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();

  // step 1: short content + the file attachment (held in state until publish)
  const editor = p.locator("textarea").first();
  await editor.waitFor({ timeout: 20000 });
  await editor.fill("# پیوست PDF\n\nمحتوای کوتاه — جزوه به‌صورت PDF ارائه شده است.");
  await p.locator('input[type="file"]').setInputFiles(SAMPLE_PDF);
  await expect(p.getByText("sample.pdf").first()).toBeVisible();
  await p.getByRole("button", { name: "مرحلهٔ بعد" }).click();

  // publish: POST /pamphlets then POST …/attachments, then navigate to detail
  const uploadDone = p.waitForResponse(
    (r) => r.url().includes("/attachments") && r.request().method() === "POST"
  );
  await p.getByRole("button", { name: "انتشار جزوه" }).click();
  const resp = await uploadDone;
  expect(resp.status()).toBe(201);
  await expect(p).toHaveURL(/#\/pamphlet\//, { timeout: 20000 });

  // short content + PDF → the PDF-first rule must have landed on پیوست‌ها
  // without any click (D.3); the explanatory note lives on the محتوا tab
  const tab = p.getByRole("tab", { name: /پیوست/ });
  await expect(tab).toBeVisible({ timeout: 10000 });
  await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 5000 });

  await p.getByRole("tab", { name: "محتوا" }).click();
  await expect(p.getByText("این جزوه به‌صورت PDF ارائه شده است")).toBeVisible();
  await tab.click();

  // the embedded viewer loads the signed URL
  const pdfLoaded = p.waitForResponse((r) => r.url().includes("/download"));
  await expect(p.locator("iframe")).toBeVisible({ timeout: 10000 });
  expect((await pdfLoaded).status()).toBe(200);
  await p.context().close();
});

test("the download link returns the original bytes through the signed URL", async ({ page }) => {
  test.setTimeout(60000);
  const cookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);

  // API setup: pamphlet + attachment (UI upload covered by the previous test)
  const created = await page.request.post("/api/v1/pamphlets", {
    data: {
      title: `جزوهٔ دانلود E2E ${Date.now()}`,
      grade: "دهم",
      subject: "ریاضی",
      teachingMethod: "مفهومی",
      difficulty: "متوسط",
      content: "# دانلود\n\nاین محتوا برای آزمون دانلود پیوست است و بیش از سی نویسه دارد.",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  const uploaded = await page.request.post(`/api/v1/pamphlets/${id}/attachments`, {
    multipart: {
      file: {
        name: "sample.pdf",
        mimeType: "application/pdf",
        buffer: fs.readFileSync(SAMPLE_PDF),
      },
    },
  });
  expect(uploaded.status()).toBe(201);

  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto(`#/pamphlet/${id}`);
  const tab = p.getByRole("tab", { name: /پیوست/ });
  await expect(tab).toBeVisible({ timeout: 20000 });
  await tab.click();

  const href = await p.locator('a[download]').getAttribute("href");
  expect(href).toContain("/download?");
  const res = await p.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  const body = await res.body();
  expect(body.subarray(0, 8).toString("latin1")).toMatch(/^%PDF-1\.\d/);
  await p.context().close();
});

test("owner can delete the attachment — the tab disappears", async ({ page }) => {
  test.setTimeout(60000);
  const cookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);

  const created = await page.request.post("/api/v1/pamphlets", {
    data: {
      title: `جزوهٔ حذف پیوست E2E ${Date.now()}`,
      grade: "دهم",
      subject: "ریاضی",
      teachingMethod: "مفهومی",
      difficulty: "متوسط",
      content: "# حذف پیوست\n\nاین محتوا برای آزمون حذف پیوست است و بیش از سی نویسه دارد.",
    },
  });
  const { id } = (await created.json()) as { id: string };
  const uploaded = await page.request.post(`/api/v1/pamphlets/${id}/attachments`, {
    multipart: {
      file: {
        name: "sample.pdf",
        mimeType: "application/pdf",
        buffer: fs.readFileSync(SAMPLE_PDF),
      },
    },
  });
  expect(uploaded.status()).toBe(201);

  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto(`#/pamphlet/${id}`);
  const tab = p.getByRole("tab", { name: /پیوست/ });
  await expect(tab).toBeVisible({ timeout: 20000 });
  await tab.click();

  // the button's accessible name is «حذف پیوست sample.pdf» (aria-label)
  await p.getByRole("button", { name: /حذف/ }).click();
  // The DELETE is the first hit of that route module → Turbopack compiles it
  // on demand; under memory pressure that takes >10s (P10 lesson — same class
  // as the vitest cold-compile timeouts), so give the tab removal a wide window.
  await expect(tab).toBeHidden({ timeout: 30000 });
  await expect(p.getByRole("tab", { name: "محتوا" })).toHaveAttribute("aria-selected", "true");
  await p.context().close();
});
