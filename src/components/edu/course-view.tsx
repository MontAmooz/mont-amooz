"use client";

// مُنت‌آموز — Phase 2 course detail (#/course/{id}): cover, lessons list (locked /
// watched / free-preview with inline preview player), reviews with upsert form,
// sticky aside for purchase with wallet + commission note.

import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Lock,
  PlayCircle,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/constants";
import { faDuration, faNumber, faRating, faRelative, faToman, toFaDigits } from "@/lib/format";
import type { CourseDetail, CourseReviewItem, LessonItem, WalletResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CourseCover, ErrorBox, InfoNote, InitialsAvatar, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { RatingStars } from "./rating-stars";
import { useEduStore } from "./store";

/* ---------------- lessons ---------------- */

function LessonRow({
  lesson,
  onOpen,
}: {
  lesson: LessonItem;
  onOpen: (lesson: LessonItem) => void;
}) {
  const locked = lesson.locked;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(lesson)}
        className={cn(
          "flex w-full items-center gap-3 border-b-2 border-gray-100 p-3 text-start transition-colors last:border-b-0 md:p-4",
          locked ? "cursor-not-allowed" : "hover:bg-gray-50"
        )}
        aria-label={
          locked
            ? `درس ${lesson.title} — قفل`
            : lesson.isFreePreview
              ? `پیش‌نمایش رایگان درس ${lesson.title}`
              : `درس ${lesson.title}`
        }
      >
        <span className="oeg-mono flex size-9 shrink-0 items-center justify-center border-2 border-ink bg-white text-sm font-black">
          {toFaDigits(lesson.order)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold md:text-base">{lesson.title}</span>
          {lesson.durationMinutes ? (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
              <Clock className="size-3" aria-hidden="true" /> {faDuration(lesson.durationMinutes)}
            </span>
          ) : null}
        </span>
        {lesson.isFreePreview && !locked && (
          <Badge className="border-2 border-gold bg-gold/15 px-1.5 text-[11px] font-black text-[#8a6a24]">
            پیش‌نمایش رایگان
          </Badge>
        )}
        {locked ? (
          <Lock className="size-5 shrink-0 text-gray-300" aria-hidden="true" />
        ) : lesson.watched ? (
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="دیده‌شده" />
        ) : (
          <PlayCircle className="size-5 shrink-0 text-primary" aria-hidden="true" />
        )}
      </button>
    </li>
  );
}

/* ---------------- reviews ---------------- */

