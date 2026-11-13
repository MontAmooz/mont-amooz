// /api/v1/pamphlets — GET (list/search/sort/paginate) + POST (create)
import { db } from "@/lib/db";
import {
  DIFFICULTIES,
  GRADES,
  SUBJECTS,
  TEACHING_METHODS,
} from "@/lib/constants";
import { countContentLines } from "@/lib/diff";
import { normalizePersian } from "@/lib/format";
import type { PamphletListResponse, PamphletSummary } from "@/lib/types";
import {
  asString,
  fail,
  ok,
  oneOf,
  readJson,
  requireUser,
  unauthorized,
} from "@/lib/server/http";
import { latestContent, pamphletSummaryInclude, toPamphletSummary } from "@/lib/server/serializers";

// ---------- GET: list ----------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get("query") ?? "").trim();
  const grade = url.searchParams.get("grade") ?? "";
  const subject = url.searchParams.get("subject") ?? "";
  const method = url.searchParams.get("method") ?? url.searchParams.get("teachingMethod") ?? "";
  const difficulty = url.searchParams.get("difficulty") ?? "";
  const sort = url.searchParams.get("sort") ?? "newest";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    48,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "12", 10) || 12)
  );

  // Dataset is small: fetch candidates with relations and filter in JS
  // (Persian-normalized search over title/description/subject/chapter/latest content
  // can't be expressed natively in Prisma/SQLite).
  const rows = await db.pamphlet.findMany({
    include: { ...pamphletSummaryInclude, versions: { select: { versionNumber: true, content: true }, orderBy: { versionNumber: "desc" } } },
  });

  const nq = normalizePersian(query);
  const filtered = rows.filter((p) => {
    if (grade && p.grade !== grade) return false;
    if (subject && p.subject !== subject) return false;
    if (method && p.teachingMethod !== method) return false;
    if (difficulty && p.difficulty !== difficulty) return false;
    if (nq) {
      const fields = [p.title, p.description ?? "", p.subject, p.chapter ?? "", latestContent(p.versions)];
      // ADR-0012 — attachment extractedText is searchable too
      const attachmentText = p.attachments
        .map((a) => a.extractedText ?? "")
        .join(" ");
      if (attachmentText) fields.push(attachmentText);
      const matched = fields.some((f) => normalizePersian(f).includes(nq));
      if (!matched) return false;
    }
    return true;
  });

  let items: PamphletSummary[] = filtered.map(toPamphletSummary);

  if (sort === "popular") {
    items.sort((a, b) => b.viewCount - a.viewCount);
  } else if (sort === "top") {
    items.sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount);
  } else {
    items.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  const total = items.length;
  const start = (page - 1) * pageSize;
  const response: PamphletListResponse = {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
  return ok(response);
}

// ---------- POST: create ----------
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const title = asString(body.title)?.trim() ?? "";
  if (title.length < 3 || title.length > 120) {
    return fail("عنوان باید بین ۳ تا ۱۲۰ نویسه باشد");
  }
  const description = asString(body.description)?.trim() ?? "";
  if (description.length > 500) return fail("توضیحات حداکثر ۵۰۰ نویسه است");
  const grade = oneOf(body.grade, GRADES);
  if (!grade) return fail("پایه تحصیلی انتخاب‌شده معتبر نیست");
  const subject = oneOf(body.subject, SUBJECTS);
  if (!subject) return fail("درس انتخاب‌شده معتبر نیست");
  const chapter = asString(body.chapter)?.trim() ?? "";
  if (chapter.length > 120) return fail("نام فصل حداکثر ۱۲۰ نویسه است");
  const teachingMethod = oneOf(body.teachingMethod, TEACHING_METHODS);
  if (!teachingMethod) return fail("روش تدریس انتخاب‌شده معتبر نیست");
  const difficulty = oneOf(body.difficulty, DIFFICULTIES);
  if (!difficulty) return fail("سطح دشواری انتخاب‌شده معتبر نیست");
  const content = asString(body.content) ?? "";
  if (content.trim().length < 30) {
    return fail("محتوای جزوه باید حداقل ۳۰ نویسه باشد");
  }

  const pamphlet = await db.pamphlet.create({
    data: {
      title,
      description: description || null,
      grade,
      subject,
      chapter: chapter || null,
      teachingMethod,
      difficulty,
      authorId: user.id,
      versions: {
        create: {
          versionNumber: 1,
          content,
          changeSummary: "انتشار نسخهٔ اول",
          createdById: user.id,
        },
      },
      contributions: {
        create: { userId: user.id, score: Math.max(countContentLines(content), 10) },
      },
    },
    select: { id: true },
  });
  return ok({ id: pamphlet.id }, 201);
}
