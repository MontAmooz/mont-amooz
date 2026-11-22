"use client";

// مُنت‌آموز — report-content dialog (P20): any signed-in user can report a
// pamphlet or a Q&A comment. The report only opens a queue entry for the
// admin — it never modifies the target directly.

import { Flag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { toFaDigits } from "@/lib/format";
import type { ReportReason, ReportTargetType } from "@/lib/types";
import { Spinner } from "./bits";

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: "spam", label: "اسپم یا تبلیغ" },
  { value: "copyright", label: "کپی‌برداری و نقض حق مؤلف" },
  { value: "inappropriate", label: "محتوای نامناسب" },
  { value: "harassment", label: "آزار و اذیت" },
  { value: "other", label: "سایر" },
];

export function ReportDialog({
  targetType,
  targetId,
  open,
  onOpenChange,
}: {
  targetType: ReportTargetType;
  targetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      await api("/reports", {
        method: "POST",
        json: {
          targetType,
          targetId,
          reason,
          details: details.trim() || undefined,
        },
      });
      toast({ title: "گزارش شما ثبت شد", description: "مدیر سایت آن را بررسی می‌کند." });
      setDetails("");
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "ثبت گزارش ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-2 border-ink sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <Flag className="size-5 text-primary" aria-hidden="true" /> گزارش محتوا
          </DialogTitle>
          <DialogDescription>
            این {targetType === "pamphlet" ? "جزوه" : "پیام"} را برای مدیر سایت گزارش می‌کنید —
            فقط مدیر گزارش را می‌بیند.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={reason}
          onValueChange={(v) => setReason(v as ReportReason)}
          className="gap-2"
          aria-label="دلیل گزارش"
        >
          {REASONS.map((r) => (
            <Label
              key={r.value}
              htmlFor={`report-reason-${r.value}`}
              className="flex cursor-pointer items-center gap-2 border-2 border-gray-200 px-3 py-2 text-sm font-bold hover:border-ink"
            >
              <RadioGroupItem value={r.value} id={`report-reason-${r.value}`} />
              {r.label}
            </Label>
          ))}
        </RadioGroup>

        <div className="space-y-1.5">
          <Label htmlFor="report-details" className="text-sm font-bold">
            توضیحات (اختیاری)
          </Label>
          <Textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="اگر توضیحی دارید بنویسید…"
          />
          <p className="oeg-mono text-xs text-gray-400">{toFaDigits(details.length)} / ۵۰۰</p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 border-2 border-ink font-bold"
          >
            انصراف
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy}
            className="h-11 border-2 border-ink font-black"
          >
            {busy ? <Spinner /> : <Flag className="size-4" aria-hidden="true" />} ارسال گزارش
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
