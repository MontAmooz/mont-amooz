// /api/v1/exams — GET (list, published by default; mine=true for the owner)
// + POST (teacher creates with questions) (P12)
import { db } from "@/lib/db";
import { GRADES, SUBJECTS } from "@/lib/constants";
import { normalizePersian } from "@/lib/format";
import { asString, fail, ok, oneOf, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { parseExamQuestions, toExamSummary } from "@/lib/server/serializers";
import type { ExamListResponse } from "@/lib/types";

// ---------- GET: list ----------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get("query") ?? "").trim();
  const grade = url.searchParams.get("grade") ?? "";
  const subject = url.searchParams.get("subject") ?? "";
  const mine = url.searchParams.get("mine") === "true";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    48,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "12", 10) || 12)
  );

  const user = mine ? await requireUser() : null;
  if (mine && !user) return unauthorized();

  // dataset is small: fetch candidates + JS filter (same pattern as pamphlets)
  const rows = await db.exam.findMany({
    where: {
      ...(mine && user ? { teacherId: user.id } : { published: true }),
      ...(grade ? { grade } : {}),
      ...(subject ? { subject } : {}),
    },
    include: {
      teacher: { select: { id: true, fullName: true, title: true } },
      _count: { select: { questions: true, attempts: true } },
      attempts: { select: { score: true, maxScore: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const nq = normalizePersian(query);
  const filtered = nq
    ? rows.filter((e) =>
        [e.title, e.description ?? ""].some((f) => normalizePersian(f).includes(nq))
      )
    : rows;

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const response: ExamListResponse = {
    items: filtered.slice(start, start + pageSize).map(toExamSummary),
    total,
    page,
    pageSize,
  };
  return ok(response);
}

// ---------- POST: create (teacher only) ----------
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  if (user.role !== "معلم") return fail("فقط معلم می‌تواند آزمون بسازد", 403);

  const body = await readJson(req);
  if (!body) return fail("داده‌های ارسالی نامعتبر است");

  const title = asString(body.title)?.trim() ?? "";
  if (title.length < 3 || title.length > 120) {
    return fail("عنوان آزمون باید بین ۳ تا ۱۲۰ نویسه باشد");
  }
  const description = asString(body.description)?.trim() ?? "";
  if (description.length > 2000) return fail("توضیحات آزمون حداکثر ۲۰۰۰ نویسه است");
  const grade = oneOf(body.grade, GRADES);
  if (!grade) return fail("پایه نامعتبر است");
  const subject = oneOf(body.subject, SUBJECTS);
  if (!subject) return fail("درس نامعتبر است");
  const published = body.published === true;

  const questions = parseExamQuestions(body.questions);
  if (typeof questions === "string") return fail(questions);

  const exam = await db.exam.create({
    data: {
      teacherId: user.id,
      title,
      description: description || null,
      grade,
      subject,
      published,
      questions: {
        create: questions.map((q, i) => ({
          order: i + 1,
          text: q.text,
          options: JSON.stringify(q.options),
          correctOptionId: q.correctOptionId,
          points: q.points,
        })),
      },
    },
    select: { id: true },
  });
  return ok({ id: exam.id }, 201);
}
