// POST /api/v1/exams/[id]/attempts/[attemptId]/grade — teacher grades ESSAY answers (P14)
import { db } from "@/lib/db";
import { fail, ok, readJson, requireUser, unauthorized } from "@/lib/server/http";
import { notify } from "@/lib/server/notify";

interface GradingEntry {
  questionId: string;
  awardedPoints: number;
  teacherComment?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id, attemptId } = await params;
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        select: {
          id: true,
          title: true,
          teacherId: true,
          questions: { select: { id: true, type: true, points: true } },
        },
      },
      student: { select: { id: true, fullName: true } },
    },
  });
  if (!attempt || attempt.examId !== id) return fail("پاسخ آزمون پیدا نشد", 404);
  if (attempt.exam.teacherId !== user.id) return fail("فقط معلم می‌تواند تصحیح کند", 403);
  if (attempt.status !== "SUBMITTED") return fail("این آزمون در وضعیت تصحیح نیست");

  const body = await readJson(req);
  if (!body || !Array.isArray(body.gradings)) return fail("داده‌های ارسالی نامعتبر است");

  const essayQuestions = attempt.exam.questions.filter((q) => q.type === "ESSAY");
  const essayMap = new Map(essayQuestions.map((q) => [q.id, q]));

  const gradings: Array<{ questionId: string; awardedPoints: number; teacherComment: string | null }> = [];
  let manualScore = 0;
  for (const raw of body.gradings) {
    if (!raw || typeof raw !== "object") return fail("داده‌های ارسالی نامعتبر است");
    const g = raw as Record<string, unknown>;
    const questionId = typeof g.questionId === "string" ? g.questionId : "";
    const q = essayMap.get(questionId);
    if (!q) return fail("سؤال تشریحی ناموجود یا نامعتبر", 400);
    const awarded = g.awardedPoints;
    if (typeof awarded !== "number" || !Number.isInteger(awarded) || awarded < 0 || awarded > q.points) {
      return fail("امتیاز هر سؤال باید بین ۰ تا سقف همان سؤال باشد");
    }
    const comment = typeof g.teacherComment === "string" ? g.teacherComment.trim() : "";
    if (comment.length > 1000) return fail("توضیح معلم حداکثر ۱۰۰۰ نویسه است");
    manualScore += awarded;
    gradings.push({
      questionId,
      awardedPoints: awarded,
      teacherComment: comment || null,
    });
  }
  if (gradings.length === 0) return fail("داده‌های ارسالی نامعتبر است");

  const totalScore = attempt.autoScore + manualScore;
  await db.examAttempt.update({
    where: { id: attemptId },
    data: {
      manualScore,
      gradings: JSON.stringify(gradings),
      status: "GRADED",
      score: totalScore, // legacy field now holds the final total
    },
  });

  // P14 — notify the student that their exam has been graded
  await notify({
    userId: attempt.studentId,
    actorId: user.id,
    type: "EXAM_GRADED",
    title: "آزمون شما تصحیح شد",
    body: `آزمون «${attempt.exam.title}» تصحیح شد — امتیاز نهایی: ${totalScore} از ${attempt.maxScore}`,
    linkUrl: `#/exam/${attempt.exam.id}`,
    relatedId: attempt.exam.id,
    relatedType: "exam",
  });

  return ok({ status: "GRADED", manualScore, totalScore });
}
