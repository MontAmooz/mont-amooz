"use client";

// مُنت‌آموز — attempt result detail (#/exam/[id]/result/[attemptId], P14).
// Color-coded score header + per-question breakdown. MC shows correct/incorrect;
// ESSAY shows the student\'s answer + teacher\'s awarded points + comment.
// SUBMITTED (essays pending) shows «در انتظار تصحیح» with the auto score.

import { CheckCircle, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { faNumber, faRelative, toFaDigits } from "@/lib/format";
import type { ExamAttemptDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorBox, PageSkeleton } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";

export function ExamResultView({ examId, attemptId }: { examId: string; attemptId: string }) {
  const detail = useFetch<ExamAttemptDetail>(
    () => api<ExamAttemptDetail>(`/exams/${examId}/attempts/${attemptId}`),
    [examId, attemptId]
  );

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
  const isGraded = d.status === "GRADED";
  const pct = d.maxScore > 0 ? Math.round((d.totalScore / d.maxScore) * 100) : 0;
  const gradeColor = pct >= 80 ? "text-success" : pct >= 50 ? "text-gold" : "text-danger";
  const gradeBorder = pct >= 80 ? "border-success" : pct >= 50 ? "border-gold" : "border-danger";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <a href={`#/exam/${examId}`} className="text-sm font-bold text-gray-500 hover:text-primary">
        ← بازگشت به آزمون
      </a>

      {/* score header */}
      <div className={cn("mt-4 flex flex-wrap items-center gap-5 border-2 bg-white p-6", gradeBorder)}>
        <div
          className={cn(
            "flex size-20 shrink-0 items-center justify-center rounded-full border-4 text-xl font-black",
            gradeBorder,
            gradeColor
          )}
          role="status"
          aria-label={`امتیاز ${pct} درصد`}
        >
          {toFaDigits(pct)}٪
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-black md:text-2xl">{d.exam.title}</h1>
          <p className="oeg-mono mt-1 text-sm font-bold text-gray-600">
            {faNumber(d.totalScore)} از {faNumber(d.maxScore)}
            {d.status === "SUBMITTED" && (
              <span className="ms-2 font-sans text-xs text-gold">
                (خودکار: {faNumber(d.autoScore)} — در انتظار تصحیح تشریحی)
              </span>
            )}
          </p>
          {d.submittedAt && <p className="mt-1 text-xs text-gray-400">{faRelative(d.submittedAt)}</p>}
        </div>
        {d.timeLimitReached && (
          <Badge variant="outline" className="ms-auto border-2 border-danger px-3 py-1 font-black text-danger">
            <Clock className="size-4" aria-hidden="true" /> ارسال با پایان زمان
          </Badge>
        )}
        <Badge variant="outline" className={cn("ms-auto border-2 px-3 py-1 font-black", gradeBorder, gradeColor)}>
          {d.status === "SUBMITTED"
            ? "در انتظار تصحیح"
            : pct >= 80
              ? "عالی"
              : pct >= 50
                ? "قابل قبول"
                : "نیاز به تلاش بیشتر"}
        </Badge>
      </div>

      {/* per-question breakdown */}
      <ol className="mt-6 space-y-4">
        {d.questions.map((q) => {
          const isEssay = q.type === "ESSAY";
          const essayGraded = isEssay && q.awardedPoints !== null;
          return (
            <li key={q.id} className="border-2 border-ink bg-white p-4 md:p-5">
              <div className="flex items-start gap-3">
                {isEssay ? (
                  essayGraded ? (
                    <CheckCircle className="mt-1 size-5 shrink-0 text-success" aria-label="تصحیح‌شده" />
                  ) : (
                    <Clock className="mt-1 size-5 shrink-0 text-gold" aria-label="در انتظار تصحیح" />
                  )
                ) : q.isCorrect ? (
                  <CheckCircle className="mt-1 size-5 shrink-0 text-success" aria-label="پاسخ صحیح" />
                ) : (
                  <XCircle className="mt-1 size-5 shrink-0 text-danger" aria-label="پاسخ غلط" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-7">
                    {toFaDigits(q.order)}. {q.text}
                    <span className="ms-2 text-xs text-gray-400">
                      ({isEssay ? "تشریحی" : "چهارگزینه‌ای"} · {faNumber(q.points)} امتیاز)
                    </span>
                  </p>

                  {isEssay ? (
                    <>
                      <div className="mt-2 border-2 border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs font-black text-gray-400">پاسخ شما:</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                          {q.studentAnswer?.trim() || <span className="text-gray-400">بی‌پاسخ</span>}
                        </p>
                      </div>
                      {essayGraded && (
                        <div className="mt-2 border-2 border-success/40 bg-success/5 p-3">
                          <p className="text-sm font-black text-success">
                            امتیاز داده‌شده: {faNumber(q.awardedPoints ?? 0)} از {faNumber(q.points)}
                          </p>
                          {q.teacherComment && (
                            <p className="mt-1 text-xs leading-6 text-gray-600">
                              نظر معلم: {q.teacherComment}
                            </p>
                          )}
                        </div>
                      )}
                      {!essayGraded && (
                        <p className="mt-2 text-xs text-gold">در انتظار تصحیح معلم</p>
                      )}
                    </>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {(q.options ?? []).map((o) => {
                        const mine = o.id === q.studentAnswer;
                        const correct = o.id === q.correctOptionId;
                        return (
                          <li
                            key={o.id}
                            className={cn(
                              "flex items-center gap-2 border px-3 py-1.5 text-sm",
                              correct
                                ? "border-success bg-success/10 font-bold text-success"
                                : mine
                                  ? "border-danger bg-danger/10 font-bold text-danger"
                                  : "border-gray-200 text-gray-600"
                            )}
                          >
                            {o.text}
                            {correct && <span className="ms-auto text-xs">گزینهٔ صحیح</span>}
                            {mine && !correct && <span className="ms-auto text-xs">انتخاب شما</span>}
                          </li>
                        );
                      })}
                      {!q.studentAnswer && (
                        <p className="mt-1 text-xs text-gray-400">این سؤال بی‌پاسخ بود.</p>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6">
        <Button
          variant="outline"
          onClick={() => navigate(`#/exam/${examId}`)}
          className="h-11 border-2 border-ink font-black"
        >
          بازگشت به آزمون
        </Button>
      </div>
    </div>
  );
}
