"use client";

// مُنت‌آموز — interactive lessons list (#/lessons, P15): grade/subject filters,
// debounced search, lesson cards with the viewer's progress bar, teacher CTA.

import { BookOpenCheck, CheckCircle2, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRADES, SUBJECTS } from "@/lib/constants";
import { faNumber } from "@/lib/format";
import type { LessonSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyBox, ErrorBox, PageSkeleton } from "./bits";
import { useDebounced, useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";

export function LessonsView({ mine }: { mine?: boolean }) {
  const { user, sessionLoaded } = useEduStore();
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebounced(query, 300);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: "12",
    ...(mine ? { mine: "true" } : {}),
    ...(debouncedQuery.trim() ? { query: debouncedQuery.trim() } : {}),
    ...(grade ? { grade } : {}),
    ...(subject ? { subject } : {}),
  });
  const list = useFetch<{ items: LessonSummary[]; total: number; pageSize: number }>(
    () => api<{ items: LessonSummary[]; total: number; pageSize: number }>(
      `/interactive-lessons?${params.toString()}`
    ),
    [params.toString(), user?.id]
  );

  const data = list.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const isTeacher = user?.role === "معلم";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black md:text-3xl">
            <BookOpenCheck className="size-7 text-primary" aria-hidden="true" />
            {mine ? "درس‌های تعاملی من" : "درس‌های تعاملی"}
          </h1>
          <p className="mt-2 text-sm leading-7 text-gray-500">
            {mine
              ? "درس‌هایی که ساخته‌اید — پیش‌نویس و منتشر."
              : "یادگیری گام‌به‌گام: بخوانید، پاسخ دهید، درست جلو بروید — مثل تمرینِ حل‌مسئله."}
          </p>
        </div>
        {isTeacher && (
          <Button
            onClick={() => navigate("#/lesson/new")}
            className="h-11 border-2 border-ink px-5 font-black md:h-10"
          >
            <Plus className="size-4" aria-hidden="true" /> ساخت درس جدید
          </Button>
        )}
      </div>

      {/* filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="جستجو در عنوان درس…"
          aria-label="جستجوی درس تعاملی"
          className="h-11 w-full max-w-xs border-2 border-gray-200 bg-white px-3 text-sm font-medium outline-none transition-colors placeholder:text-gray-400 focus:border-ink md:h-10"
        />
        <Select
          value={grade || "all"}
          onValueChange={(v) => {
            setGrade(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-11 w-40 border-2 border-gray-200 bg-white font-medium hover:border-ink md:h-10" aria-label="پایه">
            <SelectValue placeholder="همهٔ پایه‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همهٔ پایه‌ها</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={subject || "all"}
          onValueChange={(v) => {
            setSubject(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-11 w-40 border-2 border-gray-200 bg-white font-medium hover:border-ink md:h-10" aria-label="درس">
            <SelectValue placeholder="همهٔ درس‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همهٔ درس‌ها</SelectItem>
            {SUBJECTS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-8">
        {list.loading && !data ? (
          <PageSkeleton />
        ) : list.error ? (
          <ErrorBox message={list.error} onRetry={list.retry} />
        ) : data && data.items.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((l) => (
                <a
                  key={l.id}
                  href={`#/lesson/${l.id}`}
                  className="block border-2 border-ink bg-white p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-ink)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-black leading-7">{l.title}</h3>
                    {l.myProgress?.completed && (
                      <Badge variant="outline" className="shrink-0 border-2 border-gold bg-gold/10 px-1.5 text-xs font-black text-[#8a6a24]">
                        <CheckCircle2 className="me-1 size-3.5" aria-hidden="true" /> تکمیل شده
                      </Badge>
                    )}
                    {!l.published && (
                      <Badge variant="outline" className="shrink-0 border-2 border-gold px-1.5 text-xs font-bold text-[#8a6a24]">
                        پیش‌نویس
                      </Badge>
                    )}
                  </div>
                  {l.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-6 text-gray-500">{l.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="font-bold text-primary">{l.teacher.fullName}</span>
                    <span>{l.grade}</span>
                    <span>{l.subject}</span>
                    {l.estimatedMinutes && <span>~{faNumber(l.estimatedMinutes)} دقیقه</span>}
                  </div>
                  <div className="mt-3 border-t-2 border-gray-100 pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="oeg-mono flex items-center gap-1 font-bold text-gray-600">
                        <BookOpenCheck className="size-3.5" aria-hidden="true" /> {faNumber(l.stepCount)} گام
                      </span>
                      <span
                        className={cn(
                          "oeg-mono font-bold",
                          l.myProgress?.completed ? "text-success" : l.myProgress ? "text-gold" : "text-gray-400"
                        )}
                      >
                        {l.myProgress
                          ? l.myProgress.completed
                            ? "تکمیل شده ✓"
                            : `در حال یادگیری (${faNumber(l.myProgress.currentStep)} از ${faNumber(l.stepCount)})`
                          : "شروع نکرده"}
                      </span>
                    </div>
                    {l.myProgress && (
                      <div
                        className="mt-2 h-2 border-2 border-ink bg-white"
                        role="progressbar"
                        aria-valuenow={Math.min(100, Math.round((l.myProgress.currentStep / Math.max(1, l.stepCount)) * 100))}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`پیشرفت شما در ${l.title}`}
                      >
                        <div
                          className={cn("h-full", l.myProgress.completed ? "bg-success" : "bg-gold")}
                          style={{
                            width: `${Math.min(100, Math.round((l.myProgress.currentStep / Math.max(1, l.stepCount)) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </a>
              ))}
            </div>
            {totalPages > 1 && (
              <nav className="mt-6 flex items-center justify-center gap-3" aria-label="صفحه‌بندی">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-9 border-2 border-ink font-bold"
                >
                  قبلی
                </Button>
                <span className="text-sm font-bold text-gray-500">
                  صفحه {page} از {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-9 border-2 border-ink font-bold"
                >
                  بعدی
                </Button>
              </nav>
            )}
          </>
        ) : (
          <EmptyBox
            title={mine ? "هنوز درس تعاملی نساخته‌اید" : "هنوز درس تعاملی منتشر نشده است"}
            description={
              mine
                ? "با «ساخت درس جدید» اولین درس گام‌به‌گام خود را بسازید."
                : "به‌محض انتشار اولین درس تعاملی، اینجا نمایش داده می‌شود."
            }
            action={
              mine && isTeacher ? (
                <Button onClick={() => navigate("#/lesson/new")} className="h-11 border-2 border-ink font-black">
                  <Plus className="size-4" aria-hidden="true" /> ساخت درس جدید
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
