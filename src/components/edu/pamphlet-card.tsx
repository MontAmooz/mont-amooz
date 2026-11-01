"use client";

// مُنت‌آموز — pamphlet summary card (grid item everywhere: home browse, profiles).

import { Eye, GitFork, History } from "lucide-react";
import { DIFFICULTY_STYLES, METHOD_STYLES } from "@/lib/constants";
import { faNumber, faRating } from "@/lib/format";
import type { PamphletSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { InitialsAvatar } from "./bits";
import { RatingStars } from "./rating-stars";

export function PamphletCard({ pamphlet }: { pamphlet: PamphletSummary }) {
  const p = pamphlet;

  return (
    <a
      href={`#/pamphlet/${p.id}`}
      className="group flex flex-col border-2 border-ink bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary hover:shadow-[4px_4px_0_0_#DD614C] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {/* badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "border px-2 py-0.5 text-xs font-bold",
            METHOD_STYLES[p.teachingMethod] ?? "border-gray-300 bg-gray-100 text-gray-700"
          )}
        >
          {p.teachingMethod}
        </span>
        <span
          className={cn(
            "border px-2 py-0.5 text-xs font-bold",
            DIFFICULTY_STYLES[p.difficulty] ?? "border-gray-300 bg-gray-100 text-gray-700"
          )}
        >
          {p.difficulty}
        </span>
        {p.forkedFromTitle && (
          <span className="inline-flex items-center gap-1 border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs font-bold text-gray-500">
            <GitFork className="size-3" aria-hidden="true" />
            فورک از: {p.forkedFromTitle}
          </span>
        )}
      </div>

      {/* title + description */}
      <h3 className="mt-3 line-clamp-2 text-lg font-black leading-7 transition-colors group-hover:text-primary">
        {p.title}
      </h3>
      {p.description && (
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">{p.description}</p>
      )}

      {/* author */}
      <div className="mt-4 flex items-center gap-2">
        <InitialsAvatar name={p.author.fullName} className="size-9 border-2 border-ink text-xs" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{p.author.fullName}</p>
          <p className="truncate text-xs text-gray-500">
            پایهٔ {p.grade} · {p.subject}
          </p>
        </div>
      </div>

      {/* stats */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t-2 border-gray-100 pt-3 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <RatingStars value={p.ratingAvg} />
          <span className="font-bold text-ink">{faRating(p.ratingAvg)}</span>
          <span>({faNumber(p.ratingCount)})</span>
        </span>
        <span className="flex items-center gap-1">
          <Eye className="size-4 text-gray-400" aria-hidden="true" />
          <span className="oeg-mono">{faNumber(p.viewCount)}</span>
        </span>
        <span className="flex items-center gap-1">
          <GitFork className="size-4 text-gray-400" aria-hidden="true" />
          <span className="oeg-mono">{faNumber(p.forkCount)}</span>
        </span>
        <span className="flex items-center gap-1">
          <History className="size-4 text-gray-400" aria-hidden="true" />
          <span className="oeg-mono">{faNumber(p.versionCount)}</span>
        </span>
      </div>
    </a>
  );
}
