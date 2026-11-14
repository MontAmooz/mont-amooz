"use client";

// مُنت‌آموز — admin panel (#/admin): founder-only user management (P10).
// User table + per-row reset-token generation. No email infra — the founder
// hands the token to the user over WhatsApp/Telegram.

import { Copy, KeyRound, ShieldCheck } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faDate, faNumber, faToman } from "@/lib/format";
import type { AdminUserRow } from "@/lib/types";
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

export function AdminView() {
  const { user, sessionLoaded } = useEduStore();
  const [page, setPage] = useState(1);

  const list = useFetch<AdminUsersResponse>(
    () => api<AdminUsersResponse>(`/admin/users?page=${page}&pageSize=20`),
    [page]
  );

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

  const data = list.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-black md:text-3xl">پنل مدیریت</h1>
        {data && (
          <Badge variant="outline" className="border-2 border-ink px-2 font-bold">
            {faNumber(data.total)} کاربر
          </Badge>
        )}
      </div>
      <p className="mt-2 text-sm leading-7 text-gray-500">
        مدیریت کاربران و صدور کد بازنشانی رمز. کد را از طریق واتساپ/تلگرام برای کاربر بفرستید —
        هر کد ۲۴ ساعت اعتبار دارد و فقط یک‌بار قابل استفاده است.
      </p>

      {list.loading && !data ? (
        <div className="mt-8 space-y-3" aria-busy="true">
          <PageSkeleton />
        </div>
      ) : list.error ? (
        <div className="mt-8">
          <ErrorBox message={list.error} onRetry={list.retry} />
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="mt-8">
          <EmptyBox title="کاربری ثبت‌نام نکرده است" />
        </div>
      ) : data ? (
        <>
          <div className="oeg-scroll mt-8 overflow-x-auto border-2 border-ink bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b-2 border-ink bg-gray-50 text-xs text-gray-500">
                  <th className="p-3 text-start font-black">کاربر</th>
                  <th className="p-3 text-start font-black">ایمیل</th>
                  <th className="p-3 text-start font-black">نقش</th>
                  <th className="p-3 text-start font-black">کیف پول</th>
                  <th className="p-3 text-start font-black">جزوه‌ها</th>
                  <th className="p-3 text-start font-black">عضویت</th>
                  <th className="p-3 text-start font-black">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="p-3 font-bold">
                      {u.fullName}
                      {u.isAdmin && (
                        <Badge className="ms-2 border-2 border-ink bg-ink px-1.5 text-xs font-bold text-white">
                          مدیر
                        </Badge>
                      )}
                    </td>
                    <td className="oeg-mono p-3 text-xs text-gray-600" dir="ltr">{u.email}</td>
                    <td className="p-3 text-gray-600">{u.role}</td>
                    <td className="oeg-mono p-3">
                      {u.walletBalance === null ? "—" : faToman(u.walletBalance)}
                    </td>
                    <td className="oeg-mono p-3">{faNumber(u.pamphletCount)}</td>
                    <td className="p-3 text-xs text-gray-400">{faDate(u.createdAt)}</td>
                    <td className="p-3">
                      <ResetButton user={u} />
                    </td>
                  </tr>
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