function ReviewForm({
  courseId,
  initial,
  onDone,
}: {
  courseId: string;
  initial?: CourseReviewItem | null;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast({
        title: "امتیاز یادتان رفته",
        description: "با ستاره‌ها به این دوره امتیاز بدهید (۱ تا ۵).",
        variant: "destructive",
      });
      return;
    }
    if (comment.trim().length < 2) {
      toast({
        title: "متن بازخورد خیلی کوتاه است",
        description: "چند خط دربارهٔ محتوای دوره بنویسید.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      await api(`/courses/${courseId}/reviews`, {
        method: "POST",
        json: { rating, comment: comment.trim() },
      });
      toast({ title: "بازخورد شما ثبت شد؛ ممنون!" });
      onDone();
    } catch (err) {
      toast({
        title: "ثبت بازخورد ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border-2 border-ink bg-white p-4 md:p-5"
      aria-label={initial ? "ویرایش بازخورد شما" : "ثبت بازخورد جدید"}
    >
      <h3 className="font-black">{initial ? "بازخورد شما (قابل ویرایش)" : "ثبت بازخورد شما"}</h3>
      <p className="mt-1 text-xs text-gray-500">
        امتیاز و نظرتان دربارهٔ این دوره را بنویسید؛ برای معلم و دانشجویان بعدی ارزشمند است.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <RatingStars value={rating} onChange={setRating} size="lg" />
        <span className="oeg-mono text-sm font-bold text-gray-500">
          {rating > 0 ? `${toFaDigits(rating)} از ۵` : "بدون امتیاز"}
        </span>
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="مثلاً: توضیح‌های گام‌به‌گام فصل معادله‌ها عالی بود…"
        className="mt-4 min-h-24 border-2 bg-white leading-7"
      />
      <Button type="submit" disabled={busy} className="mt-3 h-11 border-2 border-ink font-black md:h-10">
        {busy && <Spinner />}
        {initial ? "به‌روزرسانی بازخورد" : "ثبت بازخورد"}
      </Button>
    </form>
  );
}

/* ---------------- main view ---------------- */

export default function CourseView({ id }: { id: string }) {
  const { toast } = useToast();
  const { user, openAuth } = useEduStore();

  const detail = useFetch<CourseDetail>(
    () => api<CourseDetail>(`/courses/${id}`),
    [id, user?.id] // refetch after login so enrolled/locked update
  );
  const wallet = useFetch<WalletResponse>(() => api<WalletResponse>("/wallet"), [user?.id], {
    enabled: !!user,
  });

  const [preview, setPreview] = useState<LessonItem | null>(null);
  const [buying, setBuying] = useState(false);

  if (detail.loading && !detail.data) {
    return <PageSkeleton />;
  }
  if (detail.error || !detail.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorBox message={detail.error ?? "دوره پیدا نشد."} onRetry={detail.retry} />
      </div>
    );
  }

  const course = detail.data;
  const balance = wallet.data?.balance ?? 0;
  const insufficient =
    !!user && !course.enrolled && !course.isMine && course.price > 0 && balance < course.price;

  async function purchase() {
    setBuying(true);
    try {
      await api(`/courses/${id}/purchase`, { method: "POST" });
      toast({
        title: "دوره خریداری شد!",
        description: "دسترسی مادام‌العمر است؛ از همین‌جا یادگیری را شروع کنید.",
      });
      detail.retry();
    } catch (err) {
      toast({
        title: "خرید دوره ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBuying(false);
    }
  }

  function openLesson(lesson: LessonItem) {
    if (lesson.locked) {
      toast({
        title: "این درس قفل است",
        description: "برای دسترسی، دوره را تهیه کنید.",
      });
      return;
    }
    if (course.enrolled || course.isMine) {
      navigate(`#/learn/${id}`);
      return;
    }
    setPreview(lesson); // free preview for anonymous / non-enrolled viewers
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <a
        href="#/courses"
        className="inline-flex h-9 items-center gap-1 text-sm font-bold text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowRight className="size-4" aria-hidden="true" /> همهٔ دوره‌ها
      </a>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ---------- main ---------- */}
        <div>
          <CourseCover
            src={course.coverUrl}
            title={course.title}
            className="aspect-video w-full border-2 border-ink"
          />

          <h1 className="mt-5 text-2xl font-black leading-snug md:text-3xl">{course.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-2 border-gray-200 px-2 font-bold text-gray-600">
              {course.grade}
            </Badge>
            <Badge variant="outline" className="border-2 border-gray-200 px-2 font-bold text-gray-600">
              {course.subject}
            </Badge>
            {course.level && (
              <Badge variant="outline" className="border-2 border-gold bg-gold/10 px-2 font-bold text-[#8a6a24]">
                {course.level}
              </Badge>
            )}
            <span className="ms-auto flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="size-3.5" aria-hidden="true" />
                {faNumber(course.studentCount)} دانشجو
              </span>
              <span className="flex items-center gap-1">
                <PlayCircle className="size-3.5" aria-hidden="true" />
                {faNumber(course.lessonCount)} درس
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" />
                {faDuration(course.totalMinutes)}
              </span>
            </span>
          </div>

          {/* teacher */}
          <div className="mt-5 flex items-center gap-3 border-2 border-ink bg-white p-4">
            <InitialsAvatar name={course.teacher.fullName} className="size-12 border-2 border-ink" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-400">سازندهٔ دوره</p>
              <a
                href={`#/user/${course.teacher.id}`}
                className="font-black text-primary hover:underline"
              >
                {course.teacher.fullName}
              </a>
              {course.teacher.title && (
                <p className="truncate text-xs text-gray-500">{course.teacher.title}</p>
              )}
            </div>
            <BadgeCheck className="size-5 shrink-0 text-success" aria-label="تأییدشده" />
          </div>

          {course.description && (
            <p className="mt-5 whitespace-pre-wrap border-s-4 border-gold bg-gold/5 p-4 text-sm leading-7 text-gray-700">
              {course.description}
            </p>
          )}

          {/* lessons */}
          <section className="mt-8" aria-label="درس‌های دوره">
            <h2 className="text-xl font-black">درس‌ها</h2>
            <ol className="mt-4 border-2 border-ink bg-white">
              {course.lessons.map((lesson) => (
                <LessonRow key={lesson.id} lesson={lesson} onOpen={openLesson} />
              ))}
            </ol>
            {course.isMine && course.salesCount != null && (
              <p className="mt-2 text-xs text-gray-400">
                {faNumber(course.salesCount)} فروش ثبت شده است.
              </p>
            )}
          </section>

          {/* reviews */}
          <section className="mt-10" aria-label="بازخوردهای دوره">
            <h2 className="text-xl font-black">بازخوردها</h2>
            <div className="mt-4 space-y-4">
              {course.canReview && (
                <ReviewForm
                  courseId={id}
                  initial={course.myReview}
                  onDone={detail.retry}
                />
              )}
              {course.reviews.length === 0 ? (
                <p className="border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                  هنوز بازخوردی برای این دوره ثبت نشده است.
                </p>
              ) : (
                <ul className="divide-y-2 divide-gray-100 border-2 border-ink bg-white">
                  {course.reviews.map((review) => (
                    <li key={review.id} className="p-4 md:p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <InitialsAvatar name={review.user.fullName} className="size-9 border-2 border-ink text-xs" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">
                            {review.user.fullName}
                            {review.user.id === user?.id && (
                              <span className="ms-2 text-xs font-bold text-primary">(شما)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">{faRelative(review.createdAt)}</p>
                        </div>
                        <span className="ms-auto flex items-center gap-1.5">
                          <RatingStars value={review.rating} />
                          <span className="oeg-mono text-xs font-bold text-gray-500">
                            {faRating(review.rating)}
                          </span>
                        </span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                        {review.comment}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* ---------- aside ---------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="خرید دوره">
          <div className="border-2 border-ink bg-white p-5">
            {course.enrolled ? (
              <div className="space-y-4">
                <p className="flex items-center gap-2 border-2 border-success bg-success/10 p-3 text-sm font-black text-success">
                  <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
                  شما دانشجوی این دوره هستید
                </p>
                <Button
                  onClick={() => navigate(`#/learn/${id}`)}
                  className="oeg-hard-shadow h-12 w-full border-2 border-ink text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  <PlayCircle className="size-5" aria-hidden="true" /> ادامهٔ یادگیری
                </Button>
              </div>
            ) : course.isMine ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-black">دورهٔ شماست</p>
                  <Badge
                    className={cn(
                      "border-2 px-2 font-black",
                      course.status === "PUBLISHED"
                        ? "border-success bg-success/10 text-success"
                        : "border-gray-300 bg-gray-100 text-gray-600"
                    )}
                  >
                    {course.status === "PUBLISHED" ? "منتشرشده" : "پیش‌نویس"}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("#/teach")}
                  className="h-11 w-full border-2 border-ink font-black md:h-10"
                >
                  مدیریت دوره
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="flex items-baseline gap-2">
                  {course.price === 0 ? (
                    <span className="text-3xl font-black text-success">رایگان</span>
                  ) : (
                    <>
                      <span className="oeg-mono text-3xl font-black">{faNumber(course.price)}</span>
                      <span className="text-sm font-bold text-gray-500">تومان</span>
                    </>
                  )}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-gray-400">
                  <RatingStars value={course.ratingAvg} />
                  <b className="oeg-mono">{faRating(course.ratingAvg)}</b>
                  <span className="oeg-mono">({faNumber(course.ratingCount)})</span>
                </p>

                {!user ? (
                  <Button
                    onClick={() => openAuth("برای تهیهٔ دوره ابتدا وارد حساب کاربری شوید.")}
                    className="h-12 w-full border-2 border-ink text-base font-black"
                  >
                    ورود برای تهیهٔ دوره
                  </Button>
                ) : (
                  <>
                    {wallet.data && (
                      <p className="text-xs text-gray-500">
                        موجودی کیف پول شما:{" "}
                        <b className="oeg-mono">{faToman(balance)}</b>
                      </p>
                    )}
                    {insufficient && (
                      <p className="border-2 border-danger bg-danger/10 p-2.5 text-xs font-bold text-danger" role="alert">
                        موجودی کافی نیست.{" "}
                        <button
                          type="button"
                          className="underline underline-offset-4"
                          onClick={() => navigate("#/wallet")}
                        >
                          شارژ کیف پول
                        </button>
                      </p>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          disabled={buying || insufficient}
                          className="oeg-hard-shadow h-12 w-full border-2 border-ink text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
                        >
                          {buying ? <Spinner /> : <ShoppingBag className="size-5" aria-hidden="true" />}
                          {course.price === 0 ? "ثبت‌نام رایگان" : "خرید با کیف پول"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-2 border-ink">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-black">
                            {course.price === 0 ? "ثبت‌نام در این دورهٔ رایگان؟" : "خرید این دوره؟"}
                          </AlertDialogTitle>
                          <AlertDialogDescription asChild>
                            <div className="space-y-2 leading-7">
                              <p>
                                {course.price === 0
                                  ? "با ثبت‌نام رایگان، دوره به فهرست «یادگیری من» اضافه می‌شود."
                                  : (
                                    <>
                                      مبلغ <b className="oeg-mono">{faToman(course.price)}</b> از کیف پول
                                      شما کسر می‌شود (موجودی فعلی:{" "}
                                      <b className="oeg-mono">{faToman(balance)}</b>).
                                    </>
                                  )}
                              </p>
                              {course.price > 0 && (
                                <p className="text-xs text-gray-500">
                                  {faNumber(100 - PLATFORM_COMMISSION_PERCENT)}٪ به معلم می‌رسد؛{" "}
                                  {faNumber(PLATFORM_COMMISSION_PERCENT)}٪ حق پلتفرم است. دسترسی شما
                                  مادام‌العمر است.
                                </p>
                              )}
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10" disabled={buying}>
                            انصراف
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.preventDefault();
                              void purchase();
                            }}
                            disabled={buying}
                            className="h-11 border-2 border-ink font-black md:h-10"
                          >
                            {buying && <Spinner />}
                            بله، {course.price === 0 ? "ثبت‌نام کن" : "بخر"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-4">
            <InfoNote>
              پس از تهیهٔ دوره، همهٔ درس‌ها باز می‌شوند و پیشرفت شما به‌صورت خودکار ذخیره می‌شود.
            </InfoNote>
          </div>
        </aside>
      </div>

      {/* free-preview inline player */}
      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="border-2 border-ink p-0 sm:max-w-2xl">
          <DialogHeader className="border-b-2 border-ink px-4 py-3">
            <DialogTitle className="text-base font-black">{preview?.title}</DialogTitle>
            <DialogDescription>پیش‌نمایش رایگان — ساخت دورهٔ {course.title}</DialogDescription>
          </DialogHeader>
          {preview?.videoUrl ? (
            <video
              controls
              className="aspect-video w-full bg-black"
              src={preview.videoUrl}
              poster={course.coverUrl ?? undefined}
            />
          ) : (
            <div className="aspect-video w-full bg-black" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
