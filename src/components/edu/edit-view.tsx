"use client";

// مُنت‌آموز — edit content view (author only): publishes a new version.

import { ArrowRight, History } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { toFaDigits } from "@/lib/format";
import type { PamphletDetail } from "@/lib/types";
import { ErrorBox, PageSkeleton, Spinner } from "./bits";
import { ContentEditor } from "./content-editor";
import { useFetch } from "./hooks";
import { navigate } from "./router";

export function EditView({ id }: { id: string }) {
  const { toast } = useToast();
  const detail = useFetch<PamphletDetail>(
    () => api<PamphletDetail>(`/pamphlets/${id}`),
    [id]
  );

  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);
  const redirected = useRef(false);

  // load current content once per pamphlet
  useEffect(() => {
    if (detail.data && !initialized.current) {
      initialized.current = true;
      setContent(detail.data.content);
    }
  }, [detail.data]);

  // author-only guard
  useEffect(() => {
    if (detail.data && !detail.data.isMine && !redirected.current) {
      redirected.current = true;
      toast({
        title: "دسترسی محدود",
        description:
          "فقط نویسندهٔ جزوه می‌تواند نسخهٔ جدید ثبت کند؛ می‌توانید از جزوه فورک بگیرید و نسخهٔ خودتان را بسازید.",
        variant: "destructive",
      });
      navigate(`#/pamphlet/${id}`);
    }
  }, [detail.data, id, toast]);

  if (detail.loading && !detail.data) {
    return <PageSkeleton />;
  }

  if (detail.error || !detail.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorBox message={detail.error ?? "جزوه پیدا نشد."} onRetry={detail.retry} />
      </div>
    );
  }

  if (!detail.data.isMine) {
    return <PageSkeleton />; // redirecting to detail with error toast
  }

  async function save() {
    if (content.trim().length < 10) {
      toast({
        title: "محتوا خیلی کوتاه است",
        description: "جزوه باید حداقل چند سطر محتوا داشته باشد.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { versionNumber } = await api<{ versionNumber: number }>(
        `/pamphlets/${id}/versions`,
        {
          method: "POST",
          json: { content, changeSummary: summary.trim() || undefined },
        }
      );
      toast({
        title: `نسخهٔ ${toFaDigits(versionNumber)} ثبت شد`,
        description: "تغییرات شما در تاریخچهٔ جزوه قابل مشاهده است.",
      });
      navigate(`#/pamphlet/${id}`);
    } catch (err) {
      toast({
        title: "ثبت نسخه ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const p = detail.data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <a
        href={`#/pamphlet/${id}`}
        className="inline-flex h-9 items-center gap-1 text-sm font-bold text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowRight className="size-4" aria-hidden="true" /> بازگشت به جزوه
      </a>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black md:text-3xl">ویرایش: {p.title}</h1>
        <Badge variant="outline" className="border-2 border-ink px-2 font-bold">
          نسخهٔ فعلی: v{toFaDigits(p.latestVersionNumber)}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-7 text-gray-500">
        محتوای جدید به‌عنوان نسخهٔ بعدی ثبت می‌شود؛ تاریخچهٔ نسخه‌های قبلی محفوظ می‌ماند.
      </p>

      <div className="mt-8 space-y-6 border-2 border-ink bg-white p-4 md:p-8">
        <ContentEditor value={content} onChange={setContent} />

        <div className="space-y-1.5">
          <Label htmlFor="change-summary" className="text-sm font-black">
            خلاصهٔ تغییرات این نسخه
          </Label>
          <Input
            id="change-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="مثلاً: افزودن تمرین‌های فصل ۲ و اصلاح دو اشتباه تایپی"
            className="h-11 border-2 bg-white md:h-10"
          />
          <p className="text-xs text-gray-400">
            این خلاصه در تاریخچهٔ نسخه‌ها نمایش داده می‌شود — مثل پیام کامیت در گیت.
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(`#/pamphlet/${id}`)}
          className="h-11 border-2 border-ink font-bold hover:bg-gray-50 md:h-10"
        >
          انصراف
        </Button>
        <Button
          onClick={() => void save()}
          disabled={saving}
          className="oeg-hard-shadow h-12 border-2 border-ink px-8 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
        >
          {saving ? <Spinner /> : <History className="size-5" aria-hidden="true" />}
          ثبت نسخهٔ جدید
        </Button>
      </div>
    </div>
  );
}
