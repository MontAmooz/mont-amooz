"use client";

// مُنت‌آموز — home view: hero, live stats, browse (filters + grid), how-it-works, top teachers.

import {
  Award,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  GitFork,
  GitMerge,
  GraduationCap,
  PlayCircle,
  Search,
  Star,
  Upload,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import {
  DIFFICULTIES,
  GRADES,
  SORT_OPTIONS,
  SUBJECTS,
  TEACHING_METHODS,
} from "@/lib/constants";
import { faNumber, faRating, toFaDigits } from "@/lib/format";
import type {
  PamphletListResponse,
  PlatformStats,
  TopTeacher,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyBox, ErrorBox, InitialsAvatar, SkeletonCards } from "./bits";
import { useDebounced, useFetch } from "./hooks";
import { PamphletCard } from "./pamphlet-card";
import { homeHash, navigate, type HomeParams } from "./router";
import { useEduStore } from "./store";

const PAGE_SIZE = 12;

/** GET /stats extended in Phase 2 with sessions + courses (older responses may omit them). */
interface PlatformStatsP2 extends PlatformStats {
  sessions?: number;
  courses?: number;
}

const GRADE_OPTIONS = GRADES.map((g) => ({ value: g, label: g }));
const SUBJECT_OPTIONS = SUBJECTS.map((s) => ({ value: s, label: s }));
const METHOD_OPTIONS = TEACHING_METHODS.map((m) => ({ value: m, label: m }));
const DIFFICULTY_OPTIONS = DIFFICULTIES.map((d) => ({ value: d, label: d }));

function SectionHead({
  overline,
  title,
  desc,
}: {
  overline: string;
  title: string;
  desc?: string;
}) {
  return (
    <div>
      <p className="oeg-mono text-xs font-bold text-gold">{overline}</p>
      <h2 className="mt-2 text-2xl font-black md:text-3xl">{title}</h2>
      {desc && <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{desc}</p>}
    </div>
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
      <Select
        value={value ?? "all"}
        onValueChange={(v) => onChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="h-11 w-full border-2 border-gray-200 bg-white font-medium hover:border-ink md:h-10" aria-label={label}>
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

function FiltersPanel({
  params,
  onSet,
  onClear,
}: {
  params: HomeParams;
  onSet: (key: keyof HomeParams, value: string | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-4">
      <FilterSelect
        label="پایهٔ تحصیلی"
        value={params.grade}
        options={GRADE_OPTIONS}
        placeholder="همهٔ پایه‌ها"
        onChange={(v) => onSet("grade", v)}
      />
      <FilterSelect
        label="درس"
        value={params.subject}
        options={SUBJECT_OPTIONS}
        placeholder="همهٔ درس‌ها"
        onChange={(v) => onSet("subject", v)}
      />
      <FilterSelect
        label="روش تدریس"
        value={params.method}
        options={METHOD_OPTIONS}
        placeholder="همهٔ روش‌ها"
        onChange={(v) => onSet("method", v)}
      />
      <FilterSelect
        label="سطح جزوه"
        value={params.difficulty}
        options={DIFFICULTY_OPTIONS}
        placeholder="همهٔ سطوح"
        onChange={(v) => onSet("difficulty", v)}
      />
      <Separator />
      <FilterSelect
        label="مرتب‌سازی"
        value={params.sort ?? "newest"}
        options={[...SORT_OPTIONS]}
        placeholder="جدیدترین"
        onChange={(v) => onSet("sort", v ?? "newest")}
      />
      <Button
        variant="outline"
        className="h-11 w-full border-2 border-ink font-bold hover:bg-gray-50 md:h-10"
        onClick={onClear}
      >
        <X className="size-4" aria-hidden="true" /> حذف فیلترها
      </Button>
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

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="صفحه‌بندی نتایج">
      <Button
        variant="outline"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
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
            onClick={() => onPage(item)}
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
        onClick={() => onPage(page + 1)}
        className="h-11 w-11 border-2 border-ink p-0 md:h-10 md:w-10"
        aria-label="صفحهٔ بعد"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}

const HOW_IT_WORKS: Array<{ icon: LucideIcon; title: string; desc: string }> = [
  {
    icon: Upload,
    title: "آپلود جزوه",
    desc: "جزوهٔ خود را با فرمت مارک‌داون منتشر کنید؛ نام شما برای همیشه کنار آن می‌ماند.",
  },
  {
    icon: Star,
    title: "بازبینی و امتیاز جامعه",
    desc: "معلم‌های دیگر جزوهٔ شما را می‌بینند، امتیاز می‌دهند و بازخورد فنی می‌گذارند.",
  },
  {
    icon: GitFork,
    title: "فورک و بهبود",
    desc: "هر معلمی می‌تواند نسخه‌ای از جزوه بردارد و آن را برای کلاس خودش بهبود دهد.",
  },
  {
    icon: GitMerge,
    title: "پیشنهاد ادغام و ثبت سهم",
    desc: "بهبودها با «درخواست ادغام» به جزوهٔ اصلی برمی‌گردد و سهم فکری هر نفر ثبت می‌شود.",
  },
];

export function HomeView({ params }: { params: HomeParams }) {
  const { user, openAuth } = useEduStore();

  // search input — synced to URL (debounced 300ms)
  const [q, setQ] = useState(params.q ?? "");
  const debouncedQ = useDebounced(q, 300);
  const urlQ = params.q ?? "";
  // canonical "adjust state when a prop changes" pattern (react.dev): adopt URL q
  // when it changed from outside (navbar search, chip removal, back-navigation) —
  // but never wipe in-flight typing: a URL value equal to q or the pending
  // debounce value is a change we pushed ourselves.
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    if (urlQ !== q && urlQ !== debouncedQ) {
      setQ(urlQ);
    }
  }

  useEffect(() => {
    if (debouncedQ !== (params.q ?? "")) {
      navigate(homeHash({ ...params, q: debouncedQ || undefined, page: 1 }));
    }
  }, [debouncedQ]);

  const [filtersOpen, setFiltersOpen] = useState(false);

  function setFilter(key: keyof HomeParams, value: string | undefined) {
    navigate(homeHash({ ...params, [key]: value || undefined, page: 1 }));
  }

  // pamphlet list (URL-state driven)
  const listQuery = useMemo(() => {
    const query = new URLSearchParams();
    if (params.q) query.set("query", params.q);
    if (params.grade) query.set("grade", params.grade);
    if (params.subject) query.set("subject", params.subject);
    if (params.method) query.set("method", params.method);
    if (params.difficulty) query.set("difficulty", params.difficulty);
    query.set("sort", params.sort ?? "newest");
    query.set("page", String(params.page ?? 1));
    query.set("pageSize", String(PAGE_SIZE));
    return query.toString();
  }, [params.q, params.grade, params.subject, params.method, params.difficulty, params.sort, params.page]);

  const list = useFetch<PamphletListResponse>(
    () => api<PamphletListResponse>(`/pamphlets?${listQuery}`),
    [listQuery]
  );

  const stats = useFetch<PlatformStatsP2>(() => api<PlatformStatsP2>("/stats"), []);
  const teachers = useFetch<{ items: TopTeacher[] }>(
    () => api<{ items: TopTeacher[] }>("/users/top"),
    []
  );

  function goToCreate() {
    if (!user) {
      openAuth("برای بارگذاری جزوه ابتدا وارد حساب کاربری شوید.");
      return;
    }
    navigate("#/create");
  }

  const activeFilters = useMemo(() => {
    const chips: Array<{ key: keyof HomeParams; label: string }> = [];
    if (params.q) chips.push({ key: "q", label: `جستجو: ${params.q}` });
    if (params.grade) chips.push({ key: "grade", label: `پایه: ${params.grade}` });
    if (params.subject) chips.push({ key: "subject", label: `درس: ${params.subject}` });
    if (params.method) chips.push({ key: "method", label: `روش: ${params.method}` });
    if (params.difficulty) chips.push({ key: "difficulty", label: `سطح: ${params.difficulty}` });
    return chips;
  }, [params]);

  const total = list.data?.total ?? 0;
  const page = params.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const statsCells: Array<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: FileText, label: "جزوه‌ها", value: stats.loading ? "…" : stats.data ? faNumber(stats.data.pamphlets) : "—" },
    { icon: Users, label: "معلم‌ها", value: stats.loading ? "…" : stats.data ? faNumber(stats.data.teachers) : "—" },
    { icon: GraduationCap, label: "جلسات برگزارشده", value: stats.loading ? "…" : stats.data ? faNumber(stats.data.sessions ?? 0) : "—" },
    { icon: PlayCircle, label: "دوره‌ها", value: stats.loading ? "…" : stats.data ? faNumber(stats.data.courses ?? 0) : "—" },
  ];

  return (
    <div>
      {/* ---------- hero ---------- */}
      <section className="oeg-grid-bg border-b-2 border-ink bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 text-center md:py-16">
          <p className="oeg-mono text-sm font-bold text-gold">⟨ پلتفرم آموزشی گیت‌محور ⟩</p>
          <h1 className="mt-4 text-4xl font-black leading-[1.25] md:text-5xl lg:text-6xl">
            کتابخانهٔ زندهٔ
            <br />
            جزوه‌های درسی ایران
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-gray-600 md:text-base">
            همه‌چیز را همه‌کس می‌داند؛ ما تصمیم گرفتیم همه را کنار هم بیاوریم.
            معلم‌ها جزوه می‌گذارند، جامعه بهترش می‌کند — مثل گیت‌هاب، برای آموزش.
          </p>

          <form
            role="search"
            className="mx-auto mt-8 flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              // the debounced effect pushes q to the URL; submit forces it immediately
              if (q.trim() !== (params.q ?? "")) {
                navigate(homeHash({ ...params, q: q.trim() || undefined, page: 1 }));
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
                placeholder="جستجو در عنوان، توضیحات و محتوای جزوه‌ها…"
                aria-label="جستجو در جزوه‌ها"
                className="h-12 border-2 border-ink bg-white ps-12 text-base focus-visible:border-primary"
              />
            </div>
            <Button
              type="submit"
              className="h-12 border-2 border-ink px-5 font-black md:px-6"
              aria-label="جستجو"
            >
              جستجو
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={goToCreate}
              className="oeg-hard-shadow h-12 border-2 border-ink px-6 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              <Upload className="size-5" aria-hidden="true" /> بارگذاری جزوه
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                document.getElementById("browse")?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="h-12 border-2 border-ink px-6 text-base font-black hover:bg-gray-50"
            >
              مرور جزوه‌ها
            </Button>
          </div>
        </div>
      </section>

      {/* ---------- stats strip ---------- */}
      <section className="border-b-2 border-ink bg-ink text-white" aria-label="آمار پلتفرم">
        <div className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-4">
          {statsCells.map((cell, i) => (
            <div
              key={cell.label}
              className={cn(
                "p-4 text-center md:p-6",
                i % 2 === 1 && "border-s-2 border-white/15",
                i >= 2 && "border-t-2 border-white/15 md:border-t-0",
                i >= 1 && "md:border-s-2 md:border-white/15"
              )}
            >
              <cell.icon className="mx-auto size-6 text-gold" aria-hidden="true" />
              <p className="oeg-mono mt-2 text-2xl font-bold md:text-3xl">{cell.value}</p>
              <p className="mt-1 text-xs text-white/60">{cell.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Phase 2 promo band ---------- */}
      <section className="border-b-2 border-ink bg-secondary" aria-label="تازه‌های مُنت‌آموز">
        <div className="mx-auto max-w-7xl px-4 py-8 md:py-10">
          <p className="oeg-mono text-center text-xs font-bold text-[#8a6a24]">
            جدید | فاز ۲
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <a
              href="#/market"
              className="group flex items-start gap-4 border-2 border-ink bg-white p-5 transition-all duration-150 hover:-translate-y-1 hover:shadow-[5px_5px_0_0_#111827] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex size-12 shrink-0 items-center justify-center border-2 border-ink bg-primary text-white">
                <GraduationCap className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-black">بازارچهٔ تدریس</span>
                <span className="mt-1 block text-sm leading-6 text-gray-600">
                  از همان معلمی که جزوه‌اش را خواندی، کلاس خصوصی رزرو کن — با تختهٔ سفید زنده.
                </span>
              </span>
            </a>
            <a
              href="#/courses"
              className="group flex items-start gap-4 border-2 border-ink bg-white p-5 transition-all duration-150 hover:-translate-y-1 hover:shadow-[5px_5px_0_0_#111827] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="flex size-12 shrink-0 items-center justify-center border-2 border-ink bg-gold text-white">
                <PlayCircle className="size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-black">دوره‌های ویدیویی</span>
                <span className="mt-1 block text-sm leading-6 text-gray-600">
                  دوره‌های ساختارمند معلم‌ها؛ درس‌به‌درس تماشا کن، پیشرفتت ثبت می‌شود.
                </span>
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ---------- browse ---------- */}
      <section id="browse" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-10 md:py-14">
        <SectionHead
          overline="مرور و فیلتر"
          title="جزوه‌های کتابخانه"
          desc="با فیلترهای پایه، درس، روش تدریس و سطح، دقیقاً همان جزوه‌ای را پیدا کنید که برای کلاس خودتان لازم دارید."
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[260px,1fr]">
          {/* desktop filters */}
          <aside className="hidden lg:block" aria-label="فیلترهای جستجو">
            <div className="sticky top-24 border-2 border-ink bg-white p-4">
              <h3 className="mb-4 flex items-center gap-2 font-black">
                <Filter className="size-4 text-primary" aria-hidden="true" /> فیلترها
                {activeFilters.length > 0 && (
                  <span className="oeg-mono border-2 border-ink bg-gold px-1.5 text-xs font-bold text-white">
                    {toFaDigits(activeFilters.length)}
                  </span>
                )}
              </h3>
              <FiltersPanel
                params={params}
                onSet={setFilter}
                onClear={() => navigate(homeHash({ q: params.q }))}
              />
            </div>
          </aside>

          <div>
            {/* toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="font-black">
                {list.loading && !list.data ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <>
                    {faNumber(total)} <span className="text-gray-500">جزوه</span>
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

            {/* results */}
            {list.loading ? (
              <SkeletonCards count={6} />
            ) : list.error ? (
              <ErrorBox message={list.error} onRetry={list.retry} />
            ) : list.data && list.data.items.length === 0 ? (
              <EmptyBox
                title="جزوه‌ای مطابق جستجوی شما پیدا نشد"
                description="فیلترها را تغییر دهید، عبارت دیگری را جستجو کنید یا اولین جزوه در این موضوع را خودتان بارگذاری کنید."
                action={
                  <Button
                    variant="outline"
                    className="h-11 border-2 border-ink font-bold"
                    onClick={() => navigate(homeHash({}))}
                  >
                    حذف فیلترها
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.data?.items.map((p) => (
                  <PamphletCard key={p.id} pamphlet={p} />
                ))}
              </div>
            )}

            <Pagination
              page={page}
              totalPages={totalPages}
              onPage={(p) => navigate(homeHash({ ...params, page: p }))}
            />
          </div>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="border-y-2 border-ink bg-gray-50" aria-label="چطور کار می‌کند">
        <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
          <SectionHead
            overline="چرخهٔ همکاری"
            title="چطور کار می‌کند؟"
            desc="مثل گیت‌هاب، اما برای جزوه‌های درسی؛ هر بهبودی ثبت می‌شود و سهم صاحبانش محفوظ می‌ماند."
          />
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <li
                key={step.title}
                className="border-2 border-ink bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#111827]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center border-2 border-ink bg-gold font-black text-white">
                    <step.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="oeg-mono text-3xl font-bold text-gray-200">
                    {faNumber(i + 1)}
                  </span>
                </div>
                <h3 className="mt-4 font-black">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- top teachers ---------- */}
      {teachers.data && teachers.data.items.length > 0 && (
        <section id="top-teachers" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-10 md:py-14">
          <SectionHead
            overline="جامعهٔ معلم‌ها"
            title="معلم‌های برتر"
            desc="فعال‌ترین مؤلفان و مشارکت‌کنندگان کتابخانه — با جزوه، ادغام و امتیاز واقعی جامعه."
          />
          <div className="oeg-scroll -mx-4 mt-8 flex snap-x gap-4 overflow-x-auto px-4 pb-3">
            {teachers.data.items.map((t) => (
              <a
                key={t.id}
                href={`#/user/${t.id}`}
                className="w-[240px] shrink-0 snap-start border-2 border-ink bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={t.fullName} className="size-12 border-2 border-ink text-base" />
                  <div className="min-w-0">
                    <p className="truncate font-black">{t.fullName}</p>
                    {t.title && <p className="truncate text-xs text-gray-500">{t.title}</p>}
                  </div>
                </div>
                {t.expertise && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {t.expertise
                      .split(/[,،]/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 3)
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
                <div className="mt-3 flex items-center justify-between border-t-2 border-gray-100 pt-3 text-xs text-gray-600">
                  <span>
                    جزوه: <b className="oeg-mono">{faNumber(t.pamphletCount)}</b>
                  </span>
                  <span>
                    ادغام: <b className="oeg-mono">{faNumber(t.mergedCount)}</b>
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="size-3.5 text-gold" aria-hidden="true" />
                    <b className="oeg-mono">{faRating(t.avgRating)}</b>
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* mobile filters sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="w-[300px] gap-0 overflow-y-auto p-0 sm:w-[320px]">
          <SheetHeader className="border-b-2 border-ink">
            <SheetTitle className="flex items-center gap-2 font-black">
              <Filter className="size-5 text-primary" aria-hidden="true" /> فیلترها
            </SheetTitle>
            <SheetDescription className="sr-only">
              فیلتر جزوه‌ها بر اساس پایه، درس، روش تدریس و سطح
            </SheetDescription>
          </SheetHeader>
          <div className="p-4">
            <FiltersPanel
              params={params}
              onSet={setFilter}
              onClear={() => navigate(homeHash({ q: params.q }))}
            />
          </div>
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
