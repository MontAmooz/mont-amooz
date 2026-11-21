// GET /api/v1/users/me/dashboard — the signed-in user's unified learning
// dashboard (P18): summary counts, up-next (session + lesson) and the 20 most
// recent activities merged from interactive-lesson progress, exam attempts,
// course enrollments and completed sessions. Cumulative only — no time
// windowing (schema is frozen; reuses the P1/P9/P12/P15 models).
import { db } from "@/lib/db";
import { toFaDigits } from "@/lib/format";
import { ok, requireUser, unauthorized } from "@/lib/server/http";
import type {
  StudentDashboard,
  DashboardActivity,
  DashboardSummary,
  DashboardUpcoming,
} from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const now = new Date();

  // ===== Interactive lesson progress (P15) =====
  const lessonProgress = await db.interactiveLessonProgress.findMany({
    where: { userId: user.id },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          _count: { select: { steps: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const totalLessonsAvailable = await db.interactiveLesson.count({
    where: { published: true },
  });

  // ===== Graded exam attempts (P12/P14) =====
  const examAttempts = await db.examAttempt.findMany({
    where: { studentId: user.id, status: "GRADED" },
    include: {
      exam: { select: { id: true, title: true } },
    },
    orderBy: { submittedAt: "desc" },
    take: 50,
  });

  // ===== Course enrollments (P9) + batched watch progress (learn/route pattern) =====
  const enrollments = await db.courseEnrollment.findMany({
    where: { studentId: user.id },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          _count: { select: { lessons: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const courseLessons = enrollments.length
    ? await db.videoLesson.findMany({
        where: { courseId: { in: enrollments.map((e) => e.courseId) } },
        select: { id: true, courseId: true },
      })
    : [];
  const watchedRows = courseLessons.length
    ? await db.lessonProgress.findMany({
        where: {
          userId: user.id,
          lessonId: { in: courseLessons.map((l) => l.id) },
          watched: true,
        },
        select: { lessonId: true },
      })
    : [];
  const watchedSet = new Set(watchedRows.map((r) => r.lessonId));

  const enrollmentProgress = enrollments.map((e) => {
    const total = e.course._count.lessons;
    const watched = courseLessons.filter(
      (l) => l.courseId === e.courseId && watchedSet.has(l.id)
    ).length;
    return {
      enrollment: e,
      watched,
      total,
      pct: total > 0 ? Math.round((watched / total) * 100) : 0,
    };
  });

  // ===== Sessions attended as a student (P2) =====
  const studentSessions = await db.classSession.findMany({
    where: { studentId: user.id },
    include: { teacher: { select: { fullName: true } } },
    orderBy: { startAt: "desc" },
    take: 50,
  });

  // ===== Up next =====
  const nextStudentSession = await db.classSession.findFirst({
    where: { studentId: user.id, status: "BOOKED", startAt: { gt: now } },
    include: {
      teacher: { select: { fullName: true } },
      student: { select: { fullName: true } },
    },
    orderBy: { startAt: "asc" },
  });
  const nextTeacherSession = await db.classSession.findFirst({
    where: { teacherId: user.id, status: "BOOKED", startAt: { gt: now } },
    include: {
      teacher: { select: { fullName: true } },
      student: { select: { fullName: true } },
    },
    orderBy: { startAt: "asc" },
  });

  const nextSession = nextStudentSession
    ? {
        id: nextStudentSession.id,
        topic: nextStudentSession.topic,
        startAt: nextStudentSession.startAt.toISOString(),
        teacherName: nextStudentSession.teacher.fullName,
        studentName: nextStudentSession.student.fullName,
        role: "student" as const,
      }
    : nextTeacherSession
      ? {
          id: nextTeacherSession.id,
          topic: nextTeacherSession.topic,
          startAt: nextTeacherSession.startAt.toISOString(),
          teacherName: nextTeacherSession.teacher.fullName,
          studentName: nextTeacherSession.student.fullName,
          role: "teacher" as const,
        }
      : null;

  // Next lesson to continue = least-recently-touched unfinished progress
  const nextLessonProgress = lessonProgress
    .filter((p) => !p.completed)
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())[0];

  const nextLesson = nextLessonProgress
    ? {
        lessonId: nextLessonProgress.lessonId,
        lessonTitle: nextLessonProgress.lesson.title,
        currentStep: nextLessonProgress.currentStep,
        totalSteps: nextLessonProgress.lesson._count.steps,
      }
    : null;

  const upcoming: DashboardUpcoming = { nextSession, nextLesson };

  // ===== Summary =====
  const completedLessons = lessonProgress.filter((p) => p.completed).length;

  const examsWithScore = examAttempts.filter((a) => a.maxScore > 0);
  const averageScorePct =
    examsWithScore.length > 0
      ? Math.round(
          examsWithScore.reduce(
            (s, a) => (s + ((a.autoScore + (a.manualScore ?? 0)) / a.maxScore) * 100),
            0
          ) / examsWithScore.length
        )
      : null;

  const coursesWithLessons = enrollmentProgress.filter((p) => p.total > 0);
  const averageProgressPct =
    coursesWithLessons.length > 0
      ? Math.round(
          coursesWithLessons.reduce((s, p) => s + p.pct, 0) / coursesWithLessons.length
        )
      : null;

  const sessionsAttended = studentSessions.filter(
    (s) => s.status === "COMPLETED"
  ).length;
  const sessionsUpcoming = studentSessions.filter(
    (s) => s.status === "BOOKED" && s.startAt > now
  ).length;

  const summary: DashboardSummary = {
    interactiveLessons: {
      started: lessonProgress.length,
      completed: completedLessons,
      totalAvailable: totalLessonsAvailable,
    },
    exams: { taken: examAttempts.length, averageScorePct },
    courses: { enrolled: enrollments.length, averageProgressPct },
    sessions: { attended: sessionsAttended, upcoming: sessionsUpcoming },
  };

  // ===== Recent activity (merged, newest first, 20 items) =====
  const activities: DashboardActivity[] = [];

  for (const p of lessonProgress) {
    const total = p.lesson._count.steps;
    const pct = total > 0 ? Math.round((p.currentStep / total) * 100) : 0;
    activities.push({
      type: "lesson",
      id: p.lesson.id,
      title: p.lesson.title,
      subtitle: p.completed
        ? "تکمیل شد"
        : `گام ${toFaDigits(p.currentStep)} از ${toFaDigits(total)}`,
      updatedAt: p.updatedAt.toISOString(),
      linkUrl: `#/lesson/${p.lesson.id}`,
      progressPct: pct,
    });
  }

  for (const a of examAttempts) {
    const total = a.autoScore + (a.manualScore ?? 0);
    const pct = a.maxScore > 0 ? Math.round((total / a.maxScore) * 100) : 0;
    activities.push({
      type: "exam",
      id: a.exam.id,
      title: a.exam.title,
      subtitle: `امتیاز ${toFaDigits(total)} از ${toFaDigits(a.maxScore)}`,
      updatedAt: (a.submittedAt ?? a.startedAt ?? new Date()).toISOString(),
      linkUrl: `#/exam/${a.exam.id}`,
      scorePct: pct,
    });
  }

  for (const p of enrollmentProgress) {
    activities.push({
      type: "course",
      id: p.enrollment.course.id,
      title: p.enrollment.course.title,
      subtitle: `${toFaDigits(p.watched)} از ${toFaDigits(p.total)} درس`,
      updatedAt: p.enrollment.createdAt.toISOString(),
      linkUrl: `#/course/${p.enrollment.course.id}`,
      progressPct: p.pct,
    });
  }

  for (const s of studentSessions) {
    if (s.status !== "COMPLETED") continue;
    activities.push({
      type: "session",
      id: s.id,
      title: s.topic ?? "جلسهٔ تدریس",
      subtitle: `با ${s.teacher.fullName}`,
      updatedAt: (s.endAt ?? s.startAt).toISOString(),
      linkUrl: `#/session/${s.id}`,
    });
  }

  activities.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  const recent = activities.slice(0, 20);

  const result: StudentDashboard = { summary, upcoming, recent };
  return ok(result);
}
