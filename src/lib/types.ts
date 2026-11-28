// مُنت‌آموز — shared API types (used by both server routes and client)

export interface PublicUser {
  id: string;
  fullName: string;
  title?: string | null;
  bio?: string | null;
  expertise?: string | null;
  role: string;
  /** P10 — founder-only admin flag (drives the پنل مدیریت UI guard). */
  isAdmin?: boolean;
  createdAt: string;
}

/** P10 — row of GET /admin/users (founder-only user management). */
export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isAdmin: boolean;
  suspendedAt: string | null;
  createdAt: string;
  walletBalance: number | null;
  pamphletCount: number;
  commentCount: number;
  enrollmentCount: number;
}

/** P11 — one in-app notification. */
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  relatedType: string | null;
  relatedId: string | null;
  readAt: string | null;
  createdAt: string;
}

// ===================== P12 — Exam Builder (P14: essay + timer) =====================

export type ExamOption = { id: string; text: string };
export type ExamQuestionType = "MC" | "ESSAY";
export type ExamAttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "GRADED";

export interface ExamSummary {
  id: string;
  title: string;
  description: string | null;
  grade: string;
  subject: string;
  published: boolean;
  durationMinutes: number | null;
  questionCount: number;
  attemptCount: number;
  /** mean percentage 0-100 across attempts; null when no attempts */
  avgScore: number | null;
  teacher: { id: string; fullName: string; title: string | null };
  createdAt: string;
  updatedAt: string;
}

/** Question shape for students — correctOptionId stripped; options null for ESSAY. */
export interface ExamQuestionStudent {
  id: string;
  order: number;
  text: string;
  type: ExamQuestionType;
  options: ExamOption[] | null;
  points: number;
}

/** Question shape for the owner (teacher) only. correctOptionId null for ESSAY. */
export interface ExamQuestionTeacher extends ExamQuestionStudent {
  correctOptionId: string | null;
}

export interface ExamDetailTeacher extends ExamSummary {
  questions: ExamQuestionTeacher[];
  isMine: true;
}

export interface ExamDetailStudent extends ExamSummary {
  questions: ExamQuestionStudent[];
  isMine: false;
  myAttempt: {
    id: string;
    status: ExamAttemptStatus;
    autoScore: number;
    manualScore: number | null;
    score: number;
    maxScore: number;
    submittedAt: string | null;
  } | null;
}

export type ExamDetail = ExamDetailTeacher | ExamDetailStudent;

export interface ExamAttemptDetail {
  id: string;
  exam: { id: string; title: string };
  student: { id: string; fullName: string };
  status: ExamAttemptStatus;
  autoScore: number;
  manualScore: number | null;
  totalScore: number;
  maxScore: number;
  startedAt: string | null;
  submittedAt: string | null;
  timeLimitReached: boolean;
  questions: Array<{
    id: string;
    order: number;
    text: string;
    type: ExamQuestionType;
    options: ExamOption[] | null;
    points: number;
    correctOptionId: string | null;
    studentAnswer: string | null;
    isCorrect: boolean | null;
    awardedPoints: number | null;
    teacherComment: string | null;
  }>;
}

export interface MyExamAttemptSummary {
  id: string;
  exam: { id: string; title: string; grade: string; subject: string };
  status: ExamAttemptStatus;
  autoScore: number;
  manualScore: number | null;
  score: number;
  maxScore: number;
  submittedAt: string | null;
}

export interface ExamListResponse {
  items: ExamSummary[];
  total: number;
  page: number;
  pageSize: number;
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
  /** P17 — inline HTML preview URL (Word/Markdown/text); null for PDF */
  htmlUrl: string | null;
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
  commentCount: number;
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

// ===================== P15 — Interactive Learning =====================

export type InteractiveStepType = "TEXT" | "MC" | "NUMERIC" | "FILL_BLANK" | "IMAGE";

export type StepOption = { id: string; text: string };

/** FILL_BLANK — a blank as the STUDENT sees it (correctAnswer stripped; P21). */
export type FillBlankSpec = {
  id: string;
  hint?: string;
  caseSensitive: boolean;
};

/** A step as a student sees it — correct answers are NEVER included. */
export type InteractiveStepStudent = {
  id: string;
  order: number;
  type: InteractiveStepType;
  content: string;
  options: StepOption[] | null; // MC only
  tolerance: number | null; // NUMERIC only
  explanation: string | null; // shown after a wrong answer
  // P21 — FILL_BLANK (correctAnswer stripped; graded per-blank, all-or-nothing)
  blanks: FillBlankSpec[] | null;
  // P21 — IMAGE
  imageUrl: string | null;
  imageCaption: string | null;
  // P21 — branching targets as { id, order } (flow control, not an answer leak;
  // null = sequential advance / retry same step)
  nextOnCorrect: { id: string; order: number } | null;
  nextOnWrong: { id: string; order: number } | null;
};

export type InteractiveStepTeacher = InteractiveStepStudent & {
  correctOptionId: string | null; // MC only
  correctNumeric: number | null; // NUMERIC only
  // P21 — FILL_BLANK answers for the owner
  blankAnswers: { id: string; correctAnswer: string; caseSensitive: boolean }[] | null;
};

export type LessonSummary = {
  id: string;
  title: string;
  description: string | null;
  grade: string;
  subject: string;
  published: boolean;
  estimatedMinutes: number | null;
  stepCount: number;
  teacher: { id: string; fullName: string; title: string | null };
  createdAt: string;
  updatedAt: string;
  /** participants with any progress — populated for owner listings (mine=true) */
  participantCount?: number;
  /** The viewer's own progress (only when authenticated). */
  myProgress: {
    currentStep: number;
    completed: boolean;
    startedAt: string;
    completedAt: string | null;
  } | null;
};

export type LessonDetailTeacher = LessonSummary & {
  isMine: true;
  steps: InteractiveStepTeacher[];
  /** any student progress exists → steps locked for editing (server-enforced) */
  hasProgress: boolean;
};

export type LessonDetailStudent = LessonSummary & {
  isMine: false;
  steps: InteractiveStepStudent[];
  /** my progress detail (for the player), null when not started */
  progress: {
    currentStep: number;
    completed: boolean;
    responses: Record<string, { answer: string; correct: boolean; attempts: number }>;
  } | null;
};

export type LessonDetail = LessonDetailTeacher | LessonDetailStudent;

export type AdvanceResult =
  | {
      // wrong answer — cursor stays on the step (retry) unless the step has a
      // nextOnWrong branch, in which case currentStep names the jump target
      correct: false;
      explanation: string | null;
      currentStep: number;
      completed: false;
    }
  | {
      // correct — advance (sequential or via nextOnCorrect branch; may complete)
      correct: true;
      explanation: string | null;
      currentStep: number; // new current step (or unchanged when completed)
      completed: boolean;
      /** present only when the lesson just completed; graded steps (MC + NUMERIC + FILL_BLANK) */
      summary?: {
        totalSteps: number; // graded steps (not TEXT/IMAGE — they have no answer)
        firstTryCorrect: number;
        totalAttempts: number;
      };
    };

export type MyLessonProgressSummary = {
  lesson: { id: string; title: string; grade: string; subject: string };
  currentStep: number;
  stepCount: number;
  completed: boolean;
  startedAt: string;
  completedAt: string | null;
};

/** Compact published-lesson card on a teacher profile (GET /users/[id]). */
export type TeacherLessonCard = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  estimatedMinutes: number | null;
  stepCount: number;
};

