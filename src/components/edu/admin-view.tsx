"use client";

// مُنت‌آموز — admin panel (#/admin): founder-only moderation toolkit (P20).
// Three tabs: داشبورد (metrics + recent activity), گزارش‌ها (report queue
// with hide/resolve actions), کاربران (user table + reset tokens + suspend).
// P10 reset-token flow is unchanged; P20 adds the report/suspend surfaces.

import { Copy, Flag, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faDate, faNumber, faRelative, faToman } from "@/lib/format";
import type {
  AdminDashboard,
  AdminUserRow,
  ReportItem,
  ReportListResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { AuthRequiredBox, EmptyBox, ErrorBox, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { useEduStore } from "./store";

interface AdminUsersResponse {
  items: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface IssuedReset {
  token: string;
  expiresAt: string;
  userFullName: string;
  userEmail: string;
}

const TAB_TRIGGER =
  "rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-bold text-gray-500 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none";

export function AdminView() {
  const { user, sessionLoaded } = useEduStore();
  const [tab, setTab] = useState("dashboard");

  if (!sessionLoaded) return <PageSkeleton />;
  if (!user?.isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <AuthRequiredBox
          title="پنل مدیریت فقط برای مدیر سایت است"
          hint="اگر مدیر هستید و این صفحه را می‌بینید، با حساب مدیر وارد شوید."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-black md:text-3xl">پنل مدیریت</h1>
      </div>
      <p className="mt-2 text-sm leading-7 text-gray-500">
        داشبورد وضعیت، صف گزارش‌ها و مدیریت کاربران. کدهای بازنشانی رمز را از طریق واتساپ/تلگرام
        برای کاربر بفرستید — هر کد ۲۴ ساعت اعتبار دارد و فقط یک‌بار قابل استفاده است.
      </p>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b-2 border-gray-200 bg-transparent p-0 sm:w-fit">
          <TabsTrigger value="dashboard" className={TAB_TRIGGER}>
            داشبورد
          </TabsTrigger>
          <TabsTrigger value="reports" className={TAB_TRIGGER}>
            گزارش‌ها
          </TabsTrigger>
          <TabsTrigger value="users" className={TAB_TRIGGER}>
            کاربران
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="reports" className="mt-6">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- dashboard tab ---------------- */

function DashboardTab() {
  const stats = useFetch<AdminDashboard>(() => api<AdminDashboard>("/admin/dashboard"), []);

  if (stats.loading && !stats.data) return <PageSkeleton />;
  if (stats.error) return <ErrorBox message={stats.error} onRetry={stats.retry} />;
  const data = stats.data;
  if (!data) return null;

  const m = data.metrics;
  const cards = [
    { label: "کاربران", value: m.totalUsers },
    { label: "عضو جدید (۷ روز)", value: m.newUsersLast7Days },
    { label: "معلق‌شده", value: m.suspendedUsers },
    { label: "جزوه‌ها", value: m.totalPamphlets },
    { label: "جزوه‌های پنهان", value: m.hiddenPamphlets },
    { label: "پیام‌های پرسش و پاسخ", value: m.totalComments },
    { label: "آزمون‌ها", value: m.totalExams },
    { label: "درس‌های تعاملی", value: m.totalLessons },
    { label: "گزارش‌های در انتظار", value: m.pendingReports },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-px border-2 border-ink bg-gray-100 md:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="bg-white p-4 text-center">
            <p className="oeg-mono text-xl font-black md:text-2xl">{faNumber(card.value)}</p>
            <p className="mt-1 text-xs text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black">
            <Flag className="size-4 text-primary" aria-hidden="true" /> آخرین گزارش‌ها
          </h2>
          {data.recentReports.length === 0 ? (
            <p className="mt-3 border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
              هنوز گزارشی ثبت نشده است.
            </p>
          ) : (
            <ul className="mt-3 border-2 border-ink bg-white">
              {data.recentReports.map((r) => (
                <ReportMiniRow key={r.id} report={r} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-black">آخرین ثبت‌نام‌ها</h2>
          <ul className="mt-3 border-2 border-ink bg-white">
            {data.recentSignups.map((u) => (
              <li key={u.id} className="flex items-center gap-3 border-b border-gray-100 p-3 last:border-b-0">
                <span className="font-bold">{u.fullName}</span>
                <span className="oeg-mono text-xs text-gray-400" dir="ltr">{u.email}</span>
                <span className="ms-auto text-xs text-gray-400">{faRelative(u.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Compact report line for the dashboard — same shape as the queue row, minus actions. */
function ReportMiniRow({ report }: { report: ReportItem }) {
  return (
    <li className="border-b border-gray-100 p-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ReportStatusBadge status={report.status} />
        <a href={report.targetUrl} className="min-w-0 truncate font-black hover:text-primary">
          {report.targetSummary}
        </a>
        <span className="text-xs text-gray-400">{reasonLabel(report.reason)}</span>
        <span className="ms-auto text-xs text-gray-400">{faRelative(report.createdAt)}</span>
      </div>
    </li>
  );
}

/* ---------------- reports queue tab ---------------- */

function ReportsTab() {
  const [status, setStatus] = useState<"PENDING" | "all">("PENDING");
  const list = useFetch<ReportListResponse>(
    () => api<ReportListResponse>(`/admin/reports?status=${status}&pageSize=50`),
    [status]
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant={status === "PENDING" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatus("PENDING")}
          className="h-9 border-2 border-ink font-bold"
        >
          در انتظار بررسی
        </Button>
        <Button
          variant={status === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatus("all")}
          className="h-9 border-2 border-ink font-bold"
        >
          همه
        </Button>
      </div>

      {list.loading && !list.data ? (
        <PageSkeleton />
      ) : list.error ? (
        <ErrorBox message={list.error} onRetry={list.retry} />
      ) : list.data && list.data.items.length === 0 ? (
        <EmptyBox
          title={status === "PENDING" ? "صف گزارش‌ها خالی است" : "گزارشی ثبت نشده است"}
          description={status === "PENDING" ? "هیچ گزارش در انتظاری وجود ندارد." : undefined}
        />
      ) : list.data ? (
        <div className="oeg-scroll overflow-x-auto border-2 border-ink bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b-2 border-ink bg-gray-50 text-xs text-gray-500">
                <th className="p-3 text-start font-black">محتوا</th>
                <th className="p-3 text-start font-black">دلیل</th>
                <th className="p-3 text-start font-black">گزارش‌دهنده</th>
                <th className="p-3 text-start font-black">وضعیت</th>
                <th className="p-3 text-start font-black">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((r) => (
                <ReportQueueRow key={r.id} report={r} onChanged={list.retry} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ReportQueueRow({ report, onChanged }: { report: ReportItem; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(kind: string, fn: () => Promise<unknown>, okTitle: string) {
    setBusy(kind);
    try {
      await fn();
      toast({ title: okTitle });
      onChanged();
    } catch (err) {
      toast({
        title: "عملیات ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="p-3">
        <a href={report.targetUrl} className="font-black hover:text-primary">
          {report.targetSummary}
        </a>
        <span className="oeg-mono ms-2 text-xs text-gray-400">
          {report.targetType === "pamphlet" ? "جزوه" : "پیام"}
        </span>
        {report.details && (
          <p className="mt-1 max-w-md text-xs leading-6 text-gray-500">«{report.details}»</p>
        )}
      </td>
      <td className="p-3 text-xs text-gray-600">{reasonLabel(report.reason)}</td>
      <td className="p-3 text-xs font-bold text-gray-600">{report.reporter.fullName}</td>
      <td className="p-3">
        <ReportStatusBadge status={report.status} />
        {report.reviewedBy && (
          <p className="mt-1 text-[11px] text-gray-400">
            {report.reviewedBy.fullName} · {faRelative(report.reviewedAt ?? report.createdAt)}
          </p>
        )}
      </td>
      <td className="p-3">
        {report.status === "PENDING" ? (
          <div className="flex flex-wrap gap-2">
            {report.targetType === "pamphlet" ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    "hide",
                    () =>
                      api(`/admin/pamphlets/${report.targetId}/hide`, {
                        method: "PATCH",
                        json: { hidden: true },
                      }),
                    "جزوه پنهان شد"
                  )
                }
                className="h-9 border-2 border-gold font-bold text-[#8a6a24]"
              >
                {busy === "hide" ? <Spinner /> : null} پنهان کردن جزوه
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    "delComment",
                    () => api(`/comments/${report.targetId}`, { method: "DELETE" }),
                    "پیام حذف شد"
                  )
                }
                className="h-9 border-2 border-danger font-bold text-danger"
              >
                {busy === "delComment" ? <Spinner /> : null} حذف پیام
              </Button>
            )}
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                void run(
                  "action",
                  () =>
                    api(`/admin/reports/${report.id}/resolve`, {
                      method: "POST",
                      json: { action: "action_taken" },
                    }),
                  "گزارش بررسی شد"
                )
              }
              className="h-9 border-2 border-ink font-black"
            >
              {busy === "action" ? <Spinner /> : null} اقدام شد
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                void run(
                  "dismiss",
                  () =>
                    api(`/admin/reports/${report.id}/resolve`, {
                      method: "POST",
                      json: { action: "dismiss" },
                    }),
                  "گزارش رد شد"
                )
              }
              className="h-9 border-2 border-ink font-bold"
            >
              {busy === "dismiss" ? <Spinner /> : null} رد گزارش
            </Button>
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
    </tr>
  );
}

function ReportStatusBadge({ status }: { status: ReportItem["status"] }) {
  const styles: Record<ReportItem["status"], string> = {
    PENDING: "border-gold bg-gold/15 text-[#8a6a24]",
    DISMISSED: "border-gray-300 bg-gray-100 text-gray-600",
    ACTION_TAKEN: "border-success bg-success/10 text-success",
  };
  const labels: Record<ReportItem["status"], string> = {
    PENDING: "در انتظار",
    DISMISSED: "رد شده",
    ACTION_TAKEN: "اقدام شد",
  };
  return <Badge className={cn("border-2 px-1.5 text-[11px] font-bold", styles[status])}>{labels[status]}</Badge>;
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    spam: "اسپم",
    copyright: "کپی‌برداری",
    inappropriate: "نامناسب",
    harassment: "آزار",
    other: "سایر",
  };
  return map[reason] ?? reason;
}

/* ---------------- users tab ---------------- */

function UsersTab() {
  const [page, setPage] = useState(1);
  const list = useFetch<AdminUsersResponse>(
    () => api<AdminUsersResponse>(`/admin/users?page=${page}&pageSize=20`),
    [page]
  );

  const data = list.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      {list.loading && !data ? (
        <PageSkeleton />
      ) : list.error ? (
        <ErrorBox message={list.error} onRetry={list.retry} />
      ) : data && data.items.length === 0 ? (
        <EmptyBox title="کاربری ثبت‌نام نکرده است" />
      ) : data ? (
        <>
          <div className="oeg-scroll overflow-x-auto border-2 border-ink bg-white">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b-2 border-ink bg-gray-50 text-xs text-gray-500">
                  <th className="p-3 text-start font-black">کاربر</th>
                  <th className="p-3 text-start font-black">ایمیل</th>
                  <th className="p-3 text-start font-black">نقش</th>
                  <th className="p-3 text-start font-black">وضعیت</th>
                  <th className="p-3 text-start font-black">کیف پول</th>
                  <th className="p-3 text-start font-black">جزوه‌ها</th>
                  <th className="p-3 text-start font-black">عضویت</th>
                  <th className="p-3 text-start font-black">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <UserRow key={u.id} user={u} onChanged={list.retry} />
                ))}
              </tbody>
            </table>
          </div>

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
              <span className="oeg-mono text-sm font-bold text-gray-500">
                صفحه {faNumber(page)} از {faNumber(totalPages)}
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
      ) : null}
    </div>
  );
}

function UserRow({ user, onChanged }: { user: AdminUserRow; onChanged: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function toggleSuspend() {
    setBusy(true);
    try {
      await api(`/admin/users/${user.id}/suspend`, {
        method: "PATCH",
        json: { suspended: user.suspendedAt === null },
      });
      toast({ title: user.suspendedAt === null ? "کاربر معلق شد" : "تعلیق رفع شد" });
      onChanged();
    } catch (err) {
      toast({
        title: "عملیات ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="p-3 font-bold">
        {user.fullName}
        {user.isAdmin && (
          <Badge className="ms-2 border-2 border-ink bg-ink px-1.5 text-xs font-bold text-white">
            مدیر
          </Badge>
        )}
      </td>
      <td className="oeg-mono p-3 text-xs text-gray-600" dir="ltr">{user.email}</td>
      <td className="p-3 text-gray-600">{user.role}</td>
      <td className="p-3">
        {user.suspendedAt ? (
          <Badge className="border-2 border-danger bg-danger/10 px-1.5 text-[11px] font-bold text-danger">
            معلق
          </Badge>
        ) : (
          <Badge className="border-2 border-success bg-success/10 px-1.5 text-[11px] font-bold text-success">
            فعال
          </Badge>
        )}
      </td>
      <td className="oeg-mono p-3">
        {user.walletBalance === null ? "—" : faToman(user.walletBalance)}
      </td>
      <td className="oeg-mono p-3">{faNumber(user.pamphletCount)}</td>
      <td className="p-3 text-xs text-gray-400">{faDate(user.createdAt)}</td>
      <td className="p-3">
        <div className="flex flex-wrap gap-2">
          <ResetButton user={user} />
          {!user.isAdmin && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void toggleSuspend()}
              className={cn(
                "h-9 border-2 font-bold",
                user.suspendedAt
                  ? "border-success text-success"
                  : "border-danger font-bold text-danger hover:bg-danger/10"
              )}
            >
              {busy ? <Spinner /> : null}
              {user.suspendedAt ? "رفع تعلیق" : "تعلیق"}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function ResetButton({ user }: { user: AdminUserRow }) {
  const { toast } = useToast();
  const [issued, setIssued] = useState<IssuedReset | null>(null);
  const [busy, setBusy] = useState(false);

  async function issue() {
    setBusy(true);
    try {
      const res = await api<IssuedReset>(`/admin/users/${user.id}/reset`, { method: "POST" });
      setIssued(res);
    } catch (err) {
      toast({
        title: "صدور کد ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={busy || user.isAdmin}
        onClick={() => void issue()}
        className="h-9 border-2 border-ink font-bold"
        aria-label={`بازنشانی رمز ${user.fullName}`}
      >
        {busy ? <Spinner /> : <KeyRound className="size-4" aria-hidden="true" />}
        بازنشانی رمز
      </Button>

      <Dialog open={!!issued} onOpenChange={(open) => !open && setIssued(null)}>
        <DialogContent className="border-2 border-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">کد بازنشانی رمز</DialogTitle>
            <DialogDescription>
              برای «{issued?.userFullName}» صادر شد. این کد را امن برایشان بفرستید —
              بعد از استفاده یا صدور کد جدید، باطل می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              dir="ltr"
              value={issued?.token ?? ""}
              aria-label="کد بازنشانی"
              className="oeg-mono border-2 bg-gray-50 text-center text-lg font-bold tracking-widest"
            />
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(issued?.token ?? "");
                toast({ title: "کد کپی شد" });
              }}
              className="h-11 shrink-0 border-2 border-ink font-bold"
            >
              <Copy className="size-4" aria-hidden="true" /> کپی
            </Button>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setIssued(null)}
              className="h-11 w-full border-2 border-ink font-black sm:w-auto"
            >
              بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
