"use client";

// مُنت‌آموز — exam detail (#/exam/[id], P12):
//  · owner (teacher): سؤالات / نتایج tabs + publish toggle + edit/delete
//  · student: take the exam (single submit) or see their attempt summary

import { ClipboardList, Pencil, Trash2, Users } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faNumber, faRelative } from "@/lib/format";
import type { ExamDetail, ExamOption } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AuthRequiredBox, EmptyBox, ErrorBox, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";

export function ExamView({ id }: { id: string }) {
  const { user, sessionLoaded } = useEduStore();
  const { toast } = useToast();
  const [tab, setTab] = useState<"questions" | "results">("questions");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // answers keyed by questionId → optionId
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const detail = useFetch<ExamDetail>(() => api<ExamDetail>(`/exams/${id}`), [id, user?.id]);
  const attempts = useFetch<{ items: Array<{ id: string; student: { id: string; fullName: string }; score: number; maxScore: number; submittedAt: string }>; total: number }>(
    () => api(`/exams/${id}/attempts`),
    [id],
    { enabled: detail.data?.isMine === true && tab === "results" }
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
      navigate(mineHref(exam.published));
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

  async function submitExam() {
    if (!exam || exam.isMine) return;
    const unanswered = exam.questions.filter((q) => !answers[q.id]).length;
    if (unanswered > 0) {
      toast({
        title: "همهٔ سؤال‌ها پاسخ داده نشده‌اند",
        description: `${unanswered} سؤال بی‌پاسخ است؛ بی‌پاسخ‌ها غلط حساب می‌شوند.`,
        variant: "destructive",
      });
    }
    setSubmitting(true);
    try {
      const res = await api<{ attemptId: string; score: number; maxScore: number }>(
        `/exams/${exam.id}/attempts`,
        { method: "POST", json: { answers } }
      );
      toast({
        title: "پاسخ‌های شما ثبت شد",
        description: `امتیاز شما: ${res.score} از ${res.maxScore}`,
      });
      navigate(`#/exam/${exam.id}/result/${res.attemptId}`);
    } catch (err) {
      toast({
        title: "ارسال پاسخ‌ها ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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

        {/* tabs */}
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
                tab === value
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-ink"
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
                    <p className="mt-2 text-xs text-gray-400">امتیاز: {faNumber(q.points)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <AttemptsTable examId={exam.id} attempts={attempts} />
        )}

        {/* delete dialog */}
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

  /* ---------- student / anonymous-or-other view ---------- */
  const alreadyTaken = !!exam.myAttempt;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <ExamHeader exam={exam} />

      {alreadyTaken ? (
        <div className="mt-8 border-2 border-ink bg-white p-6">
          <h2 className="text-lg font-black">شما در این آزمون شرکت کرده‌اید</h2>
          <p className="mt-2 text-sm leading-7 text-gray-600">
            امتیاز شما: <b className="oeg-mono">{faNumber(exam.myAttempt!.score)}</b> از{" "}
            <b className="oeg-mono">{faNumber(exam.myAttempt!.maxScore)}</b>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            ثبت‌شده در {faRelative(exam.myAttempt!.submittedAt)} · هر آزمون فقط یک‌بار قابل شرکت است.
          </p>
          <Button
            onClick={() => navigate(`#/exam/${exam.id}/result/${exam.myAttempt!.id}`)}
            className="mt-4 h-11 border-2 border-ink font-black md:h-10"
          >
            مشاهدهٔ پاسخ‌نامه
          </Button>
        </div>
      ) : exam.published ? (
        <form
          className="mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            void submitExam();
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
                      <legend className="text-sm font-bold leading-7">{q.text}</legend>
                      <div className="mt-2 space-y-1.5">
                        {q.options.map((o: ExamOption) => (
                          <label
                            key={o.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 border-2 px-3 py-2 text-sm transition-colors",
                              answers[q.id] === o.id
                                ? "border-primary bg-primary/5 font-bold"
                                : "border-gray-200 hover:border-gray-300"
                            )}
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              checked={answers[q.id] === o.id}
                              onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
                              className="accent-primary"
                            />
                            {o.text}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <p className="mt-2 text-xs text-gray-400">امتیاز: {faNumber(q.points)}</p>
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
      ) : (
        <div className="mt-8">
          <EmptyBox title="این آزمون منتشر نشده است" />
        </div>
      )}
    </div>
  );
}

function mineHref(published: boolean): string {
  return published ? "#/exams" : "#/exams?mine=true";
}

function ExamHeader({ exam }: { exam: ExamDetail }) {
  return (
    <div>
      <a href={exam.isMine ? "#/exams?mine=true" : "#/exams"} className="text-sm font-bold text-gray-500 hover:text-primary">
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
  attempts: ReturnType<typeof useFetch<{ items: Array<{ id: string; student: { id: string; fullName: string }; score: number; maxScore: number; submittedAt: string }>; total: number }>>;
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
  return (
    <div className="oeg-scroll mt-6 overflow-x-auto border-2 border-ink bg-white">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b-2 border-ink bg-gray-50 text-xs text-gray-500">
            <th className="p-3 text-start font-black">دانش‌آموز</th>
            <th className="p-3 text-start font-black">امتیاز</th>
            <th className="p-3 text-start font-black">زمان ارسال</th>
            <th className="p-3 text-start font-black">جزئیات</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const pct = a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0;
            return (
              <tr key={a.id} className="border-b border-gray-100 last:border-b-0">
                <td className="p-3 font-bold">{a.student.fullName}</td>
                <td className="oeg-mono p-3">
                  <b className={pct >= 80 ? "text-success" : pct >= 50 ? "text-gold" : "text-danger"}>
                    {faNumber(a.score)}
                  </b>{" "}
                  از {faNumber(a.maxScore)}
                </td>
                <td className="p-3 text-xs text-gray-400">{faRelative(a.submittedAt)}</td>
                <td className="p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`#/exam/${examId}/result/${a.id}`)}
                    className="h-8 border-2 border-ink font-bold"
                  >
                    مشاهده
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
