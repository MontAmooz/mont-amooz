// P8 — reviews: post, edit-upsert, helpful vote (3 scenarios).
// The review form REQUIRES a star rating (1-5) before submit — the radio
// group «انتخاب امتیاز» holds 5 star buttons (aria-label «<n> ستاره»).
import { test, expect } from "@playwright/test";
import { DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

async function openReviewsTab(page: Awaited<ReturnType<typeof pageWithCookie>>, pamphletId: string) {
  await page.goto(`#/pamphlet/${pamphletId}`);
  await page.getByRole("tab", { name: /بازخوردها/ }).click();
  // rating radios + comment textarea live inside the review form
  await page.getByRole("radiogroup", { name: "انتخاب امتیاز" }).waitFor({ timeout: 20000 });
}

test("post a review on a seeded pamphlet", async ({ page }) => {
  test.setTimeout(60000);
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const list = await page.request.get("/api/v1/pamphlets?pageSize=3");
  const { items } = (await list.json()) as { items: Array<{ id: string }> };
  const p = await pageWithCookie(page.context().browser()!, cookie);
  await openReviewsTab(p, items[0].id);

  await p.getByRole("radio", { name: "۴ ستاره" }).click();
  await p.locator("textarea").first().fill("بازخورد E2E: توضیح مفهومی و مثال‌ها عالی بود.");
  // submit may be «ثبت بازخورد» (fresh) or «به‌روزرسانی بازخورد» (my earlier
  // review persists across tests — the form is an upsert either way)
  const submit = p.getByRole("button", { name: /ثبت بازخورد|به‌روزرسانی بازخورد/ });
  await submit.waitFor({ timeout: 20000 });
  const postResp = p.waitForResponse(
    (r) => r.url().includes("/reviews") && r.request().method() === "POST",
    { timeout: 20000 }
  );
  await submit.click();
  await postResp;
  await expect(p.getByRole("article").getByText("بازخورد E2E")).toBeVisible({ timeout: 20000 });
  await p.context().close();
});

test("re-submitting updates the same review (upsert)", async ({ page }) => {
  test.setTimeout(60000);
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const list = await page.request.get("/api/v1/pamphlets?pageSize=3");
  const { items } = (await list.json()) as { items: Array<{ id: string }> };
  const p = await pageWithCookie(page.context().browser()!, cookie);
  await openReviewsTab(p, items[0].id);

  await p.getByRole("radio", { name: "۳ ستاره" }).click();
  await p.locator("textarea").first().fill("بازخورد اولیهٔ E2E");
  // submit is either «ثبت بازخورد» (fresh) or «به‌روزرسانی بازخورد» (my review
  // already exists from the previous test — the form is an upsert either way)
  const submit = p.getByRole("button", { name: /ثبت بازخورد|به‌روزرسانی بازخورد/ });
  await submit.waitFor({ timeout: 20000 });
  const updResp = p.waitForResponse((r) => r.url().includes("/reviews") && r.request().method() === "POST", { timeout: 20000 });
  await submit.click();
  await updResp;
  // POST 200 alone is not enough: the list refresh is a second GET — wait for
  // the refetch response before polling the DOM
  await p.waitForResponse(
    (r) => r.url().includes(`/api/v1/pamphlets/${items[0].id}/reviews`) && r.request().method() === "GET",
    { timeout: 20000 }
  ).catch(() => {});
  // the list refetches after the POST — poll until the new text is rendered

  await p.locator("textarea").first().fill("بازخورد بهروزشدهٔ E2E");
  const upd2Resp = p.waitForResponse((r) => r.url().includes("/reviews") && r.request().method() === "POST", { timeout: 20000 });
  await p.getByRole("button", { name: "به‌روزرسانی بازخورد" }).click();
  await upd2Resp;
  await expect
    .poll(async () => p.getByRole("article").getByText("بازخورد بهروزشدهٔ E2E").count(), { timeout: 20000 })
    .toBeGreaterThan(0);
  const count = await p.getByRole("article").getByText("بازخورد اولیهٔ E2E").count();
  expect(count).toBe(0); // upsert replaced, not duplicated
  await p.context().close();
});

test("helpful vote toggles with aria-pressed", async ({ page }) => {
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const list = await page.request.get("/api/v1/pamphlets?pageSize=48");
  const { items } = (await list.json()) as { items: Array<{ id: string }> };
  // find a pamphlet that already has a review to vote on
  let target: string | null = null;
  for (const it of items) {
    const r = await page.request.get(`/api/v1/pamphlets/${it.id}/reviews`);
    if (!r.ok()) continue;
    const body = (await r.json()) as { items?: unknown[] };
    if ((body.items?.length ?? 0) > 0) {
      target = it.id;
      break;
    }
  }
  test.skip(!target, "no seeded review to vote on");
  const p = await pageWithCookie(page.context().browser()!, cookie);
  await openReviewsTab(p, target!);
  const helpful = p.getByLabel("این بازخورد مفید بود").first();
  await helpful.waitFor({ timeout: 20000 });
  const before = await helpful.getAttribute("aria-pressed");
  const voteResp = p.waitForResponse((r) => r.url().includes("/vote"), { timeout: 20000 });
  await helpful.click();
  await voteResp;
  await expect.poll(async () => helpful.getAttribute("aria-pressed"), { timeout: 20000 })
    .not.toBe(before);
  await p.context().close();
});
