"use client";

// مُنت‌آموز — merge requests list view with status filter tabs.

import { ArrowLeft, GitPullRequest } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/client";
import { faRelative } from "@/lib/format";
import type { MergeRequestItem, MRStatus } from "@/lib/types";
import { EmptyBox, ErrorBox, MRStatusBadge } from "./bits";
import { useFetch } from "./hooks";

type StatusFilter = "" | MRStatus;

const EMPTY_MESSAGES: Record<StatusFilter, { title: string; description: string }> = {
  "": {
    title: "هنوز درخواست ادغامی ثبت نشده است",
    description: "وقتی معلمی جزوه‌ای را فورک و بهبود دهد، درخواست ادغامش اینجا ظاهر می‌شود.",
  },
  OPEN: {
    title: "درخواست ادغام بازی وجود ندارد",
    description: "همهٔ درخواست‌ها بررسی شده‌اند؛ حالا وقت فورک کردن و بهبود جزوه‌هاست!",
  },
  MERGED: {
    title: "هنوز ادغامی انجام نشده است",
    description: "اولین بهبود جامعه را شما پیشنهاد دهید؛ تاریخ‌ساز شوید.",
  },
  REJECTED: {
    title: "درخواست ردشده‌ای وجود ندارد",
    description: "خبر خوبی است — یعنی همهٔ پیشنهادها به جزوهٔ اصلی رسیده‌اند.",
  },
};

export function RequestsView() {
  const [status, setStatus] = useState<StatusFilter>("");

  const list = useFetch<{ items: MergeRequestItem[] }>(
    () => api<{ items: MergeRequestItem[] }>(`/merge-requests${status ? `?status=${status}` : ""}`),
    [status]
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-black">درخواست‌های ادغام</h1>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-500">
        وقتی معلمی جزوه‌ای را فورک می‌کند و بهبود می‌دهد، می‌تواند تغییراتش را با «درخواست ادغام»
        به جزوهٔ اصلی برگرداند؛ نویسندهٔ اصلی تغییرات را بررسی می‌کند و در صورت تأیید، نسخهٔ جدیدی
        از جزوه با ثبت سهم مشارکت‌کننده منتشر می‌شود.
      </p>

      <Tabs
        value={status}
        onValueChange={(v) => setStatus(v as StatusFilter)}
        className="mt-8"
      >
        <TabsList className="h-11 w-full grid-cols-4 sm:w-fit">
          <TabsTrigger value="" className="font-bold">همه</TabsTrigger>
          <TabsTrigger value="OPEN" className="font-bold">باز</TabsTrigger>
          <TabsTrigger value="MERGED" className="font-bold">ادغام‌شده</TabsTrigger>
          <TabsTrigger value="REJECTED" className="font-bold">ردشده</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-6">
        {list.loading && !list.data ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : list.error ? (
          <ErrorBox message={list.error} onRetry={list.retry} />
        ) : list.data && list.data.items.length > 0 ? (
          <ul className="space-y-3">
            {list.data.items.map((mr) => (
              <li key={mr.id}>
                <a
                  href={`#/request/${mr.id}`}
                  className="block border-2 border-ink bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <GitPullRequest className="size-5 text-gray-400" aria-hidden="true" />
                    <MRStatusBadge status={mr.status} />
                    <h2 className="min-w-0 flex-1 font-black leading-6">{mr.title}</h2>
                  </div>
                  {/* RTL: source on the right, arrow points left toward target */}
                  <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-600">
                    <span>از:</span>
                    <span className="font-bold text-ink">{mr.source.title}</span>
                    <ArrowLeft className="size-4 text-primary" aria-hidden="true" />
                    <span>به:</span>
                    <span className="font-bold text-ink">{mr.target.title}</span>
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    {mr.createdBy.fullName} · {faRelative(mr.createdAt)}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyBox
            title={EMPTY_MESSAGES[status].title}
            description={EMPTY_MESSAGES[status].description}
          />
        )}
      </div>
    </div>
  );
}
