"use client";

// مُنت‌آموز — teacher essay-grading view (#/exam/[id]/attempt/[attemptId]/grade, P14).
// Owner-only: MC scores shown read-only above; each ESSAY question gets a
// 0..points input + optional comment. «ثبت نمرات» posts all gradings at once.

import { CheckCircle, ClipboardList, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faNumber, toFaDigits } from "@/lib/format";
import type { ExamAttemptDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorBox, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";

export function ExamGradeView({ examId, attemptId }: { examId: string; attemptId: string }) {
  const { toast } = useToast();
  const detail = useFetch<ExamAttemptDetail>(
    () => api<ExamAttemptDetail>(`/exams/${examId}/attempts/${attemptId}`),
    [examId, attemptId]
  );
  const [awards, setAwards] = useState<Record<string, { points: string; comment: string }>>({});
  const [busy, setBusy] = useState(false);

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
        <ErrorBox message={detail.error ?? "پاسخ آزمون پیدا نشد."} onRetry={detail.retry} />
      </div>
    );
  }

  const d = detail.data;
  const essays = d.questions.filter((q) => q.type === "ESSAY");
  const mcQuestions = d.questions.filter((q) => q.type === "MC");

  async function submitGradings() {
    if (!essays.length) return;
    // client-side sanity: every essay needs an award in 0..points
    for (const q of essays) {
      const v = Number(awards[q.id]?.points ?? "");
      if (!Number.isInteger(v) || v < 0 || v > q.points) {
        toast({
          title: `امتیاز سؤال ${q.order} نامعتبر است`,
          description: `مقدار باید عددی بین ۰ تا ${q.points} باشد.`,
          variant: "destructive",
        });
        return;
      }
    }
    setBusy(true);
    try {
      const res = await api<{ status: string; manualScore: number; totalScore: number }>(
        `/exams/${examId}/attempts/${attemptId}/grade`,
        {
          method: "POST",
          json: {
            gradings: essays.map((q) => ({
              questionId: q.id,
              awardedPoints: Number(awards[q.id]?.points ?? 0),
              teacherComment: awards[q.id]?.comment?.trim() || undefined,
            })),
          },
        }
      );
      toast({
        title: "نمرات ثبت شد",
        description: `امتیاز نهایی: ${res.totalScore} از ${d.maxScore}`,
      });
      navigate(`#/exam/${examId}`);
    } catch (err) {
      toast({
        title: "ثبت نمرات ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <a href={`#/exam/${examId}`} className="text-sm font-bold text-gray-500 hover:text-primary">
        ← بازگشت به آزمون
      </a>

      <h1 className="mt-3 flex items-center gap-2 text-2xl font-black">
        <ClipboardList className="size-6 text-primary" aria-hidden="true" /> تصحیح آزمون
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        دانش‌آموز: <b>{d.student.fullName}</b> · آزمون: «{d.exam.title}»
        {d.timeLimitReached && (
          <span className="ms-2 border-2 border-danger px-2 py-0.5 text-xs font-bold text-danger">
            ارسال با پایان زمان
          </span>
        )}
      </p>

      {/* MC auto-score summary (read-only) */}
      {mcQuestions.length > 0 && (
        <div className="mt-6 border-2 border-ink bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-black">
            <CheckCircle className="size-4 text-success" aria-hidden="true" />
            نمرهٔ خودکار چهارگزینه‌ای‌ها: {faNumber(d.autoScore)} از{" "}
            {faNumber(mcQuestions.reduce((s, q) => s + q.points, 0))}
          </h2>
          <ul className="mt-3 space-y-1.5">
            {mcQuestions.map((q) => {
              const mine = q.studentAnswer;
              const correct = mine === q.correctOptionId;
              return (
                <li key={q.id} className="flex items-center gap-2 text-xs text-gray-600">
                  {correct ? (
                    <CheckCircle className="size-3.5 text-success" aria-hidden="true" />
                  ) : (
                    <XCircle className="size-3.5 text-danger" aria-hidden="true" />
                  )}
                  {toFaDigits(q.order)}. {q.text}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* essay gradings */}
      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submitGradings();
        }}
      >
        {essays.map((q) => {
          const award = awards[q.id]?.points ?? "";
          return (
            <fieldset key={q.id} className="border-2 border-ink bg-white p-4">
              <legend className="flex items-center gap-2 px-2 text-sm font-black">
                {q.isCorrect ? (
                  <CheckCircle className="size-4 text-success" aria-hidden="true" />
                ) : (
                  <XCircle className="size-4 text-danger" aria-hidden="true" />
                )}
                سؤال {toFaDigits(q.order)} — تشریحی ({faNumber(q.points)} امتیاز)
              </legend>
              <p className="text-sm font-bold leading-7">{q.text}</p>
              <div className="mt-2 border-2 border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-black text-gray-400">پاسخ دانش‌آموز:</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                  {q.studentAnswer?.trim() || <span className="text-gray-400">بی‌پاسخ</span>}
                </p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[120px,1fr]">
                <div className="space-y-1.5">
                  <Label htmlFor={`grade-${q.id}`} className="text-sm font-black">
                    امتیاز (۰ تا {q.points})
                  </Label>
                  <Input
                    id={`grade-${q.id}`}
                    type="number"
                    min={0}
                    max={q.points}
                    value={award}
                    onChange={(e) => {
                      const v = e.target.value === "" ? "" : String(Math.min(Number(e.target.value), q.points));
                      setAwards((prev) => ({
                        ...prev,
                        [q.id]: { points: v, comment: prev[q.id]?.comment ?? "" },
                      }));
                    }}
                    className="oeg-mono h-11 border-2 bg-white text-center font-black md:h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`comment-${q.id}`} className="text-sm font-black">
                    توضیح (اختیاری)
                  </Label>
                  <Input
                    id={`comment-${q.id}`}
                    value={awards[q.id]?.comment ?? ""}
                    onChange={(e) =>
                      setAwards((prev) => ({
                        ...prev,
                        [q.id]: { points: prev[q.id]?.points ?? "", comment: e.target.value },
                      }))
                    }
                    placeholder="بازخورد برای دانش‌آموز…"
                    className="h-11 border-2 bg-white md:h-10"
                  />
                </div>
              </div>
              {q.awardedPoints !== null && (
                <p className="mt-2 text-xs text-success">
                  قبلاً {faNumber(q.awardedPoints)} امتیاز داده شده بود (بازثبت، جایگزین می‌شود).
                </p>
              )}
            </fieldset>
          );
        })}

        {essays.length === 0 && (
          <EmptyBoxInline />
        )}

        {essays.length > 0 && (
          <>
            <div className="flex items-center justify-between border-2 border-ink bg-gray-50 p-3 text-sm font-black">
              <span>
                خودکار: {faNumber(d.autoScore)} · تشریحی: تا {faNumber(essays.reduce((s, q) => s + q.points, 0))}
              </span>
              <span className="oeg-mono text-primary">
                نهایی حداکثر: {faNumber(d.maxScore)}
              </span>
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="oeg-hard-shadow h-12 w-full border-2 border-ink text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              {busy && <Spinner />} ثبت نمرات
            </Button>
          </>
        )}
      </form>
    </div>
  );
}

function EmptyBoxInline() {
  return (
    <div className="border-2 border-ink bg-white p-6 text-center">
      <p className={cn("text-sm font-black text-success")}>این آزمون سؤال تشریحی ندارد — نمرهٔ خودکار نهایی است.</p>
    </div>
  );
}
