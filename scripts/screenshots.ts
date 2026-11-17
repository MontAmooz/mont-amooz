#!/usr/bin/env bun
// P13 — README screenshot generator. Run against the DEV server (:3000)
// with the expanded seed applied: bun scripts/screenshots.ts
// Output: public/screenshots/*.png (committed, referenced from README.md)
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const SHOTS: Array<{ name: string; path: string; wait: number }> = [
  { name: "home", path: "/", wait: 2500 },
  { name: "exams", path: "/#/exams", wait: 2000 },
  { name: "courses", path: "/#/courses", wait: 2000 },
  { name: "market", path: "/#/market", wait: 2000 },
  { name: "wallet", path: "/#/wallet", wait: 2000 },
  { name: "pamphlet-detail", path: "/#/pamphlet/<id>", wait: 2500 },
];

async function main() {
  await fs.mkdir("public/screenshots", { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "fa-IR",
    timezoneId: "Asia/Tehran",
  });

  // Login as founder for authenticated screens
  const page = await context.newPage();
  await page.goto("http://localhost:3000/");
  await page.getByRole("button", { name: /ورود/ }).first().click();
  await page.getByLabel(/ایمیل/).fill("montajebii@montamooz.ir");
  await page.getByLabel(/رمز عبور/).fill("123456");
  await page.getByRole("button", { name: "ورود به حساب" }).click();
  await page.waitForTimeout(2000);

  // Resolve a real pamphlet id (public API — plain fetch, skip gracefully when absent)
  let pamphletId = "";
  try {
    const res = await fetch("http://localhost:3000/api/v1/pamphlets?pageSize=1");
    const data = (await res.json()) as { items?: Array<{ id: string }> };
    pamphletId = data.items?.[0]?.id ?? "";
  } catch {
    /* skip */
  }

  for (const shot of SHOTS) {
    let url = `http://localhost:3000${shot.path}`;
    if (shot.path.includes("<id>")) {
      if (!pamphletId) {
        console.warn(`⚠ skipped ${shot.name} (no pamphlet id)`);
        continue;
      }
      url = url.replace("<id>", pamphletId);
    }
    await page.goto(url);
    await page.waitForTimeout(shot.wait);
    await page.screenshot({ path: `public/screenshots/${shot.name}.png`, fullPage: false });
    console.log(`✓ ${shot.name}.png`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
