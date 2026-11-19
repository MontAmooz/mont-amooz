"use client";

// مُنت‌آموز — interactive-lesson player (#/lesson/[id], P15):
//  · owner (teacher): management panel — steps with correct answers, publish
//    toggle, edit/delete, steps locked note when participants exist
//  · student: sequential player — TEXT (ادامه) / MC (radio + بررسی) / NUMERIC
//    (input + بررسی); wrong → explanation + تلاش دوباره; correct → درست! +
//    گام بعدی; last correct → completion screen. Resume from the server's
//    currentStep; the server is the only grading authority (/advance).
// P15 decision: the owner sees a management panel here (like exam-view) —
// navigating teachers to a bare editor redirect felt wrong and the teach
// panel links here as the "owner view".

import { ArrowRight, CheckCircle2, Pencil, Trash2, Users, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { computeFirstTryCorrect } from "@/lib/lesson-grading";
import { faNumber } from "@/lib/format";
import type {
  AdvanceResult,
  InteractiveStepStudent,
  LessonDetail,
  LessonDetailTeacher,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { AuthRequiredBox, EmptyBox, ErrorBox, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";
import { MarkdownViewer } from "./markdown-viewer";

type StepFeedback = { correct: boolean; explanation: string | null } | null;
type CompletionSummary = { totalSteps: number; firstTryCorrect: number; totalAttempts: number };

export function LessonPlayerView({ id }: { id: string }) {
  const { user, sessionLoaded } = useEduStore();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const detail = useFetch<LessonDetail>(
    () => api<LessonDetail>(`/interactive-lessons/${id}`),
    [id, user?.id]
  );

  if (!sessionLoaded) return <PageSkeleton />;
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <AuthRequiredBox
          title="برای دنبال‌کردن درس تعاملی وارد حساب کاربری شوید"
          hint="پیشرفت و پاسخ‌های شما با نام کاربری ثبت می‌شود — ورود رایگان است."
        />
      </div>
    );
  }

  if (detail.loading && !detail.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10" aria-busy="true">
        <PageSkeleton />
      </div>
    );
  }
  if (detail.error || !detail.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorBox message={detail.error ?? "درس پیدا نشد."} onRetry={detail.retry} />
      </div>
    );
  }

  const lesson = detail.data;

  async function togglePublish() {
    if (!lesson) return;
    setBusy(true);
    try {
      await api(`/interactive-lessons/${lesson.id}`, {
        method: "PATCH",
        json: { published: !lesson.published },
      });
      toast({
        title: lesson.published ? "درس از حالت انتشار خارج شد" : "درس منتشر شد",
        description: lesson.published
          ? "دانش‌آموزان دیگر آن را نمی‌بینند."
          : "دانش‌آموزان می‌توانند یادگیری را شروع کنند.",
      });
      detail.retry();
    } catch (err) {
      toast({
        title: "تغییر وضعیت ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!lesson) return;
    setBusy(true);
    try {
      await api(`/interactive-lessons/${lesson.id}`, { method: "DELETE" });
      toast({ title: "درس حذف شد" });
      navigate(lesson.published ? "#/lessons" : "#/lessons?mine=true");
    } catch (err) {
      toast({
        title: "حذف ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setDeleteOpen(false);
    }
  }

  /* ---------- owner (teacher) panel ---------- */
  if (lesson.isMine) {
    const t = lesson as LessonDetailTeacher;
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <LessonHeader lesson={t} />
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`#/lesson/${t.id}/edit`)}
            className="h-11 border-2 border-ink font-black md:h-10"
          >
            <Pencil className="size-4" aria-hidden="true" /> ویرایش
          </Button>
          <Button
            variant="outline"
            onClick={() => void togglePublish()}
            disabled={busy}
            className={cn(
              "h-11 border-2 font-black md:h-10",
              t.published ? "border-gold text-[#8a6a24] hover:bg-gold/10" : "border-ink"
            )}
          >
            {busy ? <Spinner /> : t.published ? "لغو انتشار" : "انتشار درس"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="h-11 border-2 border-danger font-bold text-danger hover:bg-danger/10 md:h-10"
          >
            <Trash2 className="size-4" aria-hidden="true" /> حذف
          </Button>
        </div>

        {t.hasProgress && (
          <div className="mt-6 border-2 border-gold bg-gold/10 p-3 text-sm font-medium text-[#7a5c1e]">
            این درس شرکت‌کننده دارد؛ گام‌ها دیگر قابل ویرایش نیستند (فقط مشخصات کلی قابل تغییر است).
          </div>
        )}

        <h2 className="mt-8 text-lg font-black">گام‌های درس ({faNumber(t.steps.length)})</h2>
        <ol className="mt-4 space-y-4">
          {t.steps.map((s) => (
            <li key={s.id} className="border-2 border-ink bg-white p-4 md:p-5">
              <div className="flex items-start gap-3">
                <span className="oeg-mono flex size-8 shrink-0 items-center justify-center border-2 border-ink bg-gray-50 text-xs font-black">
                  {faNumber(s.order + 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-400">
                    {s.type === "TEXT" ? "متن" : s.type === "MC" ? "چندگزینه‌ای" : "عددی"}
                  </p>
                  <div className="mt-1 text-sm leading-7">
                    <MarkdownViewer content={s.content} />
                  </div>
                  {s.type === "MC" && s.options ? (
                    <ul className="mt-2 space-y-1.5">
                      {s.options.map((o) => (
                        <li
                          key={o.id}
                          className={cn(
                            "flex items-center gap-2 border px-3 py-1.5 text-sm",
                            o.id === s.correctOptionId
                              ? "border-success bg-success/10 font-bold text-success"
                              : "border-gray-200 text-gray-600"
                          )}
                        >
                          {o.text}
                          {o.id === s.correctOptionId && (
                            <span className="ms-auto text-xs">گزینهٔ صحیح</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {s.type === "NUMERIC" && (
                    <p className="mt-2 border-2 border-success bg-success/10 px-3 py-1.5 text-sm font-bold text-success">
                      پاسخ صحیح: <span className="oeg-mono">{faNumber(s.correctNumeric ?? 0)}</span>
                      {s.tolerance ? ` (± ${faNumber(s.tolerance)})` : ""}
                    </p>
                  )}
                  {s.explanation && (
                    <p className="mt-2 border-2 border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-6 text-gray-500">
                      توضیح پاسخ اشتباه: {s.explanation}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="border-2 border-ink sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black">حذف درس؟</DialogTitle>
              <DialogDescription>
                «{t.title}» به‌همراه همهٔ گام‌ها و پیشرفت ثبت‌شده حذف می‌شود. این کار قابل بازگشت نیست.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} className="h-11 border-2 border-ink font-bold">
                انصراف
              </Button>
              <Button
                onClick={() => void remove()}
                disabled={busy}
                className="h-11 border-2 border-danger bg-danger font-black text-white hover:bg-danger/90"
              >
                {busy && <Spinner />} حذف درس
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ---------- student player ---------- */
  // NOTE: the player never refetches mid-game — useFetch's retry() drops data
  // (loading), which would unmount the player and wipe the in-memory feedback/
  // step state. Server progress is read once at mount; the summary comes from
  // the completing response. Fresh data arrives on the next navigation.
  return <StudentPlayer key={`${lesson.id}-${lesson.progress?.completed ? "done" : "open"}`} lesson={lesson} />;
}

function LessonHeader({ lesson }: { lesson: LessonDetail }) {
  return (
    <div>
      <a href="#/lessons" className="text-sm font-bold text-gray-500 hover:text-primary">
        ← بازگشت به درس‌های تعاملی
      </a>
      <h1 className="mt-3 text-2xl font-black leading-snug md:text-3xl">{lesson.title}</h1>
      {lesson.description && <p className="mt-2 text-sm leading-7 text-gray-600">{lesson.description}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-2 border-ink px-2 font-bold">پایهٔ {lesson.grade}</Badge>
        <Badge variant="outline" className="border-2 border-ink px-2 font-bold">{lesson.subject}</Badge>
        {!lesson.published && (
          <Badge variant="outline" className="border-2 border-gold px-2 font-bold text-[#8a6a24]">پیش‌نویس</Badge>
        )}
        {lesson.estimatedMinutes && (
          <Badge variant="outline" className="border-2 border-primary px-2 font-bold text-primary">
            ~{faNumber(lesson.estimatedMinutes)} دقیقه
          </Badge>
        )}
        <span className="oeg-mono flex items-center gap-1 text-xs text-gray-500">
          <Users className="size-3.5" aria-hidden="true" /> {faNumber(lesson.stepCount)} گام
        </span>
        <span className="text-xs text-gray-500">دبیر: {lesson.teacher.fullName}</span>
      </div>
    </div>
  );
}

/* ================= student player ================= */

function StudentPlayer({
  lesson,
}: {
  lesson: Extract<LessonDetail, { isMine: false }>;
}) {
  const { toast } = useToast();
  // server truth at mount — the only resume source (P15 escape-hatch #3)
  const initial = lesson.progress;

  const [dismissedResume, setDismissedResume] = useState(false);
  const [currentStep, setCurrentStep] = useState(initial?.currentStep ?? 0);
  const [completed, setCompleted] = useState(initial?.completed ?? false);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<StepFeedback>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepList = lesson.steps;
  const step: InteractiveStepStudent | null =
    !completed && currentStep < stepList.length ? stepList[currentStep] : null;
  const gradedTotal = stepList.filter((s) => s.type !== "TEXT").length;

  async function advance(stepIndex: number, value: string | null) {
    setSubmitting(true);
    try {
      const res = await api<AdvanceResult>(
        `/interactive-lessons/${lesson.id}/advance`,
        { method: "POST", json: { stepIndex, answer: value } }
      );
      if (!res.correct) {
        setFeedback({ correct: false, explanation: res.explanation });
      } else if (!res.completed) {
        setCurrentStep(res.currentStep);
        if (step?.type === "TEXT") {
          // TEXT advance IS the «ادامه» click — show the next step immediately
          setAnswer("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          setFeedback({ correct: true, explanation: null });
        }
      } else {
        setCompletionSummary(res.summary ?? null);
        setCompleted(true);
        setFeedback(null);
        setAnswer("");
        toast({ title: "درس تکمیل شد! 🎉" });
      }
    } catch (err) {
      toast({
        title: "ارسال پاسخ ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function continueAfterCorrect() {
    setFeedback(null);
    setAnswer("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* completed → summary screen (summary from the completing response, or the
   * server-truth responses after a remount) */
  if (completed) {
    const { firstTryCorrect, totalAttempts } =
      completionSummary ?? computeFirstTryCorrect(initial?.responses ?? {});
    const pct = gradedTotal > 0 ? Math.round((firstTryCorrect / gradedTotal) * 100) : 100;
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <LessonHeader lesson={lesson} />
        <div className="mt-8 border-2 border-success bg-success/5 p-8 text-center" role="status">
          <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-black">درس را تکمیل کردید! 🎉</h2>
          <p className="mt-2 text-sm leading-7 text-gray-600">
            تمام {faNumber(stepList.length)} گام را با موفقیت پشت سر گذاشتید.
          </p>
          <dl className="mx-auto mt-6 grid max-w-md grid-cols-3 border-2 border-ink bg-white">
            <div className="p-3">
              <dt className="text-xs text-gray-500">تمرین‌ها</dt>
              <dd className="oeg-mono mt-1 text-xl font-black">{faNumber(gradedTotal)}</dd>
            </div>
            <div className="border-s-2 border-ink p-3">
              <dt className="text-xs text-gray-500">از اولین تلاش</dt>
              <dd className={cn("oeg-mono mt-1 text-xl font-black", pct >= 80 ? "text-success" : "text-gold")}>
                {faNumber(firstTryCorrect)}
              </dd>
            </div>
            <div className="border-s-2 border-ink p-3">
              <dt className="text-xs text-gray-500">کل تلاش‌ها</dt>
              <dd className="oeg-mono mt-1 text-xl font-black">{faNumber(totalAttempts)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-gray-400">
            هر درس یک‌بار تکمیل می‌شود — محتوای گام‌ها برای مرور در اختیار دبیر درس است.
          </p>
          <Button
            onClick={() => navigate("#/lessons")}
            className="oeg-hard-shadow mt-6 h-12 border-2 border-ink px-8 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            بازگشت به درس‌ها
          </Button>
        </div>
      </div>
    );
  }

  if (!step) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <LessonHeader lesson={lesson} />
        <div className="mt-8">
          <EmptyBox title="گامی برای نمایش نیست" />
        </div>
      </div>
    );
  }

  const progressPct = Math.round((currentStep / stepList.length) * 100);
  const showResumeBanner = !dismissedResume && (initial?.currentStep ?? 0) > 0 && !initial?.completed;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <LessonHeader lesson={lesson} />

      {/* progress */}
      <div className="mt-6 border-2 border-ink bg-white p-3">
        <div className="flex items-center justify-between text-xs font-bold text-gray-600">
          <span>گام {faNumber(currentStep + 1)} از {faNumber(stepList.length)}</span>
          <span className="oeg-mono">{faNumber(progressPct)}٪</span>
        </div>
        <div
          className="mt-2 h-3 border-2 border-ink bg-white"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="پیشرفت درس"
        >
          <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {showResumeBanner && (
        <div className="mt-4 flex items-center justify-between gap-3 border-2 border-gold bg-gold/10 p-3 text-sm font-medium text-[#7a5c1e]">
          <span>
            شما این درس را قبلاً شروع کرده بودید. از گام {faNumber(currentStep + 1)} ادامه می‌دهید.
          </span>
          <button
            type="button"
            onClick={() => setDismissedResume(true)}
            aria-label="بستن اعلان ادامه"
            className="shrink-0 text-[#7a5c1e] hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* current step card */}
      <div className="mt-6 border-2 border-ink bg-white p-5 md:p-8">
        <span className="oeg-mono inline-block border-2 border-ink px-2 py-0.5 text-xs font-black">
          {step.type === "TEXT" ? "متن" : step.type === "MC" ? "چندگزینه‌ای" : "پاسخ عددی"}
        </span>
        <div className="mt-3 text-sm leading-8 md:text-base">
          <MarkdownViewer content={step.content} />
        </div>

        {step.type === "TEXT" ? (
          <Button
            onClick={() => void advance(currentStep, null)}
            disabled={submitting}
            className="oeg-hard-shadow mt-6 h-12 border-2 border-ink px-8 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            {submitting ? <Spinner /> : <ArrowRight className="size-5" aria-hidden="true" />} ادامه
          </Button>
        ) : null}

        {step.type === "MC" && step.options ? (
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (answer) void advance(currentStep, answer);
            }}
          >
            <fieldset disabled={submitting}>
              <legend className="sr-only">گزینه‌ها</legend>
              <div className="space-y-1.5">
                {step.options.map((o) => (
                  <label
                    key={o.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 border-2 px-3 py-2 text-sm transition-colors",
                      answer === o.id
                        ? "border-primary bg-primary/5 font-bold"
                        : "border-gray-200 hover:border-gray-300",
                      feedback && "pointer-events-none opacity-70"
                    )}
                  >
                    <input
                      type="radio"
                      name={`step-${step.id}`}
                      checked={answer === o.id}
                      onChange={() => setAnswer(o.id)}
                      className="accent-primary"
                    />
                    <span className="leading-7">{o.text}</span>
                  </label>
                ))}
              </div>
              <Button
                type="submit"
                disabled={!answer || submitting}
                className="oeg-hard-shadow mt-5 h-12 border-2 border-ink px-8 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                {submitting ? <Spinner /> : null} بررسی
              </Button>
            </fieldset>
          </form>
        ) : null}

        {step.type === "NUMERIC" ? (
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (answer.trim()) void advance(currentStep, answer.trim());
            }}
          >
            <fieldset disabled={submitting}>
              <label htmlFor="numeric-answer" className="block text-sm font-black">
                پاسخ عددی خود را وارد کنید
              </label>
              <Input
                id="numeric-answer"
                dir="ltr"
                inputMode="decimal"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="مثلاً 12.5"
                aria-label="پاسخ عددی"
                className="oeg-mono mt-2 h-12 w-48 border-2 bg-white text-lg"
                autoComplete="off"
              />
              {step.tolerance ? (
                <p className="mt-1 text-xs text-gray-400">
                  پاسخ با تلورانس ±{faNumber(step.tolerance)} پذیرفته می‌شود.
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={!answer.trim() || submitting}
                className="oeg-hard-shadow mt-5 h-12 border-2 border-ink px-8 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                {submitting ? <Spinner /> : null} بررسی
              </Button>
            </fieldset>
          </form>
        ) : null}

        {/* transient feedback */}
        {feedback && !feedback.correct && (
          <div className="mt-6 border-2 border-danger bg-danger/5 p-4" role="alert">
            <p className="font-black text-danger">پاسخ درست نبود — دوباره تلاش کنید</p>
            {feedback.explanation && (
              <div className="mt-2 text-sm leading-7 text-gray-700">
                <MarkdownViewer content={feedback.explanation} />
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setFeedback(null);
                setAnswer("");
              }}
              className="mt-3 h-11 border-2 border-ink font-black"
            >
              تلاش دوباره
            </Button>
          </div>
        )}
        {feedback && feedback.correct && (
          <div className="mt-6 border-2 border-success bg-success/5 p-4" role="status">
            <p className="font-black text-success">درست! ✓</p>
            <Button
              onClick={continueAfterCorrect}
              className="mt-3 h-11 border-2 border-ink px-6 font-black"
            >
              گام بعدی <ArrowRight className="ms-1 size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
