"use client";

// مُنت‌آموز — interactive-lesson create/edit wizard (#/lesson/new and
// #/lesson/[id]/edit, P15). 3 steps: مشخصات / گام‌ها / پیش‌نمایش. Edit mode
// pre-fills and, when any participant progress exists, locks the steps
// (server enforces the same rule). Reorder via up/down arrows only (P15 MVP).
// Content fields accept Markdown + KaTeX ($…$) rendered by MarkdownViewer.

import { ArrowRight, Check, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
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

const STEPS = ["مشخصات درس", "گام‌ها", "پیش‌نمایش و ایجاد"] as const;
const EDIT_STEPS = ["مشخصات درس", "گام‌ها", "پیش‌نمایش و ذخیره"] as const;
const TYPE_LABEL = { TEXT: "متن", MC: "چندگزینه‌ای", NUMERIC: "عددی" } as const;

type DraftStep =
  | { type: "TEXT"; content: string; explanation: string }
  | { type: "MC"; content: string; options: string[]; correctIndex: number; explanation: string }
  | {
      type: "NUMERIC";
      content: string;
      correctNumeric: string;
      tolerance: string;
      explanation: string;
    };

function emptyStep(type: "TEXT" | "MC" | "NUMERIC"): DraftStep {
  if (type === "TEXT") return { type: "TEXT", content: "", explanation: "" };
  if (type === "MC")
    return { type: "MC", content: "", options: ["", ""], correctIndex: 0, explanation: "" };
  return { type: "NUMERIC", content: "", correctNumeric: "", tolerance: "0", explanation: "" };
}

export function LessonCreateView({ editId }: { editId?: string }) {
  const { user, sessionLoaded } = useEduStore();
  const { toast } = useToast();
  const isEdit = !!editId;

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>("");
  const [published, setPublished] = useState(false);
  const [steps, setSteps] = useState<DraftStep[]>([emptyStep("TEXT"), emptyStep("MC")]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasProgress, setHasProgress] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  // edit mode: pre-fill from the lesson (requires ownership)
  useEffect(() => {
    if (!isEdit || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const lesson = await api<{
          title: string;
          description: string | null;
          grade: string;
          subject: string;
          published: boolean;
          estimatedMinutes: number | null;
          isMine: boolean;
          hasProgress: boolean;
          steps: Array<{
            type: string;
            content: string;
            options: { id: string; text: string }[] | null;
            correctOptionId: string | null;
            correctNumeric: number | null;
            tolerance: number | null;
            explanation: string | null;
          }>;
        }>(`/interactive-lessons/${editId}`);
        if (cancelled) return;
        if (!lesson.isMine) {
          setLoadError("فقط نویسندهٔ درس می‌تواند ویرایش کند");
          setLoaded(true);
          return;
        }
        setTitle(lesson.title);
        setDescription(lesson.description ?? "");
        setGrade(lesson.grade);
        setSubject(lesson.subject);
        setPublished(lesson.published);
        setEstimatedMinutes(lesson.estimatedMinutes ? String(lesson.estimatedMinutes) : "");
        setHasProgress(lesson.hasProgress);
        setSteps(
          lesson.steps.map((s): DraftStep => {
            const explanation = s.explanation ?? "";
            if (s.type === "MC" && s.options) {
              const texts = s.options.map((o) => o.text);
              return {
                type: "MC",
                content: s.content,
                options: texts,
                correctIndex: Math.max(0, s.options.findIndex((o) => o.id === s.correctOptionId)),
                explanation,
              };
            }
            if (s.type === "NUMERIC") {
              return {
                type: "NUMERIC",
                content: s.content,
                correctNumeric: s.correctNumeric !== null ? String(s.correctNumeric) : "",
                tolerance: s.tolerance !== null ? String(s.tolerance) : "0",
                explanation,
              };
            }
            return { type: "TEXT", content: s.content, explanation };
          })
        );
        setLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "درس پیدا نشد");
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
        <ErrorBox message="فقط معلم می‌تواند درس تعاملی بسازد" onRetry={() => navigate("#/lessons")} />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorBox message={loadError} onRetry={() => navigate("#/lessons")} />
      </div>
    );
  }
  if (!loaded) return <PageSkeleton />;

  const wizardSteps = isEdit ? EDIT_STEPS : STEPS;

  function setStepDraft(index: number, patch: Partial<DraftStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? ({ ...s, ...patch } as DraftStep) : s)));
  }

  function moveStep(index: number, delta: -1 | 1) {
    setSteps((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function validateStep1(): boolean {
    if (title.trim().length < 3 || title.trim().length > 120) {
      toast({ title: "عنوان درس باید بین ۳ تا ۱۲۰ نویسه باشد", variant: "destructive" });
      return false;
    }
    if (!grade || !subject) {
      toast({ title: "پایه و درس را انتخاب کنید", variant: "destructive" });
      return false;
    }
    if (estimatedMinutes) {
      const m = Number(estimatedMinutes);
      if (!Number.isInteger(m) || m < 1 || m > 600) {
        toast({ title: "زمان تقریبی باید بین ۱ تا ۶۰۰ دقیقه باشد", variant: "destructive" });
        return false;
      }
    }
    return true;
  }

  function validateStep2(): boolean {
    if (hasProgress) return true; // steps locked
    if (steps.length < 2 || steps.length > 40) {
      toast({ title: "درس باید بین ۲ تا ۴۰ گام داشته باشد", variant: "destructive" });
      return false;
    }
    for (const [i, s] of steps.entries()) {
      if (s.content.trim().length < 2 || s.content.trim().length > 5000) {
        toast({ title: `متن گام ${i + 1} باید بین ۲ تا ۵۰۰۰ نویسه باشد`, variant: "destructive" });
        return false;
      }
      if (s.explanation.trim().length > 2000) {
        toast({ title: `توضیح گام ${i + 1} حداکثر ۲۰۰۰ نویسه است`, variant: "destructive" });
        return false;
      }
      if (s.type === "MC") {
        if (s.options.length < 2 || s.options.length > 4 || s.options.some((o) => !o.trim())) {
          toast({
            title: `گام ${i + 1} باید بین ۲ تا ۴ گزینهٔ پرشده داشته باشد`,
            variant: "destructive",
          });
          return false;
        }
        if (s.correctIndex < 0 || s.correctIndex >= s.options.length) {
          toast({ title: `گزینهٔ صحیح گام ${i + 1} را مشخص کنید`, variant: "destructive" });
          return false;
        }
      }
      if (s.type === "NUMERIC") {
        if (!s.correctNumeric.trim() || !Number.isFinite(Number(s.correctNumeric))) {
          toast({ title: `پاسخ صحیح عددی گام ${i + 1} معتبر نیست`, variant: "destructive" });
          return false;
        }
        const tol = Number(s.tolerance || "0");
        if (!Number.isFinite(tol) || tol < 0) {
          toast({ title: `تلورانس گام ${i + 1} نمی‌تواند منفی باشد`, variant: "destructive" });
          return false;
        }
      }
    }
    return true;
  }

  function next() {
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    setStep((s) => Math.min(2, s + 1));
  }

  function stepsPayload() {
    return steps.map((s) => {
      const explanation = s.explanation.trim() || undefined;
      if (s.type === "TEXT") return { type: "TEXT", content: s.content.trim(), explanation };
      if (s.type === "MC")
        return {
          type: "MC",
          content: s.content.trim(),
          options: s.options.map((o) => ({ text: o.trim() })),
          correctOptionIndex: s.correctIndex,
          explanation,
        };
      return {
        type: "NUMERIC",
        content: s.content.trim(),
        correctNumeric: Number(s.correctNumeric),
        tolerance: Number(s.tolerance || "0"),
        explanation,
      };
    });
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
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
        ...(hasProgress ? {} : { steps: stepsPayload() }),
      };
      if (isEdit) {
        await api(`/interactive-lessons/${editId}`, { method: "PATCH", json: payload });
        toast({ title: "درس به‌روزرسانی شد" });
        navigate(`#/lesson/${editId}`);
      } else {
        const { id } = await api<{ id: string }>("/interactive-lessons", {
          method: "POST",
          json: payload,
        });
        toast({
          title: published ? "درس ساخته و منتشر شد" : "درس به‌عنوان پیش‌نویس ذخیره شد",
          description: published
            ? "دانش‌آموزان می‌توانند یادگیری را شروع کنند."
            : "هر وقت آماده بودید آن را منتشر کنید.",
        });
        navigate(`#/lesson/${id}`);
      }
    } catch (err) {
      toast({
        title: isEdit ? "ذخیرهٔ درس ناموفق بود" : "ایجاد درس ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-black md:text-3xl">{isEdit ? "ویرایش درس تعاملی" : "ساخت درس تعاملی"}</h1>
      {hasProgress && (
        <div className="mt-4 border-2 border-gold bg-gold/10 p-3 text-sm font-medium text-[#7a5c1e]">
          این درس شرکت‌کننده دارد؛ فقط مشخصات قابل ویرایش است.
        </div>
      )}

      {/* stepper */}
      <ol className="mt-8 flex items-center" aria-label="مراحل ساخت درس">
        {wizardSteps.map((label, i) => (
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
              <Label htmlFor="lesson-title" className="text-sm font-black">
                عنوان درس <span className="text-danger">*</span>
              </Label>
              <Input
                id="lesson-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: مشتق به‌زبان ساده — از نرخ تغییر تا شیب مماس"
                className="h-11 border-2 bg-white md:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lesson-desc" className="text-sm font-black">توضیحات</Label>
              <Textarea
                id="lesson-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="این درس برای چه کسی است و چه چیزی یاد می‌گیرد…"
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
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lesson-minutes" className="text-sm font-black">
                  زمان تقریبی به دقیقه (اختیاری)
                </Label>
                <Input
                  id="lesson-minutes"
                  type="number"
                  min={1}
                  max={600}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  placeholder="مثلاً 15"
                  className="oeg-mono h-11 w-40 border-2 bg-white md:h-10"
                />
                <p className="text-xs text-gray-400">به دانش‌آموز نمایش داده می‌شود (۱ تا ۶۰۰).</p>
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
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            {steps.map((s, si) => (
              <fieldset key={si} className="border-2 border-ink p-4" disabled={hasProgress}>
                <legend className="flex items-center gap-1 px-2 text-xs font-black">
                  گام {faNumber(si + 1)} — {TYPE_LABEL[s.type]}
                  {!hasProgress && (
                    <span className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => moveStep(si, -1)}
                        disabled={si === 0}
                        className="size-7 border-2 border-gray-200 p-0 text-gray-500"
                        aria-label={`جابه‌جایی گام ${si + 1} به بالا`}
                      >
                        <ChevronUp className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => moveStep(si, 1)}
                        disabled={si === steps.length - 1}
                        className="size-7 border-2 border-gray-200 p-0 text-gray-500"
                        aria-label={`جابه‌جایی گام ${si + 1} به پایین`}
                      >
                        <ChevronDown className="size-3.5" aria-hidden="true" />
                      </Button>
                      {steps.length > 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSteps((prev) => prev.filter((_, i) => i !== si))}
                          className="size-7 border-2 border-danger p-0 font-bold text-danger"
                          aria-label={`حذف گام ${si + 1}`}
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    </span>
                  )}
                </legend>

                <Textarea
                  value={s.content}
                  onChange={(e) => setStepDraft(si, { content: e.target.value })}
                  placeholder={
                    s.type === "TEXT"
                      ? "متن گام (Markdown؛ فرمول با $…$)…"
                      : "متن سؤال (Markdown؛ فرمول با $…$)…"
                  }
                  aria-label={`متن گام ${si + 1}`}
                  className="min-h-24 border-2 bg-white leading-7"
                  disabled={hasProgress}
                />

                {s.type === "MC" && (
                  <div className="mt-3 space-y-2">
                    {s.options.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${si}`}
                          checked={s.correctIndex === oi}
                          onChange={() => setStepDraft(si, { correctIndex: oi })}
                          aria-label={`گزینهٔ ${oi + 1} گام ${si + 1} صحیح است`}
                          className="accent-primary"
                          disabled={hasProgress}
                        />
                        <Input
                          value={o}
                          onChange={(e) =>
                            setStepDraft(si, {
                              options: s.options.map((opt, j) => (j === oi ? e.target.value : opt)),
                            })
                          }
                          placeholder={`گزینهٔ ${faNumber(oi + 1)}`}
                          aria-label={`متن گزینهٔ ${oi + 1} گام ${si + 1}`}
                          className="h-10 border-2 bg-white"
                          disabled={hasProgress}
                        />
                        {s.options.length > 2 && !hasProgress && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setStepDraft(si, {
                                options: s.options.filter((_, j) => j !== oi),
                                correctIndex:
                                  s.correctIndex === oi ? 0 : s.correctIndex > oi ? s.correctIndex - 1 : s.correctIndex,
                              })
                            }
                            className="h-9 shrink-0 border-2 border-gray-200 font-bold text-gray-500"
                            aria-label={`حذف گزینهٔ ${oi + 1} گام ${si + 1}`}
                          >
                            <Trash2 className="size-3" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {s.options.length < 4 && !hasProgress && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setStepDraft(si, { options: [...s.options, ""] })}
                        className="h-8 border-2 border-gray-200 font-bold"
                      >
                        <Plus className="size-3" aria-hidden="true" /> افزودن گزینه
                      </Button>
                    )}
                  </div>
                )}

                {s.type === "NUMERIC" && (
                  <div className="mt-3 flex flex-wrap items-end gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-gray-500">پاسخ صحیح</Label>
                      <Input
                        dir="ltr"
                        inputMode="decimal"
                        value={s.correctNumeric}
                        onChange={(e) => setStepDraft(si, { correctNumeric: e.target.value })}
                        placeholder="مثلاً 12.5"
                        aria-label={`پاسخ صحیح گام ${si + 1}`}
                        className="oeg-mono h-10 w-40 border-2 bg-white"
                        disabled={hasProgress}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-gray-500">تلورانس (اختیاری)</Label>
                      <Input
                        dir="ltr"
                        inputMode="decimal"
                        value={s.tolerance}
                        onChange={(e) => setStepDraft(si, { tolerance: e.target.value })}
                        placeholder="0"
                        aria-label={`تلورانس گام ${si + 1}`}
                        className="oeg-mono h-10 w-32 border-2 bg-white"
                        disabled={hasProgress}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-1.5">
                  <Label className="text-xs font-black text-gray-500">توضیح پاسخ اشتباه (اختیاری)</Label>
                  <Textarea
                    value={s.explanation}
                    onChange={(e) => setStepDraft(si, { explanation: e.target.value })}
                    placeholder="وقتی دانش‌آموز اشتباه زد چه توضیحی ببینید؟ (Markdown پشتیبانی می‌شود)"
                    aria-label={`توضیح گام ${si + 1}`}
                    className="min-h-16 border-2 bg-white leading-7"
                    disabled={hasProgress}
                  />
                </div>
              </fieldset>
            ))}

            {!hasProgress && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (!v) return;
                      setSteps((prev) => [...prev, emptyStep(v as "TEXT" | "MC" | "NUMERIC")]);
                    }}
                  >
                    <SelectTrigger className="h-11 w-44 border-2 border-ink font-black" aria-label="افزودن گام جدید">
                      <SelectValue placeholder="افزودن گام…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEXT">متن توضیحی</SelectItem>
                      <SelectItem value="MC">چندگزینه‌ای</SelectItem>
                      <SelectItem value="NUMERIC">پاسخ عددی</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span className="oeg-mono text-xs text-gray-400">{faNumber(steps.length)} از ۴۰ گام</span>
              </div>
            )}
            <p className="text-xs leading-6 text-gray-400">
              پیشنهاد: گام اول «متن» باشد (مقدمهٔ درس)، بعد تمرین‌های چندگزینه‌ای و عددی.
            </p>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-black">پیش‌نمایش</h2>
            <p className="mt-1 text-xs text-gray-400">
              همین چیزی است که دانش‌آموز می‌بیند (پاسخ‌های صحیح در پیش‌نمایش علامت خورده‌اند).
            </p>
            <dl className="mt-4 border-2 border-ink">
              {(
                [
                  ["عنوان", title],
                  ["پایه", grade],
                  ["درس", subject],
                  ["تعداد گام", `${faNumber(steps.length)} گام`],
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
              {steps.map((s, si) => (
                <li key={si} className="border-2 border-gray-200 p-3 text-sm">
                  <b>
                    {faNumber(si + 1)}. {TYPE_LABEL[s.type]}
                  </b>
                  <p className="mt-1 whitespace-pre-wrap leading-7 text-gray-700">{s.content}</p>
                  {s.type === "MC" ? (
                    <ul className="mt-1 space-y-0.5 text-gray-600">
                      {s.options.map((o, oi) => (
                        <li key={oi} className={cn(oi === s.correctIndex && "font-black text-success")}>
                          {oi === s.correctIndex ? "✓" : "○"} {o}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {s.type === "NUMERIC" ? (
                    <p className="mt-1 font-black text-success">
                      پاسخ: {s.correctNumeric}
                      {Number(s.tolerance || 0) > 0 ? ` (± ${s.tolerance})` : ""}
                    </p>
                  ) : null}
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
            {isEdit ? "ذخیرهٔ تغییرات" : published ? "ایجاد و انتشار درس" : "ایجاد درس"}
          </Button>
        )}
      </div>
    </div>
  );
}
