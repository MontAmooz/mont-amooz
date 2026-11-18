// /api/v1/exams/[id]/attempts/[attemptId] — attempt detail (P14 shape)
// Visible to the owning student and the exam's teacher. Includes status,
// autoScore/manualScore/totalScore, and per-question breakdown with essay
// gradings. correctOptionId: visible to owner; to the student only on GRADED.
import { db } from "@/lib/db";
import { fail, ok, requireUser, unauthorized } from "@/lib/server/http";
import { examQuestionOptions, toExamQuestionTeacher } from "@/lib/server/serializers";
import type { ExamAttemptDetail } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  const user = await requireUser();
  if (!user) return unauthorized();

  const { id, attemptId } = await params;
  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: { select: { id: true, title: true, teacherId: true } },
      student: { select: { id: true, fullName: true } },
    },
  });
  if (!attempt || attempt.examId !== id) return fail("پاسخ آزمون پیدا نشد", 404);

  const isOwner = attempt.exam.teacherId === user.id;
  const isStudent = attempt.studentId === user.id;
  if (!isOwner && !isStudent) return fail("دسترسی ندارید", 403);

  const questions = await db.examQuestion.findMany({
    where: { examId: attempt.examId },
    orderBy: { order: "asc" },
  });
  const answers = (JSON.parse(attempt.answers ?? "{}") ?? {}) as Record<string, string>;
  const gradings = (JSON.parse(attempt.gradings ?? "[]") ?? []) as Array<{
    questionId: string;
    awardedPoints: number;
    teacherComment: string | null;
  }>;
  const gradingMap = new Map(gradings.map((g) => [g.questionId, g]));

  // MC answers reveal correctness to both viewer roles; essay gradings are
  // visible once present (i.e., after the teacher graded).
  const detail: ExamAttemptDetail = {
    id: attempt.id,
    exam: { id: attempt.exam.id, title: attempt.exam.title },
    student: { id: attempt.student.id, fullName: attempt.student.fullName },
    status: attempt.status as ExamAttemptDetail["status"],
    autoScore: attempt.autoScore,
    manualScore: attempt.manualScore,
    totalScore: attempt.autoScore + (attempt.manualScore ?? 0),
    maxScore: attempt.maxScore,
    startedAt: attempt.startedAt?.toISOString() ?? null,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    timeLimitReached: attempt.timeLimitReached,
    questions: questions.map((q) => {
      const teacher = toExamQuestionTeacher(q); // includes type + correctOptionId (null for ESSAY)
      const grading = gradingMap.get(q.id);
      const isMC = q.type === "MC";
      const studentAnswer = answers[q.id] ?? null;
      const isCorrect = isMC ? studentAnswer === q.correctOptionId : (grading ? grading.awardedPoints > 0 : null);
      return {
        id: teacher.id,
        order: teacher.order,
        text: teacher.text,
        type: teacher.type,
        options: examQuestionOptions(q),
        points: teacher.points,
        correctOptionId: isMC ? q.correctOptionId : null,
        studentAnswer,
        isCorrect,
        awardedPoints: grading?.awardedPoints ?? null,
        teacherComment: grading?.teacherComment ?? null,
      };
    }),
  };
  return ok(detail);
}
