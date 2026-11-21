"use client";

// مُنت‌آموز — teacher analytics (#/teach/analytics, P17): cumulative views,
// forks, reviews and merge-requests per pamphlet + a four-card summary.
// Read-only dashboard over GET /users/me/analytics; every number is the same
// signal the rest of the platform already shows, just gathered in one place.

import { BarChart3, Eye, GitFork, GitMerge, FileText, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { faNumber, faRelative } from "@/lib/format";
import type { TeacherAnalytics } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AuthRequiredBox, EmptyBox, ErrorBox, PageSkeleton } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";

export default function TeacherAnalyticsView() {
  const { user, sessionLoaded } = useEduStore();
  const stats = useFetch<TeacherAnalytics>(() => api<TeacherAnalytics>("/users/me/analytics"), [user?.id]);

  if (!sessionLoaded) return <PageSkeleton />;
  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <AuthRequiredBox
          title="برای دیدن آمار جزوه‌ها وارد حساب کاربری شوید"
          hint="آمار فقط برای نویسندهٔ جزوه‌ها نمایش داده می‌شود."
        />
      </div>
    );
  }

  const data = stats.data;
  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black md:text-3xl">
            <BarChart3 className="size-7 text-primary" aria-hidden="true" /> آمار جزوه‌ها
          </h1>
          <p className="mt-2 text-sm leading-7 text-gray-500">
            نگاهی به بازخورد و خوانندگان جزوه‌های شما — بازدید، فورک، بازخورد و ادغام‌ها.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("#/teach")}
          className="h-11 border-2 border-ink font-bold md:h-10"
        >
          بازگشت به پنل تدریس
        </Button>
      </div>

      <div className="mt-8">
        {stats.loading && !data ? (
          <PageSkeleton />
        ) : stats.error ? (
          <ErrorBox message={stats.error} onRetry={stats.retry} />
        ) : data && summary && summary.pamphletCount === 0 ? (
          <EmptyBox
            title="شما هنوز جزوه‌ای نساخته‌اید"
            description="اولین جزوه را بارگذاری کنید تا آمار بازدید و بازخوردش اینجا جمع شود."
            action={
              <Button onClick={() => navigate("#/create")} className="h-11 border-2 border-ink font-black">
                بارگذاری جزوه
              </Button>
            }
          />
        ) : data && summary ? (
          <>
            {/* summary cards */}
            <div className="grid grid-cols-2 border-2 border-ink bg-white md:grid-cols-4">
              {(
                [
                  { icon: FileText, label: "جزوه", value: summary.pamphletCount },
                  { icon: Eye, label: "بازدید کل", value: summary.totalViews },
                  { icon: GitFork, label: "فورک کل", value: summary.totalForks },
                  { icon: Star, label: "بازخورد کل", value: summary.totalReviews },
                ] as const
              ).map((card, i) => (
                <div
                  key={card.label}
                  className={cn(
                    "p-4 text-center md:p-5",
                    i % 2 === 1 && "border-s-2 border-gray-100",
                    i >= 2 && "border-t-2 border-gray-100 md:border-t-0",
                    i >= 1 && "md:border-s-2 md:border-gray-100"
                  )}
                >
                  <card.icon className="mx-auto size-5 text-primary" aria-hidden="true" />
                  <p className="oeg-mono mt-2 text-xl font-black md:text-2xl">{faNumber(card.value)}</p>
                  <p className="mt-1 text-xs text-gray-500">{card.label}</p>
                </div>
              ))}
            </div>

            {/* per-pamphlet table */}
            <div className="oeg-scroll mt-6 overflow-x-auto border-2 border-ink bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b-2 border-ink bg-gray-50 text-xs text-gray-500">
                    <th className="p-3 text-start font-black">جزوه</th>
                    <th className="p-3 text-start font-black">پایه / درس</th>
                    <th className="p-3 text-start font-black">بازدید</th>
                    <th className="p-3 text-start font-black">فورک</th>
                    <th className="p-3 text-start font-black">بازخورد</th>
                    <th className="p-3 text-start font-black">ادغام</th>
                    <th className="p-3 text-start font-black">آخرین به‌روزرسانی</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="p-3">
                        <a href={`#/pamphlet/${p.id}`} className="font-black text-ink hover:text-primary">
                          {p.title}
                        </a>
                        <span className="oeg-mono ms-2 text-xs text-gray-400">v{faNumber(p.versionCount)}</span>
                      </td>
                      <td className="p-3 text-xs text-gray-600">
                        {p.grade} · {p.subject}
                      </td>
                      <td className="oeg-mono p-3 font-bold">{faNumber(p.viewCount)}</td>
                      <td className="oeg-mono p-3 font-bold">{faNumber(p.forkCount)}</td>
                      <td className="oeg-mono p-3 font-bold">{faNumber(p.reviewCount)}</td>
                      <td className="oeg-mono p-3">
                        {p.mergeRequestCount > 0 ? (
                          <Badge variant="outline" className="border-2 border-gold bg-gold/10 px-1.5 font-bold text-[#8a6a24]">
                            <GitMerge className="me-1 size-3" aria-hidden="true" /> {faNumber(p.mergeRequestCount)}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-gray-400">{faRelative(p.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              «ادغام» = پیشنهادهای ادغام دریافتی روی جزوه (باز و بسته).
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
