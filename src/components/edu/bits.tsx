"use client";

// مُنت‌آموز — shared small UI pieces (avatars, state boxes, badges, skeletons, logo).

import { Loader2, Lock, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MR_STATUS_LABELS, SESSION_STATUS_LABELS, SESSION_STATUS_STYLES, TXN_LABELS, TXN_STYLES } from "@/lib/constants";
import type { MRStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEduStore } from "./store";

/** Persian initials: «مریم منتظری» → «م م» */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "؟";
  if (words.length === 1) return words[0].slice(0, 2);
  return `${words[0][0]} ${words[words.length - 1][0]}`;
}

/** Initial-based avatar (no images by design). */
export function InitialsAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex select-none items-center justify-center bg-gold font-black leading-none text-white",
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Git-branch style logo mark — brand/gold nodes on an ink branch. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-8", className)}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M7 8.5v8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
      <path
        d="M7 12c0-3.2 11.5-2.4 11.5 4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
      <circle cx="7" cy="5.75" r="2.6" fill="#DD614C" stroke="#111827" strokeWidth="1.6" />
      <circle cx="7" cy="18.5" r="2.6" fill="#DD614C" stroke="#111827" strokeWidth="1.6" />
      <circle cx="18.5" cy="18.5" r="2.6" fill="#DAA144" stroke="#111827" strokeWidth="1.6" />
    </svg>
  );
}

/** Centered error box with retry — every view uses this on fetch failure (never a white screen). */
export function ErrorBox({
  message,
  onRetry,
  compact,
}: {
  message?: string | null;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-2 border-danger bg-danger/5 text-center",
        compact ? "p-4" : "p-8"
      )}
    >
      <p className="font-black text-danger">دریافت اطلاعات ناموفق بود</p>
      <p className="mt-1 text-sm leading-6 text-gray-600">
        {message ?? "خطای نامشخص رخ داد."}
      </p>
      <Button
        variant="outline"
        onClick={onRetry}
        className="mt-4 h-11 border-2 border-danger text-danger hover:bg-danger/10 md:h-9"
      >
        تلاش دوباره
      </Button>
    </div>
  );
}

/** Empty-state box. */
export function EmptyBox({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <p className="font-black text-lg text-ink">{title}</p>
      {description && (
        <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Gold info note. */
export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-gold bg-gold/10 p-3 text-sm font-medium leading-6 text-[#7a5c1e]">
      {children}
    </div>
  );
}

/** Shown where a view requires a logged-in account. */
export function AuthRequiredBox({
  title,
  hint,
  actionLabel = "ورود | ثبت‌نام",
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
}) {
  const openAuth = useEduStore((s) => s.openAuth);
  return (
    <div className="mx-auto max-w-md border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <Lock className="mx-auto size-10 text-gray-400" aria-hidden="true" />
      <p className="mt-4 font-black text-lg">{title}</p>
      {hint && <p className="mt-2 text-sm leading-6 text-gray-500">{hint}</p>}
      <Button
        className="mt-5 h-11 border-2 border-ink px-6"
        onClick={() => openAuth(hint)}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

/** Skeleton grid matching the pamphlet-card layout. */
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-2 border-gray-200 bg-white p-4">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-14" />
          </div>
          <Skeleton className="mt-4 h-6 w-4/5" />
          <Skeleton className="mt-2 h-4 w-full" />
          <Skeleton className="mt-1 h-4 w-2/3" />
          <div className="mt-5 flex items-center justify-between">
            <Skeleton className="size-9" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generic page-level skeleton. */
export function PageSkeleton() {
  return (
    <div
      className="mx-auto max-w-7xl space-y-6 px-4 py-10"
      aria-busy="true"
      aria-label="در حال بارگذاری"
    >
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/** Inline spinner for busy buttons. */
export function Spinner() {
  return <Loader2 className="size-4 animate-spin" aria-hidden="true" />;
}

/** Merge-request status badge (باز / ادغام‌شده / ردشده). */
export function MRStatusBadge({ status }: { status: MRStatus }) {
  const styles: Record<MRStatus, string> = {
    OPEN: "border-gold bg-gold/15 text-[#8a6a24]",
    MERGED: "border-success bg-success/10 text-success",
    REJECTED: "border-danger bg-danger/10 text-danger",
  };
  return (
    <Badge className={cn("border-2 px-2 font-bold", styles[status])}>
      {MR_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/* ---------- Phase 2 — teaching marketplace ---------- */

/** Class-session status badge (رزرو شده / برگزار شده / لغو…). */
export function SessionStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        "border-2 px-2 font-bold",
        SESSION_STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-300"
      )}
    >
      {SESSION_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/** Wallet transaction type badge (شارژ / پرداخت جلسه / درآمد تدریس…). */
export function TxnTypeBadge({ type }: { type: string }) {
  return (
    <Badge
      className={cn(
        "border-2 px-2 font-bold",
        TXN_STYLES[type] ?? "bg-gray-100 text-gray-700 border-gray-300"
      )}
    >
      {TXN_LABELS[type] ?? type}
    </Badge>
  );
}

/** Course cover image with brutalist frame + gradient/PlayCircle fallback (no blue). */
export function CourseCover({
  src,
  title,
  className,
}: {
  src?: string | null;
  title: string;
  className?: string;
}) {
  return (
    <span className={cn("relative block overflow-hidden bg-white", className)}>
      {src ? (
        <img
          src={src}
          alt={`تصویر جلد دورهٔ «${title}»`}
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="flex size-full items-center justify-center bg-gradient-to-br from-[#f6efe4] to-[#fdf3ec]">
          <PlayCircle className="size-10 text-primary" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
