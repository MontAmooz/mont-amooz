"use client";

// مُنت‌آموز — related pamphlets strip on the detail page (P17).
// Fetches /pamphlets/[id]/related once the detail arrives; renders a compact
// horizontal scroll of cards. Renders NOTHING on error/empty — discovery is
// promotional, never load-bearing.

import { BookOpen } from "lucide-react";
import { api } from "@/lib/client";
import { faNumber, faRating } from "@/lib/format";
import type { PamphletSummary, RelatedPamphletsResponse } from "@/lib/types";
import { useFetch } from "./hooks";

export function RelatedPamphlets({ pamphletId, enabled }: { pamphletId: string; enabled: boolean }) {
  const related = useFetch<RelatedPamphletsResponse>(
    () => api<RelatedPamphletsResponse>(`/pamphlets/${pamphletId}/related`),
    [pamphletId],
    { enabled }
  );

  if (!enabled || related.error) return null;
  const items: PamphletSummary[] = related.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section className="mt-8" aria-label="جزوه‌های مرتبط">
      <h2 className="flex items-center gap-2 text-lg font-black md:text-xl">
        <BookOpen className="size-5 text-primary" aria-hidden="true" /> جزوه‌های مرتبط
      </h2>
      {related.loading && !related.data ? (
        <div className="mt-3 h-24 animate-pulse border-2 border-gray-100 bg-gray-50" aria-hidden="true" />
      ) : (
        <ul className="oeg-scroll mt-3 flex gap-3 overflow-x-auto pb-2">
          {items.map((r) => (
            <li key={r.id} className="w-64 shrink-0">
              <a
                href={`#/pamphlet/${r.id}`}
                className="flex h-full flex-col border-2 border-ink bg-white p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-[5px_5px_0_0_#111827] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="line-clamp-2 text-sm font-black leading-6">{r.title}</span>
                <span className="mt-1 text-xs font-bold text-primary">{r.author.fullName}</span>
                <span className="mt-3 flex flex-wrap gap-1 text-[11px] font-bold text-gray-600">
                  <span className="border-2 border-gray-200 px-1.5 py-0.5">{r.grade}</span>
                  <span className="border-2 border-gray-200 px-1.5 py-0.5">{r.subject}</span>
                </span>
                <span className="mt-3 flex items-center justify-between border-t-2 border-gray-100 pt-2 text-xs text-gray-500">
                  <span className="oeg-mono font-bold">{faNumber(r.viewCount)} بازدید</span>
                  {r.ratingAvg > 0 && (
                    <span className="oeg-mono font-bold">★ {faRating(r.ratingAvg)}</span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
