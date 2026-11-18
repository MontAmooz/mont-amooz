"use client";

// مُنت‌آموز — exam create/edit wizard (#/exam/new and #/exam/[id]/edit, P12).
// 3 steps: مشخصات / سؤالات / بازبینی. Edit mode pre-fills and, when any
// attempt exists, locks the questions step (server enforces the same rule).

import { ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { GRADES, SUBJECTS } from "@/lib/constants";
import { faNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ErrorBox, PageSkeleton, Spinner } from "./bits";
import { navigate } from "./router";
import { useEduStore } from "./store";

const STEPS = ["مشخصات آزمون", "سؤالات", "بازبینی و ایجاد"] as const;
const EDIT_STEPS = ["مشخصات آزمون", "سؤالات", "بازبینی و ذخیره"] as const;

interface DraftOption {
  id: string; // client-side temp id
  text: string;
}
interface DraftQuestion {
  text: string;
  type: "MC" | "ESSAY";
  options: DraftOption[];
  correctIndex: number;
  points: number;
}

function emptyQuestion(type: "MC" | "ESSAY" = "MC"): DraftQuestion {
  return {
    text: "",
    type,
    options:
      type === "MC"
        ? [
            { id: crypto.randomUUID(), text: "" },
            { id: crypto.randomUUID(), text: "" },
          ]
        : [],
    correctIndex: 0,
    points: 1,
  };
}

export function ExamCreateView({ editId }: { editId?: string }) {
  const { user, sessionLoaded } = useEduStore();
  const { toast } = useToast();
  const isEdit = !!editId;

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [published, setPublished] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState<string>("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attemptsExist, setAttemptsExist] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  // edit mode: pre-fill from the exam (requires ownership)
  useEffect(() => {
    if (!isEdit || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const exam = await api<{
          title: string;
          description: string | null;
          grade: string;
          subject: string;
          published: boolean;
          isMine: boolean;
          attemptCount: number;
          durationMinutes: number | null;
          questions: Array<{ text: string; type: string; options: { id: string; text: string }[] | null; correctOptionId: string | null; points: number }>;
        }>(`/exams/${editId}`);
        if (cancelled) return;
        if (!exam.isMine) {
          setLoadError("فقط نویسندهٔ آزمون می‌تواند ویرایش کند");
          setLoaded(true);
          return;
        }
        setTitle(exam.title);
        setDescription(exam.description ?? "");
        setGrade(exam.grade);
        setSubject(exam.subject);
        setPublished(exam.published);
        setAttemptsExist(exam.attemptCount > 0);
        setQuestions(
          exam.questions.map((q) => {
            const type: "MC" | "ESSAY" = q.type === "ESSAY" ? "ESSAY" : "MC";
            const opts = (q.options ?? []).map((o) => ({ id: o.id, text: o.text }));
            return {
              text: q.text,
              type,
              options: type === "MC" ? opts : [],
              correctIndex:
                type === "MC"
                  ? Math.max(0, opts.findIndex((o) => o.id === q.correctOptionId))
                  : 0,
              points: q.points,
            };
          })
        );
        setLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "آزمون پیدا نشد");
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, editId, user]);

  if (!sessionLoaded) return <PageSkeleton />;
  if (!user || user.role !== "معلم") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorBox message="فقط معلم می‌تواند آزمون بسازد" onRetry={() => navigate("#/exams")} />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorBox message={loadError} onRetry={() => navigate("#/exams")} />
      </div>
    );
  }
  if (!loaded) return <PageSkeleton />;

  const steps = isEdit ? EDIT_STEPS : STEPS;

  function setQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }
  function setOption(qIndex: number, oIndex: number, text: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === oIndex ? { ...o, text } : o)) }
          : q
      )
    );
  }
  /** Switch a question's type — resets its answer structure (MC options / essay clears). */
  function emptyQuestionPatch(type: "MC" | "ESSAY"): Partial<DraftQuestion> {
    return { ...emptyQuestion(type) };
  }

  function validateStep1(): boolean {
    if (title.trim().length < 3 || title.trim().length > 120) {
      toast({ title: "عنوان آزمون باید بین ۳ تا ۱۲۰ نویسه باشد", variant: "destructive" });
      return false;
    }
    if (!grade || !subject) {
      toast({ title: "پایه و درس را انتخاب کنید", variant: "destructive" });
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    if (attemptsExist) return true; // questions locked
    if (questions.length < 1 || questions.length > 50) {
      toast({ title: "آزمون باید بین ۱ تا ۵۰ سؤال داشته باشد", variant: "destructive" });
      return false;
    }
    if (durationMinutes) {
      const dm = Number(durationMinutes);
      if (!Number.isInteger(dm) || dm < 1 || dm > 240) {
        toast({ title: "مدت آزمون باید بین ۱ تا ۲۴۰ دقیقه باشد", variant: "destructive" });
        return false;
      }
    }
    for (const [i, q] of questions.entries()) {
      if (q.text.trim().length < 2 || q.text.trim().length > 500) {
        toast({ title: `متن سؤال ${i + 1} باید بین ۲ تا ۵۰۰ نویسه باشد`, variant: "destructive" });
        return false;
      }
      if (q.points < 1 || q.points > 10) {
        toast({ title: `امتیاز سؤال ${i + 1} باید بین ۱ تا ۱۰ باشد`, variant: "destructive" });
        return false;
      }
      if (q.type === "ESSAY") continue;
      const filled = q.options.filter((o) => o.text.trim().length > 0);
      if (filled.length < 2 || filled.length > 4 || filled.length !== q.options.length) {
        toast({ title: `سؤال ${i + 1} باید بین ۲ تا ۴ گزینهٔ پرشده داشته باشد`, variant: "destructive" });
        return false;
      }
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        toast({ title: `گزینهٔ صحیح سؤال ${i + 1} را مشخص کنید`, variant: "destructive" });
        return false;
      }
    }
    return true;
  }

  function next() {
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    setStep((s) => Math.min(2, s + 1));
  }

  async function save() {
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        grade,
        subject,
        published,
        durationMinutes: durationMinutes ? Number(durationMinutes) : null,
        ...(attemptsExist
          ? {}
          : {
              questions: questions.map((q) =>
                q.type === "ESSAY"
                  ? { type: "ESSAY", text: q.text.trim(), points: q.points }
                  : {
                      type: "MC",
                      text: q.text.trim(),
                      options: q.options.map((o) => ({ text: o.text.trim() })),
                      correctOptionIndex: q.correctIndex,
                      points: q.points,
                    }
              ),
            }),
      };
      if (isEdit) {
        await api(`/exams/${editId}`, { method: "PATCH", json: payload });
        toast({ title: "آزمون به‌روزرسانی شد" });
        navigate(`#/exam/${editId}`);
      } else {
        const { id } = await api<{ id: string }>("/exams", { method: "POST", json: payload });
        toast({
          title: published ? "آزمون ساخته و منتشر شد" : "آزمون به‌عنوان پیش‌نویس ذخیره شد",
          description: published ? "دانش‌آموزان می‌توانند شرکت کنند." : "هر وقت آماده بودید آن را منتشر کنید.",
        });
        navigate(`#/exam/${id}`);
      }
    } catch (err) {
      toast({
        title: isEdit ? "ذخیرهٔ آزمون ناموفق بود" : "ایجاد آزمون ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-black md:text-3xl">{isEdit ? "ویرایش آزمون" : "ساخت آزمون جدید"}</h1>
      {attemptsExist && (
        <div className="mt-4 border-2 border-gold bg-gold/10 p-3 text-sm font-medium text-[#7a5c1e]">
          این آزمون پاسخ دریافت کرده است؛ سؤالات قابل ویرایش نیستند — فقط مشخصات کلی قابل تغییر است.
        </div>
      )}

      {/* stepper */}
      <ol className="mt-8 flex items-center" aria-label="مراحل ساخت آزمون">
        {steps.map((label, i) => (
          <Fragment key={label}>
            {i > 0 && <div aria-hidden="true" className="h-0.5 flex-1 border-t-2 border-gray-200" />}
            <li className="flex flex-col items-center gap-1 px-3">
              <span
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex size-9 items-center justify-center border-2 text-sm font-black",
                  i === step ? "border-ink bg-ink text-white" : "border-gray-200 bg-white text-gray-400"
                )}
              >
                {faNumber(i + 1)}
              </span>
              <span className={cn("text-xs font-bold", i === step ? "text-ink" : "text-gray-400")}>
                {label}
              </span>
            </li>
          </Fragment>
        ))}
      </ol>

      <div className="mt-8 border-2 border-ink bg-white p-4 md:p-8">
        {step === 0 && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="exam-title" className="text-sm font-black">عنوان آزمون <span className="text-danger">*</span></Label>
              <Input
                id="exam-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: آزمون فصل ۲ ریاضی دهم — معادله"
                className="h-11 border-2 bg-white md:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exam-desc" className="text-sm font-black">توضیحات</Label>
              <Textarea
                id="exam-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="دربارهٔ دامنهٔ آزمون، منابع و نحوهٔ نمره‌دهی…"
                className="min-h-20 border-2 bg-white leading-7"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-black">پایهٔ تحصیلی <span className="text-danger">*</span></Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger className="h-11 w-full border-2 bg-white font-medium md:h-10" aria-label="پایه">
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-black">درس <span className="text-danger">*</span></Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="h-11 w-full border-2 bg-white font-medium md:h-10" aria-label="درس">
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-gray-600">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="size-4 accent-primary"
              />
              انتشار فوری (در غیر این صورت پیش‌نویس ذخیره می‌شود)
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="exam-duration" className="text-sm font-black">
                مدت آزمون به دقیقه (اختیاری)
              </Label>
              <Input
                id="exam-duration"
                type="number"
                min={1}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="خالی = بدون محدودیت زمان"
                className="oeg-mono h-11 w-40 border-2 bg-white md:h-10"
              />
              <p className="text-xs text-gray-400">۱ تا ۲۴۰ دقیقه — پس از شروع، از سمت سرور کنترل می‌شود.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            {questions.map((q, qi) => (
              <fieldset key={qi} className="border-2 border-ink p-4" disabled={attemptsExist}>
                <legend className="oeg-mono flex items-center gap-2 px-2 text-xs font-black">
                  سؤال {faNumber(qi + 1)}
                  {questions.length > 1 && !attemptsExist && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                      className="h-7 border-2 border-danger font-bold text-danger"
                      aria-label={`حذف سؤال ${qi + 1}`}
                    >
                      <Trash2 className="size-3" aria-hidden="true" />
                    </Button>
                  )}
                </legend>
                <Input
                  value={q.text}
                  onChange={(e) => setQuestion(qi, { text: e.target.value })}
                  placeholder="متن سؤال…"
                  aria-label={`متن سؤال ${qi + 1}`}
                  className="h-11 border-2 bg-white md:h-10"
                  disabled={attemptsExist}
                />

                {/* P14 — question type radio (MC | ESSAY) */}
                <div className="mt-3 flex items-center gap-4" role="radiogroup" aria-label={`نوع سؤال ${qi + 1}`}>
                  {(["MC", "ESSAY"] as const).map((t) => (
                    <label key={t} className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-gray-600">
                      <input
                        type="radio"
                        name={`type-${qi}`}
                        checked={q.type === t}
                        onChange={() => setQuestion(qi, emptyQuestionPatch(t))}
                        className="accent-primary"
                        disabled={attemptsExist}
                      />
                      {t === "MC" ? "چهارگزینه‌ای" : "تشریحی"}
                    </label>
                  ))}
                  {q.type === "ESSAY" && (
                    <span className="text-xs text-gold">پاسخ‌ها توسط شما تصحیح می‌شوند</span>
                  )}
                </div>

                {q.type === "MC" && (
                  <>
                <div className="mt-3 space-y-2">
                  {q.options.map((o, oi) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correctIndex === oi}
                        onChange={() => setQuestion(qi, { correctIndex: oi })}
                        aria-label={`گزینهٔ ${oi + 1} سؤال ${qi + 1} صحیح است`}
                        className="accent-primary"
                        disabled={attemptsExist}
                      />
                      <Input
                        value={o.text}
                        onChange={(e) => setOption(qi, oi, e.target.value)}
                        placeholder={`گزینهٔ ${faNumber(oi + 1)}`}
                        aria-label={`متن گزینهٔ ${oi + 1} سؤال ${qi + 1}`}
                        className="h-10 border-2 bg-white"
                        disabled={attemptsExist}
                      />
                      {q.options.length > 2 && !attemptsExist && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setQuestion(qi, {
                              options: q.options.filter((_, j) => j !== oi),
                              correctIndex: q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex,
                            })
                          }
                          className="h-9 shrink-0 border-2 border-gray-200 font-bold text-gray-500"
                          aria-label={`حذف گزینهٔ ${oi + 1} سؤال ${qi + 1}`}
                        >
                          <Trash2 className="size-3" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {q.options.length < 4 && !attemptsExist ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setQuestion(qi, {
                          options: [...q.options, { id: crypto.randomUUID(), text: "" }],
                        })
                      }
                      className="h-8 border-2 border-gray-200 font-bold"
                    >
                      <Plus className="size-3" aria-hidden="true" /> افزودن گزینه
                    </Button>
                  ) : (
                    <span />
                  )}
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    امتیاز:
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={q.points}
                      onChange={(e) => setQuestion(qi, { points: Number(e.target.value) || 1 })}
                      aria-label={`امتیاز سؤال ${qi + 1}`}
                      className="oeg-mono w-16 border-2 border-gray-200 px-2 py-1 text-center font-bold"
                      disabled={attemptsExist}
                    />
                  </label>
                </div>
                  </>
                )}
              </fieldset>
            ))}
            {!attemptsExist && (
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])}
                  disabled={questions.length >= 50}
                  className="h-11 border-2 border-ink font-black"
                >
                  <Plus className="size-4" aria-hidden="true" /> افزودن سؤال
                </Button>
                <span className="oeg-mono text-xs text-gray-400">{faNumber(questions.length)} از ۵۰ سؤال</span>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-black">بازبینی نهایی</h2>
            <dl className="mt-4 border-2 border-ink">
              {(
                [
                  ["عنوان", title],
                  ["پایه", grade],
                  ["درس", subject],
                  ["تعداد سؤال", `${faNumber(questions.length)} سؤال`],
                  ["وضعیت", published ? "منتشر می‌شود" : "پیش‌نویس"],
                ] as Array<[string, string]>
              ).map(([key, value], i) => (
                <div
                  key={key}
                  className={cn("grid grid-cols-[110px,1fr] gap-3 p-3 text-sm", i > 0 && "border-t-2 border-gray-100")}
                >
                  <dt className="font-black text-gray-500">{key}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <ol className="mt-4 space-y-2">
              {questions.map((q, qi) => (
                <li key={qi} className="border-2 border-gray-200 p-3 text-sm">
                  <b>{faNumber(qi + 1)}. {q.text}</b>
                  <span className="ms-2 text-xs text-gray-400">({q.type === "ESSAY" ? "تشریحی" : "چهارگزینه‌ای"})</span>
                  {q.type === "MC" ? (
                    <ul className="mt-1 space-y-0.5 text-gray-600">
                      {q.options.map((o, oi) => (
                        <li key={o.id} className={cn(oi === q.correctIndex && "font-black text-success")}>
                          {oi === q.correctIndex ? "✓" : "○"} {o.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">سؤال تشریحی — پس از ارسال توسط شما تصحیح می‌شود.</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        {step > 0 ? (
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            className="h-11 border-2 border-ink font-bold md:h-10"
          >
            <ArrowRight className="size-4" aria-hidden="true" /> مرحلهٔ قبل
          </Button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <Button onClick={next} className="h-11 border-2 border-ink px-6 font-black md:h-10">
            مرحلهٔ بعد
          </Button>
        ) : (
          <Button
            onClick={() => void save()}
            disabled={busy}
            className="oeg-hard-shadow h-12 border-2 border-ink px-8 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            {busy ? <Spinner /> : <Check className="size-5" aria-hidden="true" />}
            {isEdit ? "ذخیرهٔ تغییرات" : published ? "ایجاد و انتشار آزمون" : "ایجاد آزمون"}
          </Button>
        )}
      </div>
    </div>
  );
}
