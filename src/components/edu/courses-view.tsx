"use client";

// مُنت‌آموز — Phase 2 video-course store (#/courses): sticky filter aside (desktop) +
// filters Sheet (mobile), debounced search synced to listHash("courses", …), course grid.

import {
  ChevronLeft,
  ChevronRight,
  Filter,
  PlayCircle,
  Search,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { COURSE_SORT_OPTIONS, GRADES, SUBJECTS } from "@/lib/constants";
import { faNumber, faRating, faToman, toFaDigits } from "@/lib/format";
import type { CourseCard, CourseListResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CourseCover, EmptyBox, ErrorBox, SkeletonCards } from "./bits";
import { useDebounced, useFetch } from "./hooks";
import { listHash, navigate, type ListParams } from "./router";
import { RatingStars } from "./rating-stars";

const PAGE_SIZE = 12;

function CourseGridCard({ course }: { course: CourseCard }) {
  return (
    <a
      href={`#/course/${course.id}`}
      className="flex flex-col border-2 border-ink bg-white transition-all duration-150 hover:-translate-y-1 hover:border-primary hover:shadow-[4px_4px_0_0_#111827] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <CourseCover
        src={course.coverUrl}
        title={course.title}
        className="aspect-video w-full border-b-2 border-ink"
      />
      <div className="flex flex-1 flex-col p-4">
        <h2 className="line-clamp-2 min-h-11 font-black leading-6">{course.title}</h2>
        <p className="mt-1 truncate text-xs font-bold text-gray-500">{course.teacher.fullName}</p>

        <div className="mt-3 flex flex-wrap gap-1">
          <Badge variant="outline" className="border-2 border-gray-200 px-1.5 text-[11px] font-bold text-gray-600">
            {course.grade}
          </Badge>
          <Badge variant="outline" className="border-2 border-gray-200 px-1.5 text-[11px] font-bold text-gray-600">
            {course.subject}
          </Badge>
          {course.level && (
            <Badge variant="outline" className="border-2 border-gold bg-gold/10 px-1.5 text-[11px] font-bold text-[#8a6a24]">
              {course.level}
            </Badge>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t-2 border-gray-100 pt-3 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <RatingStars value={course.ratingAvg} />
            <b className="oeg-mono">{faRating(course.ratingAvg)}</b>
            <span className="oeg-mono text-gray-400">({faNumber(course.ratingCount)})</span>
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" />
            <b className="oeg-mono">{faNumber(course.studentCount)}</b>
          </span>
          <span className="flex items-center gap-1">
            <PlayCircle className="size-3.5" aria-hidden="true" />
            <b className="oeg-mono">{faNumber(course.lessonCount)}</b> درس
          </span>
        </div>

        <div className="mt-3">
          {course.price === 0 ? (
            <Badge className="border-2 border-gold bg-gold/15 px-2 font-black text-[#8a6a24]">رایگان</Badge>
          ) : (
            <span className="oeg-mono text-sm font-black text-primary">{faToman(course.price)}</span>
          )}
        </div>
      </div>
    </a>
  );
}

function FilterSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-black text-gray-500">{label}</Label>
      <Select value={value ?? "all"} onValueChange={(v) => onChange(v === "all" ? undefined : v)}>
        <SelectTrigger
          className="h-11 w-full border-2 border-gray-200 bg-white font-medium hover:border-ink md:h-10"
          aria-label={label}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function pageWindow(current: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export default function CoursesView({ params }: { params: ListParams }) {
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
      navigate(listHash("courses", { ...params, q: debouncedQ || undefined, page: 1 }));
    }
  }, [debouncedQ]);

  const [filtersOpen, setFiltersOpen] = useState(false);

  function setFilter(key: keyof ListParams, value: string | undefined) {
    navigate(listHash("courses", { ...params, [key]: value || undefined, page: 1 }));
  }

  const listQuery = useMemo(() => {
    const query = new URLSearchParams();
    if (params.q) query.set("query", params.q);
    if (params.grade) query.set("grade", params.grade);
    if (params.subject) query.set("subject", params.subject);
    query.set("sort", params.sort ?? "newest");
    query.set("page", String(params.page ?? 1));
    query.set("pageSize", String(PAGE_SIZE));
    return query.toString();
  }, [params.q, params.grade, params.subject, params.sort, params.page]);

  const list = useFetch<CourseListResponse>(
    () => api<CourseListResponse>(`/courses?${listQuery}`),
    [listQuery]
  );

  const activeFilters = useMemo(() => {
    const chips: Array<{ key: keyof ListParams; label: string }> = [];
    if (params.q) chips.push({ key: "q", label: `جستجو: ${params.q}` });
    if (params.grade) chips.push({ key: "grade", label: `پایه: ${params.grade}` });
    if (params.subject) chips.push({ key: "subject", label: `درس: ${params.subject}` });
    return chips;
  }, [params]);

  const total = list.data?.total ?? 0;
  const page = params.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtersPanel = (
    <div className="space-y-4">
      <FilterSelect
        label="پایهٔ تحصیلی"
        value={params.grade}
        options={GRADES.map((g) => ({ value: g, label: g }))}
        placeholder="همهٔ پایه‌ها"
        onChange={(v) => setFilter("grade", v)}
      />
      <FilterSelect
        label="درس"
        value={params.subject}
        options={SUBJECTS.map((s) => ({ value: s, label: s }))}
        placeholder="همهٔ درس‌ها"
        onChange={(v) => setFilter("subject", v)}
      />
      <Separator />
      <FilterSelect
        label="مرتب‌سازی"
        value={params.sort ?? "newest"}
        options={[...COURSE_SORT_OPTIONS]}
        placeholder="جدیدترین"
        onChange={(v) => setFilter("sort", v ?? "newest")}
      />
      <Button
        variant="outline"
        className="h-11 w-full border-2 border-ink font-bold hover:bg-gray-50 md:h-10"
        onClick={() => navigate(listHash("courses", { q: params.q }))}
      >
        <X className="size-4" aria-hidden="true" /> حذف فیلترها
      </Button>
    </div>
  );

  return (
    <div>
      {/* ---------- hero-lite band ---------- */}
      <section className="oeg-grid-bg border-b-2 border-ink bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 text-center md:py-14">
          <p className="oeg-mono text-sm font-bold text-gold">دوره‌های ویدیویی معلم‌ها</p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">دوره‌های ویدیویی</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-8 text-gray-600 md:text-base">
            دوره‌های ساختارمند همکاران؛ درس به درس تماشا کنید، پیشرفتان ثبت می‌شود و
            دسترسی مادام‌العمر است.
          </p>

          <form
            role="search"
            className="mx-auto mt-7 flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim() !== (params.q ?? "")) {
                navigate(listHash("courses", { ...params, q: q.trim() || undefined, page: 1 }));
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
                placeholder="جستجو در عنوان دوره‌ها و نام معلم‌ها…"
                aria-label="جستجو در دوره‌ها"
                className="h-12 border-2 border-ink bg-white ps-12 text-base focus-visible:border-primary"
              />
            </div>
            <Button type="submit" className="h-12 border-2 border-ink px-5 font-black" aria-label="جستجو">
              جستجو
            </Button>
          </form>
        </div>
      </section>

      {/* ---------- browse ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-10 md:py-12">
        <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
          <aside className="hidden lg:block" aria-label="فیلترهای دوره‌ها">
            <div className="sticky top-24 border-2 border-ink bg-white p-4">
              <h3 className="mb-4 flex items-center gap-2 font-black">
                <Filter className="size-4 text-primary" aria-hidden="true" /> فیلترها
                {activeFilters.length > 0 && (
                  <span className="oeg-mono border-2 border-ink bg-gold px-1.5 text-xs font-bold text-white">
                    {toFaDigits(activeFilters.length)}
                  </span>
                )}
              </h3>
              {filtersPanel}
            </div>
          </aside>

          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="font-black">
                {list.loading && !list.data ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <>
                    {faNumber(total)} <span className="text-gray-500">دوره</span>
                  </>
                )}
              </div>

              <Button
                variant="outline"
                className="h-11 border-2 border-ink font-bold lg:hidden"
                onClick={() => setFiltersOpen(true)}
              >
                <Filter className="size-4" aria-hidden="true" /> فیلترها
                {activeFilters.length > 0 && (
                  <span className="oeg-mono border-2 border-ink bg-gold px-1.5 text-xs font-bold text-white">
                    {toFaDigits(activeFilters.length)}
                  </span>
                )}
              </Button>

              <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
                {activeFilters.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setFilter(chip.key, undefined)}
                    className="inline-flex h-8 items-center gap-1 border-2 border-gray-200 bg-gray-50 px-2 text-xs font-bold text-gray-600 transition-colors hover:border-danger hover:text-danger"
                    aria-label={`حذف فیلتر ${chip.label}`}
                  >
                    {chip.label}
                    <X className="size-3" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            {list.loading ? (
              <SkeletonCards count={6} />
            ) : list.error ? (
              <ErrorBox message={list.error} onRetry={list.retry} />
            ) : list.data && list.data.items.length === 0 ? (
              <EmptyBox
                title={params.q || params.grade || params.subject ? "دوره‌ای مطابق فیلترها پیدا نشد" : "هنوز دوره‌ای منتشر نشده است"}
                description="فیلترها را تغییر دهید یا بعداً دوباره سر بزنید؛ معلم‌ها در حال ساخت دوره‌های تازه هستند."
                action={
                  <Button
                    variant="outline"
                    className="h-11 border-2 border-ink font-bold"
                    onClick={() => navigate(listHash("courses", {}))}
                  >
                    حذف فیلترها
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.data?.items.map((course) => (
                  <CourseGridCard key={course.id} course={course} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="صفحه‌بندی دوره‌ها">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => navigate(listHash("courses", { ...params, page: page - 1 }))}
                  className="h-11 w-11 border-2 border-ink p-0 md:h-10 md:w-10"
                  aria-label="صفحهٔ قبل"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
                {pageWindow(page, totalPages).map((item, i) =>
                  item === "…" ? (
                    <span key={`gap-${i}`} className="px-1 font-bold text-gray-400" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <Button
                      key={item}
                      variant="outline"
                      onClick={() => navigate(listHash("courses", { ...params, page: item }))}
                      aria-current={item === page ? "page" : undefined}
                      className={cn(
                        "oeg-mono h-11 w-11 border-2 p-0 font-bold md:h-10 md:w-10",
                        item === page
                          ? "border-ink bg-ink text-white hover:bg-ink"
                          : "border-ink bg-white hover:bg-gray-50"
                      )}
                    >
                      {faNumber(item)}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => navigate(listHash("courses", { ...params, page: page + 1 }))}
                  className="h-11 w-11 border-2 border-ink p-0 md:h-10 md:w-10"
                  aria-label="صفحهٔ بعد"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
              </nav>
            )}
          </div>
        </div>
      </section>

      {/* mobile filters sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="w-[300px] gap-0 overflow-y-auto p-0 sm:w-[320px]">
          <SheetHeader className="border-b-2 border-ink">
            <SheetTitle className="flex items-center gap-2 font-black">
              <Filter className="size-5 text-primary" aria-hidden="true" /> فیلترها
            </SheetTitle>
            <SheetDescription className="sr-only">
              فیلتر دوره‌ها بر اساس پایه و درس
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">{filtersPanel}</div>
          <SheetFooter className="border-t-2 border-gray-100">
            <Button
              className="h-11 w-full border-2 border-ink font-black"
              onClick={() => setFiltersOpen(false)}
            >
              مشاهدهٔ نتایج ({faNumber(total)})
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
