"use client";

// مُنت‌آموز — exam detail (#/exam/[id], P12 + P14 polish):
//  · owner (teacher): سؤالات / نتایج tabs + publish toggle + edit/delete
//  · student: start gate (with timer notice) → taking state (countdown,
//    MC radios + essay textareas, auto-submit on timeout) → submitted/GRADED
//    result states. Server clock is the only timer authority; the countdown
//    is visual only.

import { ClipboardList, Pencil, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faNumber, faRelative } from "@/lib/format";
import type { ExamDetail, ExamOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AuthRequiredBox, EmptyBox, ErrorBox, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";

interface AttemptListResponse {
  items: Array<{
    id: string;
    student: { id: string; fullName: string };
    status: "IN_PROGRESS" | "SUBMITTED" | "GRADED";
    autoScore: number;
    manualScore: number | null;
    totalScore: number;
    maxScore: number;
    submittedAt: string | null;
    pendingEssayCount: number;
  }>;
  total: number;
}

/** One MC option row in the taking form. */
function OptionRow({
  option,
  selected,
  onSelect,
}: {
  option: ExamOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 border-2 px-3 py-2 text-sm transition-colors",
        selected ? "border-primary bg-primary/5 font-bold" : "border-gray-200 hover:border-gray-300"
      )}
    >
      <input
        type="radio"
        checked={selected}
        onChange={onSelect}
        className="accent-primary"
      />
      {option.text}
    </label>
  );
}

