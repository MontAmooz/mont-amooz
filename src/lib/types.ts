// مُنت‌آموز — shared API types (used by both server routes and client)

export interface PublicUser {
  id: string;
  fullName: string;
  title?: string | null;
  bio?: string | null;
  expertise?: string | null;
  role: string;
  createdAt: string;
}

export interface PamphletAuthor {
  id: string;
  fullName: string;
  title?: string | null;
}

export interface PamphletSummary {
  id: string;
  title: string;
  description?: string | null;
  grade: string;
  subject: string;
  chapter?: string | null;
  teachingMethod: string;
  difficulty: string;
  viewCount: number;
  ratingAvg: number;
  ratingCount: number;
  versionCount: number;
  forkCount: number;
  forkedFromId?: string | null;
  forkedFromTitle?: string | null;
  author: PamphletAuthor;
  hasAttachment: boolean;
  attachmentType?: string | null; // "pdf" | "docx" | …
  createdAt: string;
  updatedAt: string;
}

/** ADR-0012 — attachment metadata as exposed by the API (never storageKey). */
export interface PamphletAttachmentItem {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  signedUrl: string;
  createdAt: string;
}

export interface VersionSummary {
  id: string;
  versionNumber: number;
  changeSummary?: string | null;
  createdAt: string;
  createdBy: PamphletAuthor;
}

export interface Contributor {
  userId: string;
  fullName: string;
  score: number;
  percentage: number;
  isAuthor: boolean;
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  helpful: number;
  unhelpful: number;
  createdAt: string;
  user: PamphletAuthor;
  myVote?: number; // 1 | -1 | 0
}

export interface PamphletDetail extends PamphletSummary {
  content: string;
  latestVersionNumber: number;
  versions: VersionSummary[];
  contributors: Contributor[];
  attachments: PamphletAttachmentItem[];
  openMergeRequestCount: number;
  isMine: boolean;
  myReview?: ReviewItem | null;
}

export type MRStatus = "OPEN" | "MERGED" | "REJECTED";

export interface MergeRequestItem {
  id: string;
  title: string;
  description?: string | null;
  status: MRStatus;
  source: { id: string; title: string };
  target: { id: string; title: string };
  createdBy: PamphletAuthor;
  reviewedBy?: PamphletAuthor | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MRDiff {
  added: string[];
  removed: string[];
  addedCount: number;
  removedCount: number;
}

export interface MRDetail extends MergeRequestItem {
  sourceContent: string;
  targetContent: string;
  diff: MRDiff;
  canReview: boolean;
}

export interface PlatformStats {
  pamphlets: number;
  teachers: number;
  versions: number;
  reviews: number;
  forks: number;
  mergeRequests: number;
  mergedCount: number;
}

export interface TopTeacher {
  id: string;
  fullName: string;
  title?: string | null;
  expertise?: string | null;
  pamphletCount: number;
  mergedCount: number;
  avgRating: number;
}

export interface UserProfile {
  user: PublicUser;
  pamphlets: PamphletSummary[];
  stats: {
    pamphletCount: number;
    mergedCount: number;
    avgRating: number;
    linesContributed: number;
    reviewCount: number;
  };
}

export interface PamphletListResponse {
  items: PamphletSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// ===================== Phase 2 — Teaching Marketplace =====================

export type TxnType =
  | "DEPOSIT"
  | "WITHDRAW"
  | "SESSION_PAYMENT"
  | "SESSION_REFUND"
  | "SESSION_EARNING"
  | "COURSE_PURCHASE"
  | "COURSE_EARNING";

export type TxnStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface TxnItem {
  id: string;
  type: TxnType;
  amount: number; // signed Toman (+ credit / − debit)
  balanceAfter: number;
  description: string;
  status: TxnStatus;
  refType?: string | null;
  refId?: string | null;
  createdAt: string;
}

export interface WalletResponse {
  balance: number;
  transactions: TxnItem[]; // last 50, newest first
}

/** Mock gateway — POST /wallet/deposit returns the authority to "pay" against. */
export interface DepositRequestResponse {
  authority: string;
  amount: number;
}

export type SlotStatus = "OPEN" | "BOOKED" | "BLOCKED";

export interface SlotItem {
  id: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  price: number;
  status: SlotStatus;
}

/** Teacher's own slot list entry (GET /slots/mine). */
export interface MySlotItem extends SlotItem {
  session?: { id: string; student: { id: string; fullName: string }; topic?: string | null } | null;
}

export type SessionStatus =
  | "BOOKED"
  | "COMPLETED"
  | "CANCELLED_STUDENT"
  | "CANCELLED_TEACHER";

export interface SessionItem {
  id: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  price: number;
  teacherShare: number;
  commission: number;
  status: SessionStatus;
  meetingCode: string;
  topic?: string | null;
  teacher: { id: string; fullName: string; title?: string | null };
  student: { id: string; fullName: string; title?: string | null };
  myRole: "teacher" | "student";
  canJoin: boolean; // status === BOOKED
  hasReview: boolean;
}

export interface SessionMessageItem {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; fullName: string };
}

export interface SessionReviewItem {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user: { id: string; fullName: string; title?: string | null };
}

export interface SessionDetail extends SessionItem {
  messages: SessionMessageItem[]; // last 100 ascending
  myReview?: SessionReviewItem | null;
}

/** GET /sessions/[id]/join → ticket for the socket.io classroom service. */
export interface JoinTicketResponse {
  ticket: string;
  meetingCode: string;
  room: string; // "session:{id}"
  role: "teacher" | "student";
  me: { id: string; fullName: string };
}

export interface MarketTeacher {
  id: string;
  fullName: string;
  title?: string | null;
  bio?: string | null;
  expertise?: string | null;
  openSlotCount: number;
  minPrice: number | null;
  sessionCount: number; // completed sessions taught
  avgSessionRating: number; // 0..5, 0 if none
  ratingCount: number;
  pamphletCount: number;
}

export type CourseCardLevel = string | null;

export interface CourseCard {
  id: string;
  title: string;
  coverUrl?: string | null;
  grade: string;
  subject: string;
  level: CourseCardLevel;
  price: number; // Toman; 0 = free
  ratingAvg: number;
  ratingCount: number;
  studentCount: number;
  lessonCount: number;
  totalMinutes: number;
  teacher: { id: string; fullName: string; title?: string | null };
}

export interface CourseListResponse {
  items: CourseCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CourseReviewItem {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user: { id: string; fullName: string; title?: string | null };
}

export interface LessonItem {
  id: string;
  order: number;
  title: string;
  description?: string | null;
  durationMinutes?: number | null;
  isFreePreview: boolean;
  locked: boolean; // true when viewer can't watch
  watched?: boolean; // present when enrolled
  videoUrl?: string; // ONLY included when unlocked (enrolled/owner/free-preview)
}

export interface CourseDetail extends CourseCard {
  description?: string | null;
  status: "DRAFT" | "PUBLISHED";
  isMine: boolean;
  enrolled: boolean;
  canReview: boolean; // enrolled && !isMine
  lessons: LessonItem[];
  reviews: CourseReviewItem[];
  myReview?: CourseReviewItem | null;
  salesCount?: number; // only for the owner
}

export interface EnrolledCourse extends CourseCard {
  enrolledAt: string;
  watchedLessons: number;
  progressPercent: number; // 0..100
  nextLessonId: string | null;
}

/** Teacher-profile marketplace info added to GET /users/[id]. */
export interface UserProfileTeach {
  openSlots: number;
  minSlotPrice: number | null;
  completedSessions: number;
  avgSessionRating: number;
  sessionRatingCount: number;
  courseCount: number;
}
