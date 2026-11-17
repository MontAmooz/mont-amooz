"use client";

// مُنت‌آموز — full notifications page (#/notifications, P11).
// Filter tabs (همه / خوانده‌نشده), pagination, mark-all-read; each row links
// to its notification target and marks it read on click.

import { Calendar, CheckCircle, ClipboardCheck, GitMerge, GitPullRequest, MessageSquare, ShoppingBag } from "lucide-react";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faRelative } from "@/lib/format";
import type { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AuthRequiredBox, EmptyBox, ErrorBox, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";

/** Module-level icon per notification type (static-components rule: no
 * component aliases created during render). */
function NotificationIcon({ type, unread }: { type: string; unread: boolean }) {
  switch (type) {
    case "MR_RECEIVED":
      return <GitPullRequest className="size-4" aria-hidden="true" />;
    case "MR_REVIEWED":
      return <GitMerge className="size-4" aria-hidden="true" />;
    case "REVIEW_RECEIVED":
      return <MessageSquare className="size-4" aria-hidden="true" />;
    case "SESSION_BOOKED":
      return <Calendar className="size-4" aria-hidden="true" />;
    case "SESSION_COMPLETED":
      return <CheckCircle className="size-4" aria-hidden="true" />;
    case "COURSE_PURCHASED":
      return <ShoppingBag className="size-4" aria-hidden="true" />;
    case "EXAM_COMPLETED":
      return <ClipboardCheck className="size-4" aria-hidden="true" />;
    default:
      return <GitMerge className="size-4" aria-hidden="true" />;
  }
}

/** One notification line — shared with the bell popover. */
export function NotificationRow({ n, compact }: { n: NotificationItem; compact?: boolean }) {
  const unread = n.readAt === null;
  return (
    <span className="flex w-full items-start gap-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center border-2",
          unread ? "border-primary bg-primary/10 text-primary" : "border-gray-200 bg-gray-50 text-gray-400"
        )}
        aria-hidden="true"
      >
        <NotificationIcon type={n.type} unread={unread} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm leading-6", unread ? "font-black" : "font-medium text-gray-600")}>
          {n.title}
          {unread && <span className="ms-2 inline-block size-2 rounded-full bg-danger" aria-label="خوانده‌نشده" />}
        </span>
        {n.body && (
          <span className={cn("block text-xs leading-6 text-gray-500", compact && "line-clamp-2")}>
            {n.body}
          </span>
        )}
        <span className="block text-[11px] text-gray-400">{faRelative(n.createdAt)}</span>
      </span>
    </span>
  );
}

export function NotificationsView() {
  const { user, sessionLoaded } = useEduStore();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);

  const list = useFetch<{ items: NotificationItem[]; total: number; page: number; pageSize: number }>(
    () => api(`/notifications?page=${page}&pageSize=20${filter === "unread" ? "&unread=true" : ""}`),
    [filter, page]
  );
  const refreshNotifications = useEduStore((s) => s.refreshNotifications);

  if (!sessionLoaded) return <PageSkeleton />;
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <AuthRequiredBox
          title="برای دیدن اعلان‌ها وارد حساب کاربری شوید"
          hint="اعلان‌ها فقط برای کاربر واردشده نمایش داده می‌شوند."
        />
      </div>
    );
  }

  const data = list.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function markAllRead() {
    try {
      const res = await api<{ updated: number }>("/notifications/read-all", { method: "POST" });
      toast({
        title: "همه اعلان‌ها خوانده شد",
        description: `${res.updated} اعلان به‌عنوان خوانده علامت‌گذاری شد.`,
      });
      refreshNotifications();
      list.retry();
    } catch (err) {
      toast({
        title: "علامت‌گذاری ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  }

  async function openNotification(n: NotificationItem) {
    try {
      if (!n.readAt) {
        await api(`/notifications/${n.id}/read`, { method: "POST" });
        refreshNotifications();
      }
      if (n.linkUrl) navigate(n.linkUrl);
    } catch {
      if (n.linkUrl) navigate(n.linkUrl);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black md:text-3xl">اعلان‌ها</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void markAllRead()}
          disabled={!data || data.total === 0}
          className="h-9 border-2 border-ink font-bold"
        >
          علامت‌گذاری همه به‌عنوان خوانده
        </Button>
      </div>

      <div role="tablist" aria-label="فیلتر اعلان‌ها" className="mt-6 flex gap-2">
        {(
          [
            ["all", "همه"],
            ["unread", "خوانده‌نشده"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            onClick={() => {
              setFilter(value);
              setPage(1);
            }}
            className={cn(
              "border-2 px-4 py-2 text-sm font-bold transition-colors",
              filter === value
                ? "border-ink bg-ink text-white"
                : "border-gray-200 bg-white text-gray-500 hover:border-ink hover:text-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {list.loading && !data ? (
          <div aria-busy="true">
            <PageSkeleton />
          </div>
        ) : list.error ? (
          <ErrorBox message={list.error} onRetry={list.retry} />
        ) : data && data.items.length > 0 ? (
          <>
            <ul className="divide-y divide-gray-100 border-2 border-ink bg-white">
              {data.items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => void openNotification(n)}
                    className="block w-full p-4 text-start transition-colors hover:bg-gray-50"
                  >
                    <NotificationRow n={n} />
                  </button>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <nav className="mt-4 flex items-center justify-center gap-3" aria-label="صفحه‌بندی">
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
            title={filter === "unread" ? "خوانده‌نشده‌ای ندارید" : "هنوز اعلانی ندارید"}
            description="اعلان‌های مربوط به جزوه‌ها، کلاس‌ها و دوره‌هایتان اینجا ظاهر می‌شوند."
          />
        )}
      </div>
    </div>
  );
}
