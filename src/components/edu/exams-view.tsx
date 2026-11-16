"use client";

// مُنت‌آموز — exam list (#/exams, P12): filters, cards, teacher CTA.

import { ClipboardList, Plus, Users } from "lucide-react";
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
import type { ExamSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyBox, ErrorBox, PageSkeleton } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";

export function ExamsView({ mine }: { mine?: boolean }) {
  const { user, sessionLoaded } = useEduStore();
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: "12",
    ...(mine ? { mine: "true" } : {}),
    ...(query.trim() ? { query: query.trim() } : {}),
    ...(grade ? { grade } : {}),
    ...(subject ? { subject } : {}),
  });
  const list = useFetch<{ items: ExamSummary[]; total: number; pageSize: number }>(
    () => apiFetch(params),
    [params.toString()]
  );

  const data = list.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const isTeacher = user?.role === "معلم";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black md:text-3xl">
            <ClipboardList className="size-7 text-primary" aria-hidden="true" />
            {mine ? "آزمون‌های من" : "آزمون‌ها"}
          </h1>
          <p className="mt-2 text-sm leading-7 text-gray-500">
            {mine
              ? "آزمون‌هایی که ساخته‌اید — پیش‌نویس و منتشر."
              : "آزمون‌های چندگزینه‌ای معلمان — شرکت کنید و بلافاصله نمره بگیرید."}
          </p>
        </div>
        {mine && isTeacher && (
          <Button
            onClick={() => navigate("#/exam/new")}
            className="h-11 border-2 border-ink px-5 font-black md:h-10"
          >
            <Plus className="size-4" aria-hidden="true" /> ساخت آزمون جدید
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
          placeholder="جستجو در عنوان آزمون…"
          aria-label="جستجوی آزمون"
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
              {data.items.map((e) => (
                <a
                  key={e.id}
                  href={`#/exam/${e.id}`}
                  className="block border-2 border-ink bg-white p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-ink)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-black leading-7">{e.title}</h3>
                    {!e.published && (
                      <Badge variant="outline" className="shrink-0 border-2 border-gold px-1.5 text-xs font-bold text-[#8a6a24]">
                        پیش‌نویس
                      </Badge>
                    )}
                  </div>
                  {e.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-6 text-gray-500">{e.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="font-bold text-primary">{e.teacher.fullName}</span>
                    <span>{e.grade}</span>
                    <span>{e.subject}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t-2 border-gray-100 pt-3 text-xs">
                    <span className="oeg-mono flex items-center gap-1 font-bold text-gray-600">
                      <ClipboardList className="size-3.5" aria-hidden="true" /> {faNumber(e.questionCount)} سؤال
                    </span>
                    <span className="oeg-mono flex items-center gap-1 text-gray-500">
                      <Users className="size-3.5" aria-hidden="true" /> {faNumber(e.attemptCount)} شرکت‌کننده
                    </span>
                    {e.avgScore !== null && (
                      <span
                        className={cn(
                          "oeg-mono ms-auto font-black",
                          e.avgScore >= 80 ? "text-success" : e.avgScore >= 50 ? "text-gold" : "text-danger"
                        )}
                      >
                        میانگین {faNumber(Math.round(e.avgScore))}٪
                      </span>
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
            title={mine ? "هنوز آزمونی نساخته‌اید" : "هنوز آزمونی منتشر نشده است"}
            description={
              mine
                ? "با «ساخت آزمون جدید» اولین آزمون چندگزینه‌ای خود را بسازید."
                : "به‌محض انتشار اولین آزمون، اینجا نمایش داده می‌شود."
            }
            action={
              mine && isTeacher ? (
                <Button onClick={() => navigate("#/exam/new")} className="h-11 border-2 border-ink font-black">
                  <Plus className="size-4" aria-hidden="true" /> ساخت آزمون جدید
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

function apiFetch(params: URLSearchParams) {
  return api<{ items: ExamSummary[]; total: number; pageSize: number }>(`/exams?${params.toString()}`);
}
