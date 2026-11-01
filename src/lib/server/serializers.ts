// مُنت‌آموز — DB row → API-shape mappers shared by /api/v1 routes.
import { computePercentages } from "@/lib/diff";
import type { Prisma, Txn } from "@prisma/client";
import type {
  Contributor,
  CourseCard,
  CourseReviewItem,
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
} satisfies Prisma.PamphletInclude;

export type PamphletSummaryRow = Prisma.PamphletGetPayload<{
  include: typeof pamphletSummaryInclude;
}>;

/** Map a pamphlet row (with relations) to the public PamphletSummary shape. */
export function toPamphletSummary(p: PamphletSummaryRow): PamphletSummary {
  const ratings = p.reviews.map((r) => r.rating);
  const ratingAvg = ratings.length
    ? round1(ratings.reduce((s, r) => s + r, 0) / ratings.length)
    : 0;
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
