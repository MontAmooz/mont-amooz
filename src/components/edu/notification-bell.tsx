"use client";

// مُنت‌آموز — notification bell (P11): unread badge + last-10 popover.
// Badge count comes from the store's 30s polling; the popover fetches on open.

import { Bell } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faNumber } from "@/lib/format";
import type { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Spinner } from "./bits";
import { navigate } from "./router";
import { useEduStore } from "./store";
import { NotificationRow } from "./notifications-view";

export function NotificationBell() {
  const user = useEduStore((s) => s.user);
  const unread = useEduStore((s) => s.unreadNotifications);
  const refreshNotifications = useEduStore((s) => s.refreshNotifications);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      setLoading(true);
      try {
        const res = await api<{ items: NotificationItem[] }>("/notifications?pageSize=10");
        setItems(res.items);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
  }

  async function openNotification(n: NotificationItem) {
    try {
      if (!n.readAt) {
        await api(`/notifications/${n.id}/read`, { method: "POST" });
        refreshNotifications();
        setItems((prev) =>
          prev ? prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) : prev
        );
      }
      setOpen(false);
      if (n.linkUrl) navigate(n.linkUrl);
    } catch {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => void toggle()}
        className="relative flex h-11 items-center justify-center border-2 border-transparent px-2 text-gray-600 transition-colors hover:border-gray-200 hover:text-ink md:h-10"
        aria-label={`اعلان‌ها${unread > 0 ? ` (${faNumber(unread)} خوانده‌نشده)` : ""}`}
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-0.5 start-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-danger px-1 text-[10px] font-black text-white">
            {unread > 9 ? "۹+" : faNumber(unread)}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="اعلان‌های اخیر"
            className="absolute end-0 z-50 mt-2 w-80 border-2 border-ink bg-white shadow-lg"
          >
            <div className="flex items-center justify-between border-b-2 border-gray-100 p-3">
              <span className="text-sm font-black">اعلان‌های اخیر</span>
              <a
                href="#/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-bold text-primary hover:underline"
              >
                مشاهدهٔ همه
              </a>
            </div>
            {loading ? (
              <p className="flex items-center justify-center gap-2 p-6 text-sm text-gray-500">
                <Spinner /> در حال بارگذاری…
              </p>
            ) : items && items.length > 0 ? (
              <ul className="oeg-scroll max-h-96 divide-y divide-gray-100 overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => void openNotification(n)}
                      className="block w-full p-3 text-start transition-colors hover:bg-gray-50"
                    >
                      <NotificationRow n={n} compact />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-center text-sm text-gray-400">اعلانی ندارید</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
