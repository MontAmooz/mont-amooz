"use client";

// مُنت‌آموز — Phase 2 teaching marketplace (#/market): find teachers with open slots,
// search + sort (URL-synced via listHash), teacher cards → booking page.

import { BookOpen, GraduationCap, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { MARKET_SORT_OPTIONS } from "@/lib/constants";
import { faNumber, faRating, faToman, toFaDigits } from "@/lib/format";
import type { MarketTeacher } from "@/lib/types";
import { EmptyBox, ErrorBox, InitialsAvatar, SkeletonCards } from "./bits";
import { useDebounced, useFetch } from "./hooks";
import { listHash, navigate, type ListParams } from "./router";

function TeacherCard({ teacher }: { teacher: MarketTeacher }) {
  return (
    <article className="flex flex-col border-2 border-ink bg-white p-5 transition-all duration-150 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#111827]">
      <div className="flex items-center gap-3">
        <InitialsAvatar name={teacher.fullName} className="size-14 border-2 border-ink text-lg" />
        <div className="min-w-0">
          <h2 className="truncate font-black">{teacher.fullName}</h2>
          {teacher.title && <p className="truncate text-xs font-bold text-gray-500">{teacher.title}</p>}
        </div>
      </div>

      {teacher.expertise && (
        <div className="mt-3 flex flex-wrap gap-1">
          {teacher.expertise
            .split(/[,،]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 4)
            .map((tag) => (
              <span
                key={tag}
                className="border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] font-bold text-gray-600"
              >
                {tag}
              </span>
            ))}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 border-y-2 border-gray-100 py-3 text-center">
        <div>
          <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-400">
            <GraduationCap className="size-3.5" aria-hidden="true" /> جلسات
          </dt>
          <dd className="oeg-mono mt-1 text-sm font-black">{faNumber(teacher.sessionCount)}</dd>
        </div>
        <div className="border-x-2 border-gray-100">
          <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-400">
            <Star className="size-3.5" aria-hidden="true" /> امتیاز کلاس
          </dt>
          <dd className="oeg-mono mt-1 text-sm font-black">{faRating(teacher.avgSessionRating)}</dd>
        </div>
        <div>
          <dt className="flex items-center justify-center gap-1 text-[11px] text-gray-400">
            <BookOpen className="size-3.5" aria-hidden="true" /> جزوه‌ها
          </dt>
          <dd className="oeg-mono mt-1 text-sm font-black">{faNumber(teacher.pamphletCount)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm">
        {teacher.minPrice != null ? (
          <>
            شروع از{" "}
            <span className="oeg-mono font-black text-ink">{faToman(teacher.minPrice)}</span>
          </>
        ) : (
          <span className="text-gray-400">—</span>
        )}
        <span className="ms-1 text-xs text-gray-400">
          ({toFaDigits(teacher.openSlotCount)} زمان آزاد)
        </span>
      </p>

      <Button
        onClick={() => navigate(`#/book/${teacher.id}`)}
        className="mt-4 h-11 w-full border-2 border-ink font-black md:h-10"
      >
        رزرو کلاس
      </Button>
    </article>
  );
}

export default function MarketView({ params }: { params: ListParams }) {
  // search input — synced to URL (debounced 300ms), same adopt pattern as home-view
  const [q, setQ] = useState(params.q ?? "");
  const debouncedQ = useDebounced(q, 300);
  const urlQ = params.q ?? "";
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    if (urlQ !== q && urlQ !== debouncedQ) {
      setQ(urlQ);
    }
  }

  useEffect(() => {
    if (debouncedQ !== (params.q ?? "")) {
      navigate(listHash("market", { ...params, q: debouncedQ || undefined, page: 1 }));
    }
  }, [debouncedQ]);

  const marketQuery = useMemo(() => {
    const query = new URLSearchParams();
    if (params.q) query.set("query", params.q);
    query.set("sort", params.sort ?? "rating");
    return query.toString();
  }, [params.q, params.sort]);

  const market = useFetch<{ items: MarketTeacher[] }>(
    () => api<{ items: MarketTeacher[] }>(`/market/teachers?${marketQuery}`),
    [marketQuery]
  );

  const items = market.data?.items ?? [];

  return (
    <div>
      {/* ---------- hero-lite band ---------- */}
      <section className="oeg-grid-bg border-b-2 border-ink bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 text-center md:py-14">
          <p className="oeg-mono text-sm font-bold text-gold">فاز ۲ تازه رسید</p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">بازارچهٔ تدریس</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-8 text-gray-600 md:text-base">
            از همان معلمی که جزوه‌اش را خواندی، کلاس خصوصی رزرو کن؛ زمان آزاد معلم‌ها را ببین،
            پرداخت امن انجام بده و در کلاس آنلاین شرکت کن.
          </p>

          <form
            role="search"
            className="mx-auto mt-7 flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim() !== (params.q ?? "")) {
                navigate(listHash("market", { ...params, q: q.trim() || undefined, page: 1 }));
              }
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="جستجوی معلم، تخصص یا توضیحات…"
                aria-label="جستجوی معلم‌ها"
                className="h-12 border-2 border-ink bg-white ps-12 text-base focus-visible:border-primary"
              />
            </div>
            <Button type="submit" className="h-12 border-2 border-ink px-5 font-black" aria-label="جستجو">
              جستجو
            </Button>
          </form>
        </div>
      </section>

      {/* ---------- results ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="font-black">
            {market.loading && !market.data ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <>
                {faNumber(items.length)} <span className="text-gray-500">معلم آمادهٔ تدریس</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-500">مرتب‌سازی</span>
            <Select
              value={params.sort ?? "rating"}
              onValueChange={(v) => navigate(listHash("market", { ...params, sort: v, page: 1 }))}
            >
              <SelectTrigger
                className="h-11 w-52 border-2 border-gray-200 bg-white font-medium hover:border-ink md:h-10"
                aria-label="مرتب‌سازی معلم‌ها"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKET_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {market.loading ? (
          <SkeletonCards count={6} />
        ) : market.error ? (
          <ErrorBox message={market.error} onRetry={market.retry} />
        ) : items.length === 0 ? (
          <EmptyBox
            title={params.q ? "معلمی با این جستجو پیدا نشد" : "فعلاً معلمی زمان آزاد ثبت نکرده است"}
            description={
              params.q
                ? "عبارت دیگری را جستجو کنید؛ مثلاً نام درس یا تخصص موردنظرتان."
                : "به‌محض اینکه معلم‌ها زمان آزادشان را اعلام کنند، اینجا ظاهر می‌شوند؛ کمی بعد دوباره سر بزنید."
            }
            action={
              params.q ? (
                <Button
                  variant="outline"
                  className="h-11 border-2 border-ink font-bold"
                  onClick={() => navigate(listHash("market", {}))}
                >
                  حذف جستجو
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