export function ExamView({ id }: { id: string }) {
  const { user, sessionLoaded } = useEduStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<"questions" | "results">("questions");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const detail = useFetch<ExamDetail>(() => api<ExamDetail>(`/exams/${id}`), [id, user?.id]);
  const attemptsHook = useFetch<AttemptListResponse>(
    () => api(`/exams/${id}/attempts`),
    [id, tab],
    { enabled: tab === "results" } // lazy — fetched when the owner opens نتایج
  );

  if (!sessionLoaded) return <PageSkeleton />;
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <AuthRequiredBox
          title="برای شرکت در آزمون یا ساخت آن وارد حساب کاربری شوید"
          hint="آزمون‌ها با نام کاربری شما ثبت می‌شوند."
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
        <ErrorBox message={detail.error ?? "آزمون پیدا نشد."} onRetry={detail.retry} />
      </div>
    );
  }

  const exam = detail.data;

  async function togglePublish() {
    if (!exam) return;
    setBusy(true);
    try {
      await api(`/exams/${exam.id}`, { method: "PATCH", json: { published: !exam.published } });
      toast({
        title: exam.published ? "آزمون از حالت انتشار خارج شد" : "آزمون منتشر شد",
        description: exam.published ? "دانش‌آموزان دیگر آن را نمی‌بینند." : "دانش‌آموزان می‌توانند شرکت کنند.",
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
    if (!exam) return;
    setBusy(true);
    try {
      await api(`/exams/${exam.id}`, { method: "DELETE" });
      toast({ title: "آزمون حذف شد" });
      navigate(exam.published ? "#/exams" : "#/exams?mine=true");
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

  /* ---------- owner (teacher) view ---------- */
  if (exam.isMine) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <ExamHeader exam={exam} />
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`#/exam/${exam.id}/edit`)}
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
              exam.published ? "border-gold text-[#8a6a24] hover:bg-gold/10" : "border-ink"
            )}
          >
            {busy ? <Spinner /> : exam.published ? "لغو انتشار" : "انتشار آزمون"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="h-11 border-2 border-danger font-bold text-danger hover:bg-danger/10 md:h-10"
          >
            <Trash2 className="size-4" aria-hidden="true" /> حذف
          </Button>
        </div>

        <div role="tablist" aria-label="بخش‌های آزمون" className="mt-8 flex gap-2 border-b-2 border-gray-200">
          {(
            [
              ["questions", `سؤالات (${faNumber(exam.questions.length)})`],
              ["results", `نتایج (${faNumber(exam.attemptCount)})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "-mb-0.5 border-b-2 px-4 py-3 text-sm font-bold transition-colors",
                tab === value ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "questions" ? (
          <ol className="mt-6 space-y-4">
            {exam.questions.map((q) => (
              <li key={q.id} className="border-2 border-ink bg-white p-4 md:p-5">
                <div className="flex items-start gap-3">
                  <span className="oeg-mono flex size-8 shrink-0 items-center justify-center border-2 border-ink bg-gray-50 text-xs font-black">
                    {faNumber(q.order)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-7">{q.text}</p>
                    {q.type === "MC" && q.options ? (
                      <ul className="mt-2 space-y-1.5">
                        {q.options.map((o) => (
                          <li
                            key={o.id}
                            className={cn(
                              "flex items-center gap-2 border px-3 py-1.5 text-sm",
                              o.id === q.correctOptionId
                                ? "border-success bg-success/10 font-bold text-success"
                                : "border-gray-200 text-gray-600"
                            )}
                          >
                            {o.text}
                            {o.id === q.correctOptionId && (
                              <span className="ms-auto text-xs">گزینهٔ صحیح</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 border-2 border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        سؤال تشریحی — پاسخ‌ها توسط شما تصحیح می‌شوند (امتیاز: {faNumber(q.points)})
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <AttemptsTable examId={exam.id} attempts={attemptsHook} />
        )}

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="border-2 border-ink sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black">حذف آزمون؟</DialogTitle>
              <DialogDescription>
                «{exam.title}» به‌همراه همهٔ سؤال‌ها و پاسخ‌های ثبت‌شده حذف می‌شود. این کار قابل بازگشت نیست.
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
                {busy && <Spinner />} حذف آزمون
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ---------- student view ---------- */
  return (
    <StudentExamView
      exam={exam}
      onRefresh={() => {
        detail.retry();
        // refresh the unread badge too — the teacher will be notified
        void useEduStore.getState().refreshNotifications();
      }}
    />
  );
}

/* ---------- student take/result flow (P14) ---------- */

type TakePhase = "gate" | "taking";

function StudentExamView({ exam, onRefresh }: { exam: Extract<ExamDetail, { isMine: false }>; onRefresh: () => void }) {
  const { toast } = useToast();
  const my = exam.myAttempt;

  // taking state (in-memory, only valid while attempt is IN_PROGRESS)
  const [phase, setPhase] = useState<TakePhase>("gate");
  const [attemptInfo, setAttemptInfo] = useState<{
    attemptId: string;
    startedAt: string;
    serverNow: number;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const remainingSec =
    exam.durationMinutes && attemptInfo
      ? Math.max(
          0,
          Math.floor(
            (new Date(attemptInfo.startedAt).getTime() +
              exam.durationMinutes * 60_000 -
              Date.now()) /
              1000
          )
        )
      : null;

  const submitExam = useCallback(
    async (auto = false) => {
      if (!attemptInfo || submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const res = await api<{ attemptId: string; status: string; autoScore: number; maxScore: number; hasEssay: boolean }>(
          `/exams/${exam.id}/attempts/${attemptInfo.attemptId}/submit`,
          { method: "POST", json: { answers } }
        );
        toast({
          title: auto ? "زمان آزمون تمام شد — پاسخ‌ها ثبت شد" : "پاسخ‌های شما ثبت شد",
          description: res.hasEssay
            ? "سؤال‌های تشریحی در انتظار تصحیح معلم است."
            : `امتیاز شما: ${res.autoScore} از ${res.maxScore}`,
        });
        onRefresh();
        navigate(`#/exam/${exam.id}/result/${res.attemptId}`);
      } catch (err) {
        submittedRef.current = false;
        toast({
          title: "ارسال پاسخ‌ها ناموفق بود",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [answers, attemptInfo, exam.id, onRefresh, toast]
  );

  // auto-submit when the countdown reaches zero (timer exams only)
  useEffect(() => {
    if (phase !== "taking" || remainingSec === null || remainingSec > 0) return;
    if (!submittedRef.current) {
      toast({ title: "زمان آزمون تمام شد", variant: "destructive" });
      void submitExam(true);
    }
  }, [phase, remainingSec, submitExam, toast]);

  async function startExam() {
    setStarting(true);
    try {
      const res = await api<{ attemptId: string; startedAt: string; serverNow: number }>(
        `/exams/${exam.id}/attempts/start`,
        { method: "POST" }
      );
      setAttemptInfo({
        attemptId: res.attemptId,
        startedAt: res.startedAt,
        serverNow: res.serverNow,
      });
      setPhase("taking");
    } catch (err) {
      toast({
        title: "شروع آزمون ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  }

  const hasStarted = !!my && my.status !== "GRADED" && my.submittedAt === null;

  /* gate: not started yet */
  if (phase === "gate") {
    const timerNotice = exam.durationMinutes
      ? `این آزمون ${faNumber(exam.durationMinutes)} دقیقه زمان دارد — با کلیک روی «شروع آزمون»، تایمر از سمت سرور آغاز می‌شود.`
      : "این آزمون محدودیت زمان ندارد.";

    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ExamHeader exam={exam} />

        {hasStarted && my ? (
          // IN_PROGRESS attempt exists (e.g., page reloaded mid-exam) — resume notice
          <div className="mt-8 border-2 border-gold bg-gold/10 p-6">
            <h2 className="text-lg font-black">شما یک آزمون نیمه‌تمام دارید</h2>
            <p className="mt-2 text-sm leading-7 text-gray-600">
              تایمر از سمت سرور در حال شمارش است؛ پاسخ‌های قبلی ثبت نشده‌اند و باید آزمون را ارسال کنید.
            </p>
            <Button
              onClick={() => {
                setAttemptInfo({
                  attemptId: my.id,
                  startedAt: my.submittedAt ?? new Date().toISOString(),
                  serverNow: Date.now(),
                });
                setPhase("taking");
              }}
              className="mt-4 h-11 border-2 border-ink font-black"
            >
              ادامهٔ آزمون
            </Button>
          </div>
        ) : my && alreadyGraded(my) ? (
          <div className="mt-8 border-2 border-ink bg-white p-6">
            <h2 className="text-lg font-black">شما در این آزمون شرکت کرده‌اید</h2>
            <p className="mt-2 text-sm leading-7 text-gray-600">
              امتیاز شما: <b className="oeg-mono">{faNumber(my.score)}</b> از{" "}
              <b className="oeg-mono">{faNumber(my.maxScore)}</b>
              {my.status === "SUBMITTED" && (
                <span className="ms-2 text-gold">(در انتظار تصحیح معلم)</span>
              )}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              هر آزمون فقط یک‌بار قابل شرکت است.
            </p>
            <Button
              onClick={() => navigate(`#/exam/${exam.id}/result/${my.id}`)}
              className="mt-4 h-11 border-2 border-ink font-black md:h-10"
            >
              مشاهدهٔ پاسخ‌نامه
            </Button>
          </div>
        ) : exam.published ? (
          <div className="mt-8 border-2 border-ink bg-white p-6">
            <h2 className="text-lg font-black">آمادهٔ شرکت در آزمون</h2>
            <p className="mt-2 text-sm leading-7 text-gray-600">{timerNotice}</p>
            <ul className="mt-3 list-inside list-disc text-sm text-gray-500">
              {exam.questions.some((q) => q.type === "ESSAY") && (
                <li>این آزمون سؤال تشریحی دارد؛ پاسخ‌ها پس از ارسال، توسط معلم تصحیح می‌شوند.</li>
              )}
              <li>هر آزمون فقط یک‌بار قابل شرکت است.</li>
            </ul>
            <Button
              onClick={() => void startExam()}
              disabled={starting}
              className="oeg-hard-shadow mt-5 h-12 border-2 border-ink px-8 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              {starting && <Spinner />} شروع آزمون
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            <EmptyBox title="این آزمون منتشر نشده است" />
          </div>
        )}
      </div>
    );
  }

  /* taking: questions + countdown */
  const mm = remainingSec !== null ? Math.floor(remainingSec / 60) : null;
  const ss = remainingSec !== null ? remainingSec % 60 : null;
  const timeCritical = remainingSec !== null && remainingSec < 60;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <ExamHeader exam={exam} />

      {exam.durationMinutes !== null && remainingSec !== null && (
        <div
          className={cn(
            "oeg-mono mt-4 flex items-center justify-center border-2 px-4 py-3 text-lg font-black",
            timeCritical ? "border-danger bg-danger/10 text-danger" : "border-ink bg-white text-ink"
          )}
          role="timer"
          aria-label={`زمان باقی‌مانده: ${mm} دقیقه و ${ss} ثانیه`}
        >
          ⏱ {faNumber(mm ?? 0)}:{String(ss ?? 0).padStart(2, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)])}
        </div>
      )}

      <form
        className="mt-8"
        onSubmit={(e) => {
          e.preventDefault();
          void submitExam(false);
        }}
      >
        <ol className="space-y-5">
          {exam.questions.map((q) => (
            <li key={q.id} className="border-2 border-ink bg-white p-4 md:p-5">
              <div className="flex items-start gap-3">
                <span className="oeg-mono flex size-8 shrink-0 items-center justify-center border-2 border-ink bg-gray-50 text-xs font-black">
                  {faNumber(q.order)}
                </span>
                <div className="min-w-0 flex-1">
                  <fieldset>
                    <legend className="text-sm font-bold leading-7">
                      {q.text}
                      <span className="ms-2 text-xs text-gray-400">
                        ({q.type === "ESSAY" ? "تشریحی" : "چهارگزینه‌ای"} · {faNumber(q.points)} امتیاز)
                      </span>
                    </legend>
                    {q.type === "MC" && q.options ? (
                      <div className="mt-2 space-y-1.5">
                        {q.options.map((o: ExamOption) => (
                          <OptionRow
                            key={o.id}
                            option={o}
                            selected={answers[q.id] === o.id}
                            onSelect={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                          />
                        ))}
                      </div>
                    ) : (
                      <Textarea
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        maxLength={5000}
                        placeholder="پاسخ تشریحی خود را اینجا بنویسید… (حداکثر ۵۰۰۰ نویسه)"
                        aria-label={`پاسخ تشریحی سؤال ${q.order}`}
                        className="mt-2 min-h-32 border-2 bg-white leading-7"
                      />
                    )}
                  </fieldset>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <Button
          type="submit"
          disabled={submitting}
          className="oeg-hard-shadow mt-6 h-12 w-full border-2 border-ink text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          {submitting && <Spinner />} ارسال پاسخ‌ها
        </Button>
        <p className="mt-2 text-center text-xs text-gray-400">
          هر آزمون فقط یک‌بار قابل شرکت است — قبل از ارسال، پاسخ‌هایتان را مرور کنید.
        </p>
      </form>
    </div>
  );
}

function alreadyGraded(my: { status: string; submittedAt: string | null } | null): boolean {
  return !!my && (my.status === "GRADED" || my.status === "SUBMITTED");
}

function ExamHeader({ exam }: { exam: ExamDetail }) {
  return (
    <div>
      <a href="#/exams" className="text-sm font-bold text-gray-500 hover:text-primary">
        ← بازگشت به آزمون‌ها
      </a>
      <h1 className="mt-3 text-2xl font-black leading-snug md:text-3xl">{exam.title}</h1>
      {exam.description && <p className="mt-2 text-sm leading-7 text-gray-600">{exam.description}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-2 border-ink px-2 font-bold">پایهٔ {exam.grade}</Badge>
        <Badge variant="outline" className="border-2 border-ink px-2 font-bold">{exam.subject}</Badge>
        {!exam.published && (
          <Badge variant="outline" className="border-2 border-gold px-2 font-bold text-[#8a6a24]">پیش‌نویس</Badge>
        )}
        {exam.durationMinutes && (
          <Badge variant="outline" className="border-2 border-primary px-2 font-bold text-primary">
            ⏱ {faNumber(exam.durationMinutes)} دقیقه
          </Badge>
        )}
        <span className="oeg-mono flex items-center gap-1 text-xs text-gray-500">
          <ClipboardList className="size-3.5" aria-hidden="true" /> {faNumber(exam.questionCount)} سؤال
        </span>
        <span className="oeg-mono flex items-center gap-1 text-xs text-gray-500">
          <Users className="size-3.5" aria-hidden="true" /> {faNumber(exam.attemptCount)} شرکت‌کننده
        </span>
        {exam.avgScore !== null && (
          <span className="oeg-mono text-xs font-black text-gray-600">میانگین {faNumber(Math.round(exam.avgScore))}٪</span>
        )}
        <span className="text-xs text-gray-500">دبیر: {exam.teacher.fullName}</span>
      </div>
    </div>
  );
}

/** Owner-only attempts table (lazy-fetched via useFetch when the tab opens). */
function AttemptsTable({
  examId,
  attempts,
}: {
  examId: string;
  attempts: ReturnType<typeof useFetch<AttemptListResponse>>;
}) {
  if (attempts.loading && !attempts.data) {
    return (
      <div className="mt-6 flex items-center gap-2 text-sm text-gray-500" aria-busy="true">
        <Spinner /> در حال بارگذاری نتایج…
      </div>
    );
  }
  if (attempts.error) {
    return <div className="mt-6"><ErrorBox message={attempts.error} onRetry={attempts.retry} /></div>;
  }
  const items = attempts.data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="mt-6">
        <EmptyBox title="هنوز کسی در این آزمون شرکت نکرده است" />
      </div>
    );
  }
  const STATUS_LABEL: Record<string, string> = {
    IN_PROGRESS: "در حال پاسخ",
    SUBMITTED: "در انتظار تصحیح",
    GRADED: "تصحیح‌شده",
  };
  return (
    <div className="oeg-scroll mt-6 overflow-x-auto border-2 border-ink bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b-2 border-ink bg-gray-50 text-xs text-gray-500">
            <th className="p-3 text-start font-black">دانش‌آموز</th>
            <th className="p-3 text-start font-black">وضعیت</th>
            <th className="p-3 text-start font-black">امتیاز</th>
            <th className="p-3 text-start font-black">زمان ارسال</th>
            <th className="p-3 text-start font-black">عملیات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const pct = a.maxScore > 0 ? Math.round((a.totalScore / a.maxScore) * 100) : 0;
            return (
              <tr key={a.id} className="border-b border-gray-100 last:border-b-0">
                <td className="p-3 font-bold">{a.student.fullName}</td>
                <td className="p-3 text-xs">
                  <span
                    className={cn(
                      "border px-2 py-0.5 font-bold",
                      a.status === "SUBMITTED"
                        ? "border-gold bg-gold/10 text-[#8a6a24]"
                        : a.status === "GRADED"
                          ? "border-success bg-success/10 text-success"
                          : "border-gray-200 text-gray-500"
                    )}
                  >
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </td>
                <td className="oeg-mono p-3">
                  <b className={pct >= 80 ? "text-success" : pct >= 50 ? "text-gold" : "text-danger"}>
                    {faNumber(a.totalScore)}
                  </b>{" "}
                  از {faNumber(a.maxScore)}
                </td>
                <td className="p-3 text-xs text-gray-400">
                  {a.submittedAt ? faRelative(a.submittedAt) : "—"}
                </td>
                <td className="p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(
                        a.status === "SUBMITTED"
                          ? `#/exam/${examId}/attempt/${a.id}/grade`
                          : `#/exam/${examId}/result/${a.id}`
                      )
                    }
                    className="h-8 border-2 border-ink font-bold"
                  >
                    {a.status === "SUBMITTED" ? "تصحیح" : "مشاهده"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
