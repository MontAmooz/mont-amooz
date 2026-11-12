// P8 — fork → edit → new version → MR → diff (3 scenarios).
import { test, expect, type APIRequestContext } from "@playwright/test";
import { DEMO_STUDENT, apiLogin, pageWithCookie } from "./utils";

async function makeFork(request: APIRequestContext): Promise<string> {
  const cookie = await apiLogin(request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const list = await request.get("/api/v1/pamphlets?pageSize=48");
  const { items } = (await list.json()) as { items: Array<{ id: string }> };
  // hossein authors two seed pamphlets — fork someone else's (self-fork = 403)
  const foreign = (await (async () => {
    for (const it of items) {
      const d = await request.get(`/api/v1/pamphlets/${it.id}`);
      if (!d.ok()) continue;
      const data = (await d.json()) as { isMine?: boolean };
      if (!data.isMine) return it.id;
    }
    throw new Error("no pamphlet owned by someone else");
  })());
  const res = await request.post(`/api/v1/pamphlets/${foreign}/fork`, {
    headers: { cookie },
  });
  if (![200, 201].includes(res.status())) throw new Error(`fork failed: ${res.status()}`);
  const { id } = (await res.json()) as { id: string };
  return id;
}

test("fork navigates to the edit view of the copy", async ({ page }) => {
  const forkId = await makeFork(page.request);
  await page.goto(`#/edit/${forkId}`);
  await expect(page.getByLabel("خلاصهٔ تغییرات این نسخه")).toBeVisible({ timeout: 20000 });
});

test("edit view registers a new version", async ({ page }) => {
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const forkId = await makeFork(page.request);

  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto(`#/edit/${forkId}`);
  const editor = p.getByPlaceholder(/متن جزوه را اینجا بنویسید/);
  await editor.waitFor({ timeout: 20000 });
  await editor.fill("# نسخهٔ بهبودیافته\n\nمحتوای ویرایش‌شده برای آزمون E2E — بیش از ده نویسه.");
  await p.getByLabel("خلاصهٔ تغییرات این نسخه").fill("بهبود متن برای E2E");
  const verResp = p.waitForResponse(
    (r) => r.url().includes(`/api/v1/pamphlets/${forkId}/versions`) && r.request().method() === "POST",
    { timeout: 20000 }
  );
  await p.getByRole("button", { name: "ثبت نسخهٔ جدید" }).click();
  await verResp;
  await expect(p.getByText(/نسخهٔ جدید/).first()).toBeVisible({ timeout: 10000 });
  await p.context().close();
});

test("MR dialog creates a merge request and diff page renders", async ({ page }) => {
  const cookie = await apiLogin(page.request, DEMO_STUDENT.email, DEMO_STUDENT.password);
  const forkId = await makeFork(page.request);
  await page.request.post(`/api/v1/pamphlets/${forkId}/versions`, {
    headers: { cookie, "content-type": "application/json" },
    data: {
      content: "# نسخهٔ بهبودیافته\n\nخط افزودهٔ جدید برای تولید تفاوت واقعی در دیف.",
      changeSummary: "افزودن خط جدید",
    },
  });

  const p = await pageWithCookie(page.context().browser()!, cookie);
  await p.goto(`#/pamphlet/${forkId}`);
  await p.getByRole("button", { name: "پیشنهاد ادغام با نسخهٔ اصلی" }).click();
  await p.locator("#mr-title").fill(`E2E MR ${Date.now()}`);
  const mrResp = p.waitForResponse(
    (r) => r.url().includes("/api/v1/merge-requests") && r.request().method() === "POST",
    { timeout: 20000 }
  );
  await p.getByRole("button", { name: "ثبت درخواست ادغام" }).click();
  await mrResp;
  await expect(p).toHaveURL(/#\/request\//, { timeout: 20000 });
  await expect(p.getByRole("heading", { name: "تغییرات پیشنهادی" })).toBeVisible({ timeout: 20000 });
  await p.context().close();
});
