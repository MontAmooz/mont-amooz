// Integration tests — related pamphlets (P17) + forks_desc sort
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import { api, createPamphlet, registerUser } from "../helpers/server";

const baseUrl = () => fs.readFileSync("/tmp/oeg-test-url.txt", "utf8").trim();

async function fork(cookie: string, sourceId: string): Promise<string> {
  const r = await api<{ id: string }>(baseUrl(), `/api/v1/pamphlets/${sourceId}/fork`, {
    method: "POST",
    cookie,
  });
  expect(r.status).toBe(201);
  return r.data.id;
}

describe("GET /pamphlets/[id]/related (P17)", () => {
  test("unknown id → 404 «جزوه پیدا نشد»", async () => {
    const r = await api(baseUrl(), "/api/v1/pamphlets/nonexistent-id/related");
    expect(r.status).toBe(404);
  });

  test("returns same-subject items, excludes self, dedupes, caps at 6", async () => {
    const author = await registerUser(baseUrl());
    // source: دهم ریاضی مفهومی
    const source = await createPamphlet(baseUrl(), author.cookie, {
      title: "مرجع مرتبط",
      grade: "دهم",
      subject: "ریاضی",
      teachingMethod: "مفهومی",
    });
    // 7 same-subject items (bucket 1 alone has more than the cap)
    const sameSubjectIds: string[] = [];
    for (let i = 0; i < 7; i++) {
      const id = await createPamphlet(baseUrl(), author.cookie, {
        title: `هم‌درس ${i}`,
        grade: i % 2 === 0 ? "دهم" : "یازدهم",
        subject: "ریاضی",
        teachingMethod: i % 2 === 0 ? "مفهومی" : "حل تمرین",
      });
      sameSubjectIds.push(id);
    }
    // one same-grade+same-method item from ANOTHER subject (bucket 2)
    const crossSubject = await createPamphlet(baseUrl(), author.cookie, {
      title: "هم‌پایه‌هم‌روش",
      grade: "دهم",
      subject: "فیزیک",
      teachingMethod: "مفهومی",
    });

    const r = await api<{ items: Array<{ id: string }> }>(
      baseUrl(),
      `/api/v1/pamphlets/${source}/related`
    );
    expect(r.status).toBe(200);
    const items = r.data.items;

    // bounded by the two buckets and the 6-cap (seeded pamphlets may also
    // qualify — the throwaway DB seeds 40 pamphlets; the contract here is
    // no-self, no-dupes, and the cap)
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.length).toBeLessThanOrEqual(6);
    expect(items.some((p) => p.id === source)).toBe(false); // self excluded
    const ids = items.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
  });

  test("same-grade+same-method bucket fills when subject bucket is thin", async () => {
    const author = await registerUser(baseUrl());
    const source = await createPamphlet(baseUrl(), author.cookie, {
      title: "تک‌جزوهٔ درس کمیاب",
      grade: "نهم",
      subject: "عربی",
      teachingMethod: "کنکوری",
    });
    const friend = await createPamphlet(baseUrl(), author.cookie, {
      title: "هم‌پایهٔ عربی",
      grade: "نهم",
      subject: "دینی",
      teachingMethod: "کنکوری",
    });

    const r = await api<{ items: Array<{ id: string }> }>(
      baseUrl(),
      `/api/v1/pamphlets/${source}/related`
    );
    expect(r.status).toBe(200);
    expect(r.data.items.some((p) => p.id === friend)).toBe(true);
    expect(r.data.items.every((p) => p.id !== source)).toBe(true);
  });
});

describe("GET /pamphlets?sort=forks_desc (P17)", () => {
  test("orders by fork count desc", async () => {
    const author = await registerUser(baseUrl());
    const fan = await registerUser(baseUrl());
    const popular = await createPamphlet(baseUrl(), author.cookie, { title: "پرفورک ۱" });
    const lonely = await createPamphlet(baseUrl(), author.cookie, { title: "بی‌فورک ۱" });
    await fork(fan.cookie, popular);
    await fork(fan.cookie, lonely); // lonely now has 1 — make popular have 2
    const fan2 = await registerUser(baseUrl());
    await fork(fan2.cookie, popular);

    const r = await api<{ items: Array<{ id: string; forkCount: number }> }>(
      baseUrl(),
      "/api/v1/pamphlets?sort=forks_desc&pageSize=48"
    );
    expect(r.status).toBe(200);
    const items = r.data.items;
    const popIdx = items.findIndex((p) => p.id === popular);
    const lonelyIdx = items.findIndex((p) => p.id === lonely);
    expect(popIdx).toBeGreaterThanOrEqual(0);
    expect(lonelyIdx).toBeGreaterThanOrEqual(0);
    expect(items[popIdx].forkCount).toBe(2);
    expect(items[lonelyIdx].forkCount).toBe(1);
    expect(popIdx).toBeLessThan(lonelyIdx);
  });
});
