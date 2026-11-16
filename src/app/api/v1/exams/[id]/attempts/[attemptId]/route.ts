// /api/v1/exams/[id]/attempts/[attemptId] — attempt detail (student-own or exam-owner) (P12)
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
  const answers = JSON.parse(attempt.answers) as Record<string, string>;

  const detail: ExamAttemptDetail = {
    id: attempt.id,
    exam: { id: attempt.exam.id, title: attempt.exam.title },
    student: { id: attempt.student.id, fullName: attempt.student.fullName },
    score: attempt.score,
    maxScore: attempt.maxScore,
    submittedAt: attempt.submittedAt.toISOString(),
    questions: questions.map((q) => {
      const teacher = toExamQuestionTeacher(q); // includes correctOptionId
      const myOptionId = answers[q.id] ?? "";
      return {
        id: teacher.id,
        order: teacher.order,
        text: teacher.text,
        options: examQuestionOptions(q),
        points: teacher.points,
        correctOptionId: teacher.correctOptionId,
        myOptionId,
        isCorrect: myOptionId === teacher.correctOptionId,
      };
    }),
  };
  return ok(detail);
}
