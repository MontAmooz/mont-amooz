"use client";

// مُنت‌آموز — pamphlet content renderer (Markdown + $math$ via KaTeX, RTL).

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Skeleton } from "@/components/ui/skeleton";

interface MarkdownViewerProps {
  content?: string | null;
  loading?: boolean;
}

export function MarkdownViewer({ content, loading }: MarkdownViewerProps) {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="در حال بارگذاری محتوا">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!content) {
    return <p className="text-sm text-gray-400">محتوایی برای نمایش ثبت نشده است.</p>;
  }

  return (
    <div dir="rtl" className="oeg-markdown">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
