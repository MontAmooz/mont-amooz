"use client";

// مُنت‌آموز — shared Markdown content editor with live preview (used by create + edit views).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MarkdownViewer } from "./markdown-viewer";

interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}

export function ContentEditor({ value, onChange, invalid }: ContentEditorProps) {
  const [preview, setPreview] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-black">
          محتوای جزوه <span className="text-danger">*</span>
        </Label>
        <div className="flex items-center gap-1" role="tablist" aria-label="حالت ویرایش محتوا">
          <Button
            type="button"
            size="sm"
            variant={preview ? "outline" : "secondary"}
            onClick={() => setPreview(false)}
            className={cn("h-9 border-2 font-bold", !preview && "border-ink")}
            aria-pressed={!preview}
          >
            ویرایش
          </Button>
          <Button
            type="button"
            size="sm"
            variant={preview ? "secondary" : "outline"}
            onClick={() => setPreview(true)}
            className={cn("h-9 border-2 font-bold", preview && "border-ink")}
            aria-pressed={preview}
          >
            پیش‌نمایش
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="oeg-scroll max-h-[32rem] min-h-80 overflow-y-auto border-2 border-ink bg-white p-4 md:p-6">
          <MarkdownViewer content={value} />
        </div>
      ) : (
        <Textarea
          dir="rtl"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={"# عنوان درس\n\nمتن جزوه را اینجا بنویسید…\n\nفرمول درجا: $x^2 + y^2$\nفرمول نمایشی: $$\\frac{a}{b}$$"}
          className={cn(
            "min-h-80 border-2 bg-white p-4 text-sm leading-8",
            invalid && "border-danger"
          )}
        />
      )}

      <p className="text-xs leading-6 text-gray-500">
        از قالب‌بندی مارک‌داون استفاده کنید: <span className="oeg-mono" dir="ltr">#</span> عنوان،{" "}
        <span className="oeg-mono" dir="ltr">**مهم**</span>، فهرست‌ها و جدول‌ها. فرمول‌های ریاضی با{" "}
        <span className="oeg-mono" dir="ltr">$فرمول$</span> (درجا) و{" "}
        <span className="oeg-mono" dir="ltr">$$نمایشی$$</span> پشتیبانی می‌شوند.
      </p>
    </div>
  );
}
