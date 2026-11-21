"use client";

// مُنت‌آموز — subject landing page (#/subject/[subject], P17): every pamphlet
// of one subject, grouped by grade or teaching method (client-side grouping
// over one ≤48-row fetch). Cross-links to the other subjects at the bottom.

import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { SUBJECTS, TEACHING_METHODS } from "@/lib/constants";
import { faNumber } from "@/lib/format";
import type { PamphletListResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyBox, ErrorBox, PageSkeleton } from "./bits";
import { PamphletCard } from "./pamphlet-card";
import { useFetch } from "./hooks";
import { navigate } from "./router";

type GroupMode = "grade" | "method";

export default function SubjectView({ subject }: { subject: string }) {
  const [mode, setMode] = useState<GroupMode>("grade");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const isValid = (SUBJECTS as readonly string[]).includes(subject);
  const list = useFetch<PamphletListResponse>(
    () => api<PamphletListResponse>(`/pamphlets?subject=${encodeURIComponent(subject)}&pageSize=48&sort=popular`),
    [subject]
  );

  const groups = useMemo(() => {
    const items = list.data?.items ?? [];
    const by = new Map<string, typeof items>();
    for (const p of items) {
      const key = mode === "grade" ? p.grade : p.teachingMethod;
      const bucket = by.get(key) ?? [];
      bucket.push(p);
      by.set(key, bucket);
    }
    // grade groups follow the canonical GRADES order, method groups the
    // TEACHING_METHODS order; anything unknown goes last
    const order: readonly string[] = mode === "grade"
      ? ["هفتم", "هشتم", "نهم", "دهم", "یازدهم", "دوازدهم"]
      : TEACHING_METHODS;
    const keys = [...by.keys()].sort((a, b) => {
      const ia = (order as readonly string[]).indexOf(a);
      const ib = (order as readonly string[]).indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return keys.map((key) => ({ key, items: by.get(key)! }));
  }, [list.data, mode]);

  if (!isValid) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorBox message="درس نامعتبر است" onRetry={() => navigate("#/")} />
      </div>
    );
  }

  const total = list.data?.total ?? 0;

  return (
    <div>
      {/* hero band */}
      <section className="oeg-grid-bg border-b-2 border-ink bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 text-center md:py-12">
          <p className="oeg-mono text-sm font-bold text-gold">مرور بر اساس درس</p>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">{subject}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-8 text-gray-600">
            همهٔ جزوه‌های {subject} — {faNumber(total)} جزوه، دسته‌بندی‌شده بر اساس{" "}
            {mode === "grade" ? "پایهٔ تحصیلی" : "روش تدریس"}.
          </p>
          <div className="mt-5 inline-flex border-2 border-ink bg-white" role="group" aria-label="حالت دسته‌بندی">
            {(
              [
                { value: "grade", label: "بر اساس پایه" },
                { value: "method", label: "بر اساس روش تدریس" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={mode === option.value}
                onClick={() => setMode(option.value)}
                className={cn(
                  "h-11 px-5 text-sm font-black transition-colors md:h-10",
                  mode === option.value ? "bg-ink text-white" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* groups */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        {list.loading && !list.data ? (
          <PageSkeleton />
        ) : list.error ? (
          <ErrorBox message={list.error} onRetry={list.retry} />
        ) : total === 0 ? (
          <EmptyBox
            title={`هنوز جزوه‌ای برای ${subject} منتشر نشده است`}
            description="به‌محض انتشار اولین جزوه، اینجا نمایش داده می‌شود."
            action={
              <Button variant="outline" onClick={() => navigate("#/")} className="h-11 border-2 border-ink font-bold">
                <BookOpen className="size-4" aria-hidden="true" /> مرور همهٔ جزوه‌ها
              </Button>
            }
          />
        ) : (
          <div className="space-y-8">
            {groups.map((group) => {
              const isCollapsed = collapsed[group.key] ?? false;
              return (
                <div key={group.key}>
                  <button
                    type="button"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !isCollapsed }))}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-center gap-2 border-s-4 border-gold ps-3 text-start"
                  >
                    <h2 className="text-xl font-black">
                      {mode === "grade" ? `پایهٔ ${group.key}` : group.key}
                    </h2>
                    <span className="oeg-mono text-sm font-bold text-gray-400">
                      {faNumber(group.items.length)} جزوه
                    </span>
                    <span className="ms-auto text-gray-400" aria-hidden="true">
                      {isCollapsed ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {group.items.map((p) => (
                        <PamphletCard key={p.id} pamphlet={p} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* cross-links to other subjects */}
            <div className="border-t-2 border-gray-100 pt-6">
              <p className="text-sm font-black text-gray-500">درس‌های دیگر:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUBJECTS.filter((s) => s !== subject).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => navigate(`#/subject/${encodeURIComponent(s)}`)}
                    className="h-9 border-2 border-gray-200 bg-white px-3 text-sm font-bold text-gray-600 transition-colors hover:border-ink hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
