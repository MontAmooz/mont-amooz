"use client";

// مُنت‌آموز — create pamphlet view (auth required): 3-step wizard.

import { ArrowRight, Check, Paperclip, Upload, X } from "lucide-react";
import { Fragment, useRef, useState } from "react";
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
import { DIFFICULTIES, GRADES, SUBJECTS, TEACHING_METHODS } from "@/lib/constants";
import { faFileSize, faNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AuthRequiredBox, PageSkeleton, Spinner } from "./bits";
import { ContentEditor } from "./content-editor";
import { MarkdownViewer } from "./markdown-viewer";
import { navigate } from "./router";
import { useEduStore } from "./store";

const STEPS = ["مشخصات جزوه", "محتوای جزوه", "بازبینی و انتشار"] as const;

interface CreateForm {
  title: string;
  description: string;
  grade: string;
  subject: string;
  chapter: string;
  teachingMethod: string;
  difficulty: string;
  content: string;
}

function Field({
  label,
  required,
  error,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-black">
        {label}
        {required && <span className="text-danger"> *</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && (
        <p className="text-xs font-bold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function CreateView() {
  const { user, sessionLoaded } = useEduStore();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateForm>({
    title: "",
    description: "",
    grade: "",
    subject: "",
    chapter: "",
    teachingMethod: "",
    difficulty: "",
    content: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
  const [publishing, setPublishing] = useState(false);
  // ADR-0012 — optional attachment held client-side until after the pamphlet POST
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickAttachment(f: File | null) {
    setAttachment(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!sessionLoaded) {
    return <PageSkeleton />;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <AuthRequiredBox
          title="برای بارگذاری جزوه وارد حساب کاربری شوید"
          hint="جزوه‌ها با نام نویسنده منتشر می‌شوند؛ برای ثبت مالکیت فکری باید عضو کتابخانه باشید."
        />
      </div>
    );
  }

  function set<K extends keyof CreateForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateStep0(): boolean {
    const e: Partial<Record<keyof CreateForm, string>> = {};
    if (form.title.trim().length < 3) e.title = "عنوان جزوه را وارد کنید (حداقل ۳ حرف).";
    if (!form.grade) e.grade = "پایهٔ تحصیلی را انتخاب کنید.";
    if (!form.subject) e.subject = "درس را انتخاب کنید.";
    if (!form.teachingMethod) e.teachingMethod = "روش تدریس را انتخاب کنید.";
    if (!form.difficulty) e.difficulty = "سطح جزوه را انتخاب کنید.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && form.content.trim().length < 10) {
      setErrors({ content: "محتوای جزوه را بنویسید؛ حداقل چند سطر لازم است." });
      return;
    }
    setErrors({});
    setStep((s) => Math.min(2, s + 1));
  }

  async function publish() {
    setPublishing(true);
    try {
      const { id } = await api<{ id: string }>("/pamphlets", {
        method: "POST",
        json: {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          grade: form.grade,
          subject: form.subject,
          chapter: form.chapter.trim() || undefined,
          teachingMethod: form.teachingMethod,
          difficulty: form.difficulty,
          content: form.content,
        },
      });
      // ADR-0012 — attachment upload happens after the pamphlet exists; a
      // failed upload never blocks the publication (attachment is optional).
      if (attachment) {
        try {
          const fd = new FormData();
          fd.append("file", attachment);
          await api(`/pamphlets/${id}/attachments`, { method: "POST", form: fd });
        } catch (err) {
          toast({
            title: "جزوه منتشر شد، اما آپلود پیوست ناموفق بود",
            description: err instanceof Error ? err.message : undefined,
            variant: "destructive",
          });
        }
      }
      toast({
        title: "جزوه شما منتشر شد!",
        description: "نامتان برای همیشه کنارش می‌ماند؛ منتظر بازخورد جامعه باشید.",
      });
      navigate(`#/pamphlet/${id}`);
    } catch (err) {
      toast({
        title: "انتشار جزوه ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  }

  const selectTrigger = (invalid?: boolean) =>
    cn("h-11 w-full border-2 bg-white font-medium md:h-10", invalid && "border-danger");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black">بارگذاری جزوهٔ جدید</h1>
      <p className="mt-2 text-sm leading-7 text-gray-500">
        جزوهٔ شما با نام خودتان منتشر و قابل فورک خواهد بود؛ در ۳ مرحله ساده آماده‌اش کنید.
      </p>

      {/* stepper */}
      <ol className="mt-10 flex items-start" aria-label="مراحل بارگذاری">
        {STEPS.map((label, i) => (
          <Fragment key={label}>
            {i > 0 && (
              <div
                aria-hidden="true"
                className={cn(
                  "mt-5 h-0.5 flex-1 border-t-2",
                  i <= step ? "border-primary" : "border-gray-200"
                )}
              />
            )}
            <li className="flex w-28 flex-col items-center gap-1.5 text-center">
              <span
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex size-10 items-center justify-center border-2 text-sm font-black transition-colors",
                  i < step
                    ? "border-primary bg-primary text-white"
                    : i === step
                      ? "border-ink bg-white text-ink"
                      : "border-gray-200 bg-white text-gray-300"
                )}
              >
                {i < step ? <Check className="size-5" aria-hidden="true" /> : faNumber(i + 1)}
              </span>
              <span
                className={cn(
                  "text-xs font-bold leading-5",
                  i === step ? "text-ink" : "text-gray-400"
                )}
              >
                {label}
              </span>
            </li>
          </Fragment>
        ))}
      </ol>

      {/* step body */}
      <div className="mt-8 border-2 border-ink bg-white p-4 md:p-8">
        {step === 0 && (
          <div className="space-y-5">
            <Field label="عنوان جزوه" required error={errors.title}>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="مثلاً: جزوهٔ کامل ریاضی نهم — فصل معادله‌ها"
                className="h-11 border-2 bg-white md:h-10"
              />
            </Field>

            <Field
              label="توضیح کوتاه"
              hint="در یک یا دو خط بگویید این جزوه برای چه کلاس و چه هدفی مناسب است."
            >
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="مثلاً: جمع‌بندی مفاهیم کلیدی با مثال‌های حل‌شده و تمرین‌های کنکوری…"
                className="min-h-20 border-2 bg-white leading-7"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="پایهٔ تحصیلی" required error={errors.grade}>
                <Select value={form.grade} onValueChange={(v) => set("grade", v)}>
                  <SelectTrigger className={selectTrigger(!!errors.grade)} aria-label="پایهٔ تحصیلی">
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="درس" required error={errors.subject}>
                <Select value={form.subject} onValueChange={(v) => set("subject", v)}>
                  <SelectTrigger className={selectTrigger(!!errors.subject)} aria-label="درس">
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="فصل (اختیاری)" hint="مثلاً: فصل ۳ — عبارت‌های جبری">
                <Input
                  value={form.chapter}
                  onChange={(e) => set("chapter", e.target.value)}
                  placeholder="نام فصل"
                  className="h-11 border-2 bg-white md:h-10"
                />
              </Field>

              <Field label="روش تدریس" required error={errors.teachingMethod}>
                <Select value={form.teachingMethod} onValueChange={(v) => set("teachingMethod", v)}>
                  <SelectTrigger className={selectTrigger(!!errors.teachingMethod)} aria-label="روش تدریس">
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEACHING_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="سطح جزوه" required error={errors.difficulty}>
                <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v)}>
                  <SelectTrigger className={selectTrigger(!!errors.difficulty)} aria-label="سطح جزوه">
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <ContentEditor
            value={form.content}
            onChange={(v) => set("content", v)}
            invalid={!!errors.content}
          />
        )}
        {step === 1 && errors.content && (
          <p className="mt-2 text-xs font-bold text-danger" role="alert">{errors.content}</p>
        )}

        {step === 1 && (
          <div className="mt-6 border-t-2 border-dashed border-gray-200 pt-5">
            <Label className="text-sm font-black">پیوست (اختیاری)</Label>
            <p className="mt-1 text-xs leading-6 text-gray-500">
              اگر جزوهٔ شما Word یا PDF است، فایلش را پیوست کنید تا دانلود و نمایش داده شود —
              محتوای متنی هنوز همان Markdown است. حداکثر ۲۰ مگابایت.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.md,.txt"
              className="sr-only"
              id="create-attachment"
              aria-label="انتخاب فایل پیوست"
              onChange={(e) => pickAttachment(e.target.files?.[0] ?? null)}
            />
            {attachment ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-2 border-ink bg-gray-50 p-3">
                <Paperclip className="size-4 text-primary" aria-hidden="true" />
                <span className="min-w-0 break-all text-sm font-bold">{attachment.name}</span>
                <span className="text-xs text-gray-400">{faFileSize(attachment.size)}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => pickAttachment(null)}
                  className="ms-auto h-9 border-2 border-ink font-bold"
                >
                  <X className="size-4" aria-hidden="true" /> حذف
                </Button>
              </div>
            ) : (
              <label
                htmlFor="create-attachment"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) pickAttachment(f);
                }}
                className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Upload className="size-5 text-gray-400" aria-hidden="true" />
                <span className="text-sm font-bold text-gray-600">
                  فایل را اینجا رها کنید یا برای انتخاب کلیک کنید
                </span>
                <span className="text-xs text-gray-400">PDF، Word، Markdown، متن</span>
              </label>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-black">بازبینی نهایی</h2>
            <p className="mt-1 text-xs text-gray-500">
              همه‌چیز را یک بار مرور کنید؛ بعد از انتشار هم می‌توانید نسخهٔ جدید ثبت کنید.
            </p>
            <dl className="mt-6 border-2 border-ink">
              {(
                [
                  ["عنوان", form.title],
                  ["توضیحات", form.description || "—"],
                  ["پایه", form.grade],
                  ["درس", form.subject],
                  ["فصل", form.chapter || "—"],
                  ["روش تدریس", form.teachingMethod],
                  ["سطح", form.difficulty],
                ] as Array<[string, string]>
              ).map(([key, value], i) => (
                <div
                  key={key}
                  className={cn(
                    "grid grid-cols-[110px,1fr] gap-3 p-3 text-sm",
                    i > 0 && "border-t-2 border-gray-100"
                  )}
                >
                  <dt className="font-black text-gray-500">{key}</dt>
                  <dd className="min-w-0 break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-8 font-black">پیش‌نمایش محتوا</h3>
            <div className="oeg-scroll mt-3 max-h-96 overflow-y-auto border-2 border-ink bg-white p-4 md:p-6">
              <MarkdownViewer content={form.content} />
            </div>
          </div>
        )}
      </div>

      {/* nav buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        {step > 0 ? (
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            className="h-11 border-2 border-ink font-bold hover:bg-gray-50 md:h-10"
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
            onClick={() => void publish()}
            disabled={publishing}
            className="oeg-hard-shadow h-12 border-2 border-ink px-8 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            {publishing ? <Spinner /> : <Upload className="size-5" aria-hidden="true" />}
            انتشار جزوه
          </Button>
        )}
      </div>
    </div>
  );
}
