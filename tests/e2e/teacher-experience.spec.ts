// P17 — teacher experience & discovery e2e:
//  · Word inline preview in the پیوست‌ها tab (docx uploaded via API)
//  · teacher analytics page summary + table
//  · subject landing page grouping toggle
//  · related strip on pamphlet detail
//  · پرفورک‌ترین sort on home
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { DEMO_FOUNDER, DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";
import { SUBJECTS } from "../../src/lib/constants";

const DOCX = fs.readFileSync(path.resolve(__dirname, "fixtures/sample.docx"));

/** Create a pamphlet with a docx attachment via the API → { id }. */
async function pamphletWithDocx(request: import("@playwright/test").APIRequestContext, cookie: string) {
  const created = await request.post("/api/v1/pamphlets", {
    headers: { Cookie: cookie },
    data: {
      title: `جزوهٔ وردی P17 ${Date.now()}`,
      grade: "دهم",
      subject: "ریاضی",
      teachingMethod: "مفهومی",
      difficulty: "متوسط",
      content: "# جزوهٔ وردی\n\nاین جزوه برای آزمون پیش‌نمایش ورد است و بیش از سی نویسه دارد.",
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  const up = await request.post(`/api/v1/pamphlets/${id}/attachments`, {
    headers: { Cookie: cookie },
    multipart: {
      file: {
        name: "sample.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: DOCX,
      },
    },
  });
  expect(up.status()).toBe(201);
  return { id, attachmentId: ((await up.json()) as { id: string }).id };
}

test("Word attachment renders an inline HTML preview in the پیوست‌ها tab", async ({ page }) => {
  test.setTimeout(120000);
  const cookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const { id } = await pamphletWithDocx(page.request, cookie);

  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto(`#/pamphlet/${id}`);
  // the detail auto-lands on پیوست‌ها only for PDFs; click the tab
  await p.getByRole("tab", { name: /پیوست‌ها/ }).click();
  const frame = p.frameLocator('iframe[title^="پیش‌نمایش sample.docx"]');
  // the docx fixture's text rendered by mammoth inside the sandboxed iframe
  await expect(frame.locator("body")).toContainText(/.{3,}/, { timeout: 15000 });
  await expect(p.getByText("دانلود فایل اصلی")).toBeVisible();
  await p.context().close();
});

test("teacher analytics shows summary cards and the per-pamphlet table", async ({ page }) => {
  test.setTimeout(120000);
  const cookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  const p = await pageWithCookie(page.context().browser()!, cookie);

  await p.goto("#/teach/analytics");
  await expect(p.getByRole("heading", { name: "آمار جزوه‌ها" })).toBeVisible({ timeout: 20000 });
  await expect(p.getByText("بازدید کل")).toBeVisible({ timeout: 10000 });
  await expect(p.getByText("فورک کل")).toBeVisible();
  await expect(p.getByText("بازخورد کل")).toBeVisible();
  // the founder's seeded pamphlets appear in the table
  await expect(p.locator("table tbody tr").first()).toBeVisible({ timeout: 10000 });
  await p.context().close();
});

test("subject page groups by grade and toggles to method grouping", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(`#/subject/${encodeURIComponent("ریاضی")}`);
  await expect(page.getByRole("heading", { name: "ریاضی", level: 1 })).toBeVisible({ timeout: 20000 });

  // grade groups exist (seed has دهم ریاضی pamphlets)
  await expect(page.getByRole("heading", { name: /پایهٔ دهم/ }).first()).toBeVisible({ timeout: 10000 });
  const gradeHeadings = await page.getByRole("heading", { name: /پایهٔ/ }).count();
  expect(gradeHeadings).toBeGreaterThan(0);

  // toggle → method groups
  await page.getByRole("button", { name: "بر اساس روش تدریس" }).click();
  await expect(page.getByRole("heading", { name: /مفهومی/ }).first()).toBeVisible({ timeout: 10000 });
  const methodHeadings = await page.getByRole("heading", { name: /پایهٔ/ }).count();
  expect(methodHeadings).toBe(0);
});

test("related strip appears on a pamphlet with same-subject siblings and navigates", async ({ page }) => {
  test.setTimeout(120000);
  const cookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);

  // pick a subject the seed does NOT cover, so the related strip is exactly
  // the two pamphlets this test creates (deterministic regardless of seed)
  let subject = "";
  for (const cand of SUBJECTS) {
    const probe = await page.request.get(
      `/api/v1/pamphlets?subject=${encodeURIComponent(cand)}&pageSize=1`
    );
    const body = (await probe.json()) as { total: number };
    if (body.total === 0) {
      subject = cand;
      break;
    }
  }
  expect(subject).toBeTruthy();

  const mk = async (title: string) => {
    const r = await page.request.post("/api/v1/pamphlets", {
      headers: { Cookie: cookie },
      data: {
        title,
        grade: "دهم",
        subject,
        teachingMethod: "مفهومی",
        difficulty: "متوسط",
        content: "# مرتبط\n\nمحتوای آزمون مرتبط با بیش از سی نویسه.",
      },
    });
    expect(r.status()).toBe(201);
    return ((await r.json()) as { id: string }).id;
  };
  const first = await mk(`مرتبط الف ${Date.now()}`);
  const second = await mk(`مرتبط ب ${Date.now()}`);

  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto(`#/pamphlet/${first}`);
  const strip = p.getByRole("region", { name: "جزوه‌های مرتبط" });
  await expect(strip).toBeVisible({ timeout: 15000 });
  await expect(strip.getByText(/مرتبط ب/).first()).toBeVisible({ timeout: 10000 });
  await strip.getByText(/مرتبط ب/).first().click();
  await expect(p).toHaveURL(new RegExp(`#/pamphlet/${second}`), { timeout: 10000 });
  await p.context().close();
});

test("پرفورک‌ترین sort updates the home list", async ({ page }) => {
  test.setTimeout(120000);
  const cookie = await apiLogin(page.request, DEMO_FOUNDER.email, DEMO_FOUNDER.password);
  // give one pamphlet a fork so پرفورک‌ترین has a distinct signal (fork as the
  // student — the seed pamphlets are the founder's own and self-forking is 403)
  const list = await page.request.get("/api/v1/pamphlets?sort=popular&pageSize=12", {
    headers: { Cookie: cookie },
  });
  const { items } = (await list.json()) as { items: Array<{ id: string }> };
  const studentCookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const fork = await page.request.post(`/api/v1/pamphlets/${items[0].id}/fork`, {
    headers: { Cookie: studentCookie },
  });
  expect(fork.status()).toBe(201);

  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto("#/");
  await expect(p.getByRole("heading", { name: "کتابخانهٔ زندهٔ جزوه‌های درسی ایران" })).toBeVisible({ timeout: 20000 });

  // Radix select: click the trigger, then the option
  await p.getByLabel("مرتب‌سازی").click();
  await p.getByRole("option", { name: "پرفورک‌ترین" }).click();
  await expect(p).toHaveURL(/sort=forks_desc/, { timeout: 10000 });
  await expect(p.locator("a[href^='#/pamphlet/']").first()).toBeVisible({ timeout: 10000 });
  await p.context().close();
});
