// مُنت‌آموز — DB row → API-shape mappers shared by /api/v1 routes.
import { computePercentages } from "@/lib/diff";
import type { Prisma, Txn } from "@prisma/client";
import type {
  Contributor,
  CourseCard,
  CourseReviewItem,
  ExamOption,
  ExamQuestionType,
  ExamQuestionStudent,
  ExamQuestionTeacher,
  ExamSummary,
  InteractiveStepStudent,
  InteractiveStepTeacher,
  InteractiveStepType,
  LessonItem,
  MergeRequestItem,
  MRStatus,
  MySlotItem,
  PamphletSummary,
  ReviewItem,
  SessionItem,
  SessionMessageItem,
  SessionReviewItem,
  SlotItem,
  StepOption,
  TxnItem,
  TxnStatus,
  TxnType,
} from "@/lib/types";

/** Round to one decimal place. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Include payload with everything needed to build a PamphletSummary. */
export const pamphletSummaryInclude = {
  author: { select: { id: true, fullName: true, title: true } },
  forkedFrom: { select: { id: true, title: true } },
  reviews: { select: { rating: true } },
  versions: { select: { versionNumber: true, content: true } },
  forks: { select: { id: true } },
  // ADR-0012 — extractedText rides along for the JS-filter search pattern;
  // fileName so detail responses can map full attachment items from one include
  attachments: {
    select: {
      id: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      extractedText: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.PamphletInclude;

export type PamphletSummaryRow = Prisma.PamphletGetPayload<{
  include: typeof pamphletSummaryInclude;
}>;

/** File-extension shorthand for a stored attachment content type. */
export function attachmentExt(contentType: string): string {
  switch (contentType) {
    case "application/pdf":
      return "pdf";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "docx";
    case "application/msword":
      return "doc";
    case "text/markdown":
      return "md";
    default:
      return "txt";
  }
}

/** Map a pamphlet row (with relations) to the public PamphletSummary shape. */
export function toPamphletSummary(p: PamphletSummaryRow): PamphletSummary {
  const ratings = p.reviews.map((r) => r.rating);
  const ratingAvg = ratings.length
    ? round1(ratings.reduce((s, r) => s + r, 0) / ratings.length)
    : 0;
  const newest = [...p.attachments].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )[0];
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    grade: p.grade,
    subject: p.subject,
    chapter: p.chapter,
    teachingMethod: p.teachingMethod,
    difficulty: p.difficulty,
    viewCount: p.viewCount,
    ratingAvg,
    ratingCount: ratings.length,
    versionCount: p.versions.length,
    forkCount: p.forks.length,
    forkedFromId: p.forkedFromId,
    forkedFromTitle: p.forkedFrom?.title ?? null,
    author: {
      id: p.author.id,
      fullName: p.author.fullName,
      title: p.author.title,
    },
    hasAttachment: p.attachments.length > 0,
    attachmentType: newest ? attachmentExt(newest.contentType) : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Latest version content of a pamphlet (versions must be ordered desc). */
export function latestContent(versions: { content: string }[]): string {
  return versions[0]?.content ?? "";
}

/** Include payload for a merge request list item. */
export const mrInclude = {
  source: { select: { id: true, title: true } },
  target: { select: { id: true, title: true } },
  createdBy: { select: { id: true, fullName: true } },
  reviewedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.MergeRequestInclude;

export type MRRow = Prisma.MergeRequestGetPayload<{ include: typeof mrInclude }>;

/** Map a merge request row to the public MergeRequestItem shape. */
export function toMRItem(mr: MRRow): MergeRequestItem {
  return {
    id: mr.id,
    title: mr.title,
    description: mr.description,
    status: mr.status as MRStatus,
    source: { id: mr.source.id, title: mr.source.title },
    target: { id: mr.target.id, title: mr.target.title },
    createdBy: { id: mr.createdBy.id, fullName: mr.createdBy.fullName },
    reviewedBy: mr.reviewedBy
      ? { id: mr.reviewedBy.id, fullName: mr.reviewedBy.fullName }
      : null,
    reviewedAt: mr.reviewedAt ? mr.reviewedAt.toISOString() : null,
    createdAt: mr.createdAt.toISOString(),
    updatedAt: mr.updatedAt.toISOString(),
  };
}

/** Include payload for a review with votes. */
export const reviewInclude = {
  user: { select: { id: true, fullName: true, title: true } },
  votes: { select: { userId: true, value: true } },
} satisfies Prisma.ReviewInclude;

export type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

/** Map a review row to the public ReviewItem shape (helpful = base + live votes). */
export function toReviewItem(r: ReviewRow, currentUserId?: string | null): ReviewItem {
  const helpful = r.helpfulBase + r.votes.filter((v) => v.value === 1).length;
  const unhelpful = r.unhelpfulBase + r.votes.filter((v) => v.value === -1).length;
  const item: ReviewItem = {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    helpful,
    unhelpful,
    createdAt: r.createdAt.toISOString(),
    user: { id: r.user.id, fullName: r.user.fullName, title: r.user.title },
  };
  if (currentUserId) {
    item.myVote = r.votes.find((v) => v.userId === currentUserId)?.value ?? 0;
  }
  return item;
}

/** Build the contributor list (percentages sum to 100), sorted by share. */
export function buildContributors(
  contributions: { userId: string; score: number; user: { fullName: string } }[],
  pamphletAuthorId: string
): Contributor[] {
  return computePercentages(
    contributions.map((c) => ({
      userId: c.userId,
      fullName: c.user.fullName,
      score: c.score,
      isAuthor: c.userId === pamphletAuthorId,
    }))
  ).sort((a, b) => b.percentage - a.percentage || b.score - a.score);
}

// ===================== Phase 2 — Teaching Marketplace =====================

/** Map a Txn row to the public TxnItem shape. */
export function toTxnItem(t: Txn): TxnItem {
  return {
    id: t.id,
    type: t.type as TxnType,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    description: t.description,
    status: t.status as TxnStatus,
    refType: t.refType,
    refId: t.refId,
    createdAt: t.createdAt.toISOString(),
  };
}

/** Slot end time = start + duration. */
export function slotEndAt(slot: { startAt: Date; durationMinutes: number }): Date {
  return new Date(slot.startAt.getTime() + slot.durationMinutes * 60_000);
}

/** Map a TeacherSlot row to the public SlotItem shape. */
export function toSlotItem(s: {
  id: string;
  startAt: Date;
  durationMinutes: number;
  price: number;
  status: string;
}): SlotItem {
  return {
    id: s.id,
    startAt: s.startAt.toISOString(),
    endAt: slotEndAt(s).toISOString(),
    durationMinutes: s.durationMinutes,
    price: s.price,
    status: s.status as SlotItem["status"],
  };
}

/** Include payload for a teacher's own slot list (with the booked session, if any). */
export const mySlotInclude = {
  session: {
    select: {
      id: true,
      status: true,
      topic: true,
      student: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.TeacherSlotInclude;

export type MySlotRow = Prisma.TeacherSlotGetPayload<{ include: typeof mySlotInclude }>;

/** Map a TeacherSlot row (with session) to the public MySlotItem shape. */
export function toMySlotItem(s: MySlotRow): MySlotItem {
  const item: MySlotItem = toSlotItem(s);
  const sess = s.session;
  const live =
    sess && sess.status !== "CANCELLED_STUDENT" && sess.status !== "CANCELLED_TEACHER";
  item.session = live ? { id: sess.id, student: sess.student, topic: sess.topic } : null;
  return item;
}

/** Include payload for a class session row. */
export const sessionInclude = {
  teacher: { select: { id: true, fullName: true, title: true } },
  student: { select: { id: true, fullName: true, title: true } },
  review: {
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: { select: { id: true, fullName: true, title: true } },
    },
  },
} satisfies Prisma.ClassSessionInclude;

export type SessionRow = Prisma.ClassSessionGetPayload<{ include: typeof sessionInclude }>;

/** Map a SessionReview row (already selected) to the public SessionReviewItem shape. */
export function toSessionReviewItem(r: {
  id: string;
  rating: number;
  comment: string;
  createdAt: Date;
  user: { id: string; fullName: string; title?: string | null };
}): SessionReviewItem {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    user: { id: r.user.id, fullName: r.user.fullName, title: r.user.title },
  };
}

/** Map a class session row to the public SessionItem shape (viewer-aware). */
export function toSessionItem(s: SessionRow, viewerId: string): SessionItem {
  const myRole: SessionItem["myRole"] = s.teacherId === viewerId ? "teacher" : "student";
  return {
    id: s.id,
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
    durationMinutes: s.durationMinutes,
    price: s.price,
    teacherShare: s.teacherShare,
    commission: s.commission,
    status: s.status as SessionItem["status"],
    meetingCode: s.meetingCode,
    topic: s.topic,
    teacher: { id: s.teacher.id, fullName: s.teacher.fullName, title: s.teacher.title },
    student: { id: s.student.id, fullName: s.student.fullName, title: s.student.title },
    myRole,
    canJoin: s.status === "BOOKED",
    hasReview: !!s.review,
  };
}

/** Map a SessionMessage row to the public SessionMessageItem shape. */
export function toSessionMessageItem(m: {
  id: string;
  body: string;
  createdAt: Date;
  sender: { id: string; fullName: string };
}): SessionMessageItem {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    sender: { id: m.sender.id, fullName: m.sender.fullName },
  };
}

/** Include payload with everything needed to build a CourseCard. */
export const courseCardInclude = {
  teacher: { select: { id: true, fullName: true, title: true } },
  lessons: { select: { durationMinutes: true } },
  enrollments: { select: { id: true } },
  reviews: { select: { rating: true } },
} satisfies Prisma.VideoCourseInclude;

export type CourseCardRow = Prisma.VideoCourseGetPayload<{ include: typeof courseCardInclude }>;

/** Map a course row (with relations) to the public CourseCard shape. */
export function toCourseCard(c: CourseCardRow): CourseCard {
  const ratings = c.reviews.map((r) => r.rating);
  const ratingAvg = ratings.length
    ? round1(ratings.reduce((s, r) => s + r, 0) / ratings.length)
    : 0;
  return {
    id: c.id,
    title: c.title,
    coverUrl: c.coverUrl,
    grade: c.grade,
    subject: c.subject,
    level: c.level,
    price: c.price,
    ratingAvg,
    ratingCount: ratings.length,
    studentCount: c.enrollments.length,
    lessonCount: c.lessons.length,
    totalMinutes: c.lessons.reduce((s, l) => s + (l.durationMinutes ?? 0), 0),
    teacher: { id: c.teacher.id, fullName: c.teacher.fullName, title: c.teacher.title },
  };
}

/** Map a CourseReview row (already selected) to the public CourseReviewItem shape. */
export function toCourseReviewItem(r: {
  id: string;
  rating: number;
  comment: string;
  createdAt: Date;
  user: { id: string; fullName: string; title?: string | null };
}): CourseReviewItem {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    user: { id: r.user.id, fullName: r.user.fullName, title: r.user.title },
  };
}

/** Map a VideoLesson row to the public LessonItem shape (videoUrl only when unlocked). */
export function toLessonItem(
  l: {
    id: string;
    order: number;
    title: string;
    description?: string | null;
    durationMinutes?: number | null;
    isFreePreview: boolean;
    videoUrl: string;
  },
  opts: { unlocked: boolean; watched?: boolean }
): LessonItem {
  const item: LessonItem = {
    id: l.id,
    order: l.order,
    title: l.title,
    description: l.description,
    durationMinutes: l.durationMinutes,
    isFreePreview: l.isFreePreview,
    locked: !opts.unlocked,
  };
  if (opts.watched !== undefined) item.watched = opts.watched;
  if (opts.unlocked) item.videoUrl = l.videoUrl;
  return item;
}

// ===================== P12 — Exam Builder =====================

export type ExamRow = {
  id: string;
  title: string;
  description: string | null;
  grade: string;
  subject: string;
  published: boolean;
  durationMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
  teacher: { id: string; fullName: string; title: string | null };
  _count?: { questions: number; attempts: number };
  attempts?: Array<{ score: number; maxScore: number }>;
};

/** Map an exam row (with counts / attempt scores) to the public summary. */
export function toExamSummary(e: ExamRow): ExamSummary {
  const attempts = e.attempts ?? [];
  const avgScore =
    attempts.length > 0
      ? round1(
          (attempts.reduce((s, a) => s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0), 0) /
            attempts.length)
        )
      : null;
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    grade: e.grade,
    subject: e.subject,
    published: e.published,
    durationMinutes: e.durationMinutes,
    questionCount: e._count?.questions ?? 0,
    attemptCount: e._count?.attempts ?? 0,
    avgScore,
    teacher: { id: e.teacher.id, fullName: e.teacher.fullName, title: e.teacher.title },
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export type ExamQuestionRow = {
  id: string;
  order: number;
  text: string;
  type: string; // "MC" | "ESSAY"
  options: string | null; // JSON [{id, text}] — MC only
  correctOptionId: string | null;
  points: number;
};

/** Parse a question row's options JSON (defensive against malformed data). */
export function examQuestionOptions(row: Pick<ExamQuestionRow, "options">): ExamOption[] {
  if (!row.options) return [];
  try {
    const parsed: unknown = JSON.parse(row.options);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is ExamOption =>
        !!o && typeof o === "object" && typeof (o as ExamOption).id === "string" && typeof (o as ExamOption).text === "string"
    );
  } catch {
    return [];
  }
}

/** Map a question row to the teacher shape (includes correctOptionId; null for ESSAY). */
export function toExamQuestionTeacher(row: ExamQuestionRow): ExamQuestionTeacher {
  return {
    id: row.id,
    order: row.order,
    text: row.text,
    type: (row.type as ExamQuestionType) ?? "MC",
    options: row.type === "MC" ? examQuestionOptions(row) : null,
    points: row.points,
    correctOptionId: row.correctOptionId,
  };
}

/** Map a question row to the student shape (correctOptionId stripped; options null for ESSAY). */
export function toExamQuestionStudent(row: ExamQuestionRow): ExamQuestionStudent {
  return {
    id: row.id,
    order: row.order,
    text: row.text,
    type: (row.type as ExamQuestionType) ?? "MC",
    options: row.type === "MC" ? examQuestionOptions(row) : null,
    points: row.points,
  };
}

/** Validate an exam-questions payload → normalized rows, or a Persian error.
 * P14: question type "MC" (options + correctOptionIndex required) or "ESSAY"
 * (options/correctOptionIndex forbidden). */
export function parseExamQuestions(
  raw: unknown
): {
  text: string;
  type: "MC" | "ESSAY";
  options: ExamOption[] | null;
  correctOptionId: string | null;
  points: number;
}[] | string {
  if (!Array.isArray(raw) || raw.length < 1) return "آزمون باید بین ۱ تا ۵۰ سؤال داشته باشد";
  if (raw.length > 50) return "آزمون باید بین ۱ تا ۵۰ سؤال داشته باشد";

  const out: {
    text: string;
    type: "MC" | "ESSAY";
    options: ExamOption[] | null;
    correctOptionId: string | null;
    points: number;
  }[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") return "داده‌های سؤال نامعتبر است";
    const item = q as Record<string, unknown>;
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (text.length < 2 || text.length > 500) {
      return "متن سؤال باید بین ۲ تا ۵۰۰ نویسه باشد";
    }
    let points = 1;
    if (item.points !== undefined && item.points !== null) {
      if (typeof item.points !== "number" || !Number.isInteger(item.points) || item.points < 1 || item.points > 10) {
        return "امتیاز هر سؤال باید بین ۱ تا ۱۰ باشد";
      }
      points = item.points;
    }
    const type = item.type === "ESSAY" ? "ESSAY" : item.type === "MC" ? "MC" : undefined;
    if (!type) return "نوع سؤال باید «چهارگزینه‌ای» یا «تشریحی» باشد";

    if (type === "ESSAY") {
      // essay questions must not carry options or a correct index
      if (item.options !== undefined && item.options !== null) {
        return "سؤال تشریحی نباید گزینه داشته باشد";
      }
      if (item.correctOptionIndex !== undefined && item.correctOptionIndex !== null) {
        return "سؤال تشریحی نباید گزینه داشته باشد";
      }
      out.push({ text, type: "ESSAY", options: null, correctOptionId: null, points });
      continue;
    }

    // MC path — options + correct index required
    if (!Array.isArray(item.options)) return "هر سؤال باید بین ۲ تا ۴ گزینه داشته باشد";
    const optionTexts: string[] = [];
    for (const o of item.options) {
      const t = typeof o === "object" && o !== null && typeof (o as Record<string, unknown>).text === "string"
        ? ((o as Record<string, unknown>).text as string).trim()
        : "";
      if (t.length < 1 || t.length > 200) return "هر سؤال باید بین ۲ تا ۴ گزینه داشته باشد";
      optionTexts.push(t);
    }
    if (optionTexts.length < 2 || optionTexts.length > 4) {
      return "هر سؤال باید بین ۲ تا ۴ گزینه داشته باشد";
    }
    const correctIndex = item.correctOptionIndex;
    if (
      typeof correctIndex !== "number" ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= optionTexts.length
    ) {
      return "گزینهٔ صحیح نامعتبر است";
    }
    const options: ExamOption[] = optionTexts.map((t) => ({ id: crypto.randomUUID(), text: t }));
    out.push({ text, type: "MC", options, correctOptionId: options[correctIndex].id, points });
  }
  return out;
}

// ===================== P15 — Interactive Learning =====================

export type InteractiveStepRow = {
  id: string;
  order: number;
  type: string; // "TEXT" | "MC" | "NUMERIC"
  content: string;
  options: string | null; // JSON [{id, text}] — MC only
  correctOptionId: string | null;
  correctNumeric: number | null;
  tolerance: number | null;
  explanation: string | null;
};

/** Map a step row to the teacher shape (includes the correct answers). */
export function toInteractiveStepTeacher(row: InteractiveStepRow): InteractiveStepTeacher {
  return {
    id: row.id,
    order: row.order,
    type: (row.type as InteractiveStepType) ?? "TEXT",
    content: row.content,
    options: row.type === "MC" ? examQuestionOptions(row) : null,
    tolerance: row.tolerance,
    explanation: row.explanation,
    correctOptionId: row.correctOptionId,
    correctNumeric: row.correctNumeric,
  };
}

/** Map a step row to the student shape — correctOptionId/correctNumeric stripped. */
export function toInteractiveStepStudent(row: InteractiveStepRow): InteractiveStepStudent {
  return {
    id: row.id,
    order: row.order,
    type: (row.type as InteractiveStepType) ?? "TEXT",
    content: row.content,
    options: row.type === "MC" ? examQuestionOptions(row) : null,
    tolerance: row.tolerance,
    explanation: row.explanation,
  };
}

export type ParsedLessonStep = {
  type: "TEXT" | "MC" | "NUMERIC";
  content: string;
  options: StepOption[] | null; // MC only
  correctOptionId: string | null;
  correctNumeric: number | null;
  tolerance: number | null;
  explanation: string | null;
};

/** Validate an interactive-lesson steps payload → normalized rows, or a Persian error.
 * Client sends correctOptionIndex for MC; option ids are generated server-side. */
export function parseInteractiveSteps(raw: unknown): ParsedLessonStep[] | string {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 40) {
    return "درس باید بین ۲ تا ۴۰ گام داشته باشد";
  }

  const out: ParsedLessonStep[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") return "داده‌های گام نامعتبر است";
    const item = s as Record<string, unknown>;
    const content = typeof item.content === "string" ? item.content.trim() : "";
    if (content.length < 2 || content.length > 5000) {
      return "متن گام باید بین ۲ تا ۵۰۰۰ نویسه باشد";
    }
    let explanation: string | null = null;
    if (item.explanation !== undefined && item.explanation !== null) {
      if (typeof item.explanation !== "string") return "داده‌های گام نامعتبر است";
      const e = item.explanation.trim();
      if (e.length > 2000) return "توضیح گام حداکثر ۲۰۰۰ نویسه است";
      explanation = e || null;
    }

    if (item.type === "TEXT") {
      out.push({ type: "TEXT", content, options: null, correctOptionId: null, correctNumeric: null, tolerance: null, explanation });
      continue;
    }

    if (item.type === "MC") {
      if (!Array.isArray(item.options)) return "هر گام چندگزینه‌ای باید بین ۲ تا ۴ گزینه داشته باشد";
      const optionTexts: string[] = [];
      for (const o of item.options) {
        const t =
          typeof o === "object" && o !== null && typeof (o as Record<string, unknown>).text === "string"
            ? ((o as Record<string, unknown>).text as string).trim()
            : "";
        if (t.length < 1 || t.length > 200) return "متن هر گزینه باید بین ۱ تا ۲۰۰ نویسه باشد";
        optionTexts.push(t);
      }
      if (optionTexts.length < 2 || optionTexts.length > 4) {
        return "هر گام چندگزینه‌ای باید بین ۲ تا ۴ گزینه داشته باشد";
      }
      const correctIndex = item.correctOptionIndex;
      if (
        typeof correctIndex !== "number" ||
        !Number.isInteger(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= optionTexts.length
      ) {
        return "گزینهٔ صحیح نامعتبر است";
      }
      const options: StepOption[] = optionTexts.map((t) => ({ id: crypto.randomUUID(), text: t }));
      out.push({
        type: "MC", content, options, correctOptionId: options[correctIndex].id,
        correctNumeric: null, tolerance: null, explanation,
      });
      continue;
    }

    if (item.type === "NUMERIC") {
      if (typeof item.correctNumeric !== "number" || !Number.isFinite(item.correctNumeric)) {
        return "پاسخ صحیح عددی معتبر نیست";
      }
      let tolerance: number | null = null;
      if (item.tolerance !== undefined && item.tolerance !== null) {
        if (typeof item.tolerance !== "number" || !Number.isFinite(item.tolerance) || item.tolerance < 0) {
          return "تلورانس نمی‌تواند منفی باشد";
        }
        tolerance = item.tolerance;
      }
      out.push({
        type: "NUMERIC", content, options: null, correctOptionId: null,
        correctNumeric: item.correctNumeric, tolerance, explanation,
      });
      continue;
    }

    return "نوع گام باید «متن»، «چندگزینه‌ای» یا «عددی» باشد";
  }
  return out;
}