// ===================== P17 — teacher analytics =====================

export interface TeacherAnalyticsItem {
  id: string;
  title: string;
  subject: string;
  grade: string;
  viewCount: number;
  versionCount: number;
  reviewCount: number;
  forkCount: number;
  mergeRequestCount: number;
  updatedAt: string;
}

export interface TeacherAnalytics {
  items: TeacherAnalyticsItem[];
  summary: {
    pamphletCount: number;
    totalViews: number;
    totalForks: number;
    totalReviews: number;
    totalMRs: number;
  };
}

/** GET /pamphlets/[id]/related — up to 6 same-subject / same-grade+method. */
export interface RelatedPamphletsResponse {
  items: PamphletSummary[];
}

// ===================== P18 — student learning dashboard =====================

export type DashboardActivityType = "lesson" | "exam" | "course" | "session";

export type DashboardActivity = {
  type: DashboardActivityType;
  id: string; // resource id (lesson, exam, course, session)
  title: string; // lesson/exam/course title, or session topic
  subtitle: string; // e.g. «گام ۳ از ۷», «امتیاز ۸ از ۱۰», «۳ از ۵ درس»
  updatedAt: string;
  linkUrl: string; // client hash URL
  progressPct?: number; // 0-100 (lessons, courses)
  scorePct?: number; // 0-100 (exams)
};

export type DashboardSummary = {
  interactiveLessons: {
    started: number;
    completed: number;
    totalAvailable: number;
  };
  exams: {
    taken: number;
    averageScorePct: number | null; // 0-100, null if none taken
  };
  courses: {
    enrolled: number;
    averageProgressPct: number | null; // 0-100, null if none
  };
  sessions: {
    attended: number; // COMPLETED only
    upcoming: number; // BOOKED and in the future
  };
};

export type DashboardUpcoming = {
  nextSession: {
    id: string;
    topic: string | null;
    startAt: string;
    teacherName: string; // the session's teacher
    studentName: string; // the session's student (shown when the viewer teaches)
    role: "student" | "teacher"; // viewer's role in this session
  } | null;
  nextLesson: {
    lessonId: string;
    lessonTitle: string;
    currentStep: number;
    totalSteps: number;
  } | null;
};

export type StudentDashboard = {
  summary: DashboardSummary;
  upcoming: DashboardUpcoming;
  recent: DashboardActivity[]; // max 20, sorted by updatedAt desc
};

// ===================== P19 — pamphlet Q&A =====================

export type CommentAuthor = {
  id: string;
  fullName: string;
  title: string | null;
  isAdmin: boolean;
  isPamphletAuthor: boolean; // true if this author owns the pamphlet
};

export type PamphletCommentItem = {
  id: string;
  body: string; // empty string if deleted
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
  isMine: boolean;
  replies: PamphletCommentItem[]; // always empty for replies (single-level)
};

export type CommentListResponse = {
  items: PamphletCommentItem[]; // top-level only; replies nested
  total: number; // count of top-level + replies
};

// ===================== P20 — moderation =====================

export type ReportTargetType = "pamphlet" | "comment";
export type ReportReason = "spam" | "copyright" | "inappropriate" | "harassment" | "other";
export type ReportStatus = "PENDING" | "DISMISSED" | "ACTION_TAKEN";

export type ReportItem = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetSummary: string; // short preview (pamphlet title or comment body excerpt)
  targetUrl: string; // "#/pamphlet/[id]" or the pamphlet URL hosting the comment
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  reporter: { id: string; fullName: string };
  reviewedBy: { id: string; fullName: string } | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type ReportListResponse = {
  items: ReportItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminDashboard = {
  metrics: {
    totalUsers: number;
    newUsersLast7Days: number;
    suspendedUsers: number;
    totalPamphlets: number;
    hiddenPamphlets: number;
    totalComments: number;
    totalExams: number;
    totalLessons: number;
    pendingReports: number;
  };
  recentReports: ReportItem[]; // last 5
  recentSignups: AdminUserRow[]; // last 5
};
