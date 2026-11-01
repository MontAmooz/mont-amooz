"use client";

// مُنت‌آموز — merge request detail: meta, line diff, approve/reject (with confirm dialogs).

import { ArrowRight, GitMerge, X } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faDate, faNumber, faRelative } from "@/lib/format";
import type { MRDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorBox, InfoNote, MRStatusBadge, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";

function DiffLines({
  lines,
  kind,
}: {
  lines: string[];
  kind: "added" | "removed";
}) {
  return (
    <div>
      <p
        className={cn(
          "border-b-2 px-4 py-2 text-sm font-black",
          kind === "removed"
            ? "border-danger/20 bg-danger/10 text-danger"
            : "border-success/20 bg-success/10 text-success"
        )}
      >
        {kind === "removed"
          ? `− ${faNumber(lines.length)} خط حذف‌شده`
          : `+ ${faNumber(lines.length)} خط افزوده‌شده`}
      </p>
      <ul className={cn("divide-y", kind === "removed" ? "divide-red-100" : "divide-green-100")}>
        {lines.map((line, i) => (
          <li
            key={i}
            className={cn(
              kind === "removed" ? "oeg-diff-del" : "oeg-diff-add",
              "px-4 py-1.5 text-sm leading-7"
            )}
          >
            <span className="whitespace-pre-wrap break-words" dir="auto">
              {line || "\u00A0"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RequestDetailView({ id }: { id: string }) {
  const { toast } = useToast();
  const { user } = useEduStore();
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);

  // user?.id in deps → refetch after login/logout so canReview updates live
  const mr = useFetch<MRDetail>(
    () => api<MRDetail>(`/merge-requests/${id}`),
    [id, user?.id]
  );

  if (mr.loading && !mr.data) {
    return <PageSkeleton />;
  }

  if (mr.error || !mr.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorBox message={mr.error ?? "درخواست ادغام پیدا نشد."} onRetry={mr.retry} />
      </div>
    );
  }

  const data = mr.data;
  const isCreator = user?.id === data.createdBy.id;
  const canReview = data.canReview && data.status === "OPEN";
  const noChanges = data.diff.addedCount === 0 && data.diff.removedCount === 0;

  async function review(action: "approve" | "reject") {
    setActing(action);
    try {
      await api(`/merge-requests/${id}/review`, { method: "POST", json: { action } });
      toast(
        action === "approve"
          ? {
              title: "ادغام انجام شد",
              description: "نسخهٔ جدیدی از جزوهٔ اصلی ساخته شد و سهم مشارکت‌کننده ثبت گردید.",
            }
          : { title: "درخواست رد شد", description: "تغییرات پیشنهادی به جزوهٔ اصلی اضافه نشد." }
      );
      mr.retry();
    } catch (err) {
      toast({
        title: "انجام عملیات ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <a
        href="#/requests"
        className="inline-flex h-9 items-center gap-1 text-sm font-bold text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowRight className="size-4" aria-hidden="true" /> همهٔ درخواست‌های ادغام
      </a>

      {/* header */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <MRStatusBadge status={data.status} />
        <h1 className="text-2xl font-black leading-snug md:text-3xl">{data.title}</h1>
      </div>

      {data.description && (
        <p className="mt-4 whitespace-pre-wrap border-s-4 border-gold bg-gold/5 p-4 text-sm leading-7 text-gray-700">
          {data.description}
        </p>
      )}

      {/* meta */}
      <dl className="mt-6 grid gap-x-8 gap-y-3 border-2 border-ink bg-white p-4 text-sm sm:grid-cols-2 md:p-5">
        <div className="flex items-center gap-2">
          <dt className="shrink-0 font-black text-gray-500">از جزوه:</dt>
          <dd className="min-w-0">
            <a
              href={`#/pamphlet/${data.source.id}`}
              className="truncate font-bold text-primary hover:underline"
            >
              {data.source.title}
            </a>
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="shrink-0 font-black text-gray-500">به جزوه:</dt>
          <dd className="min-w-0">
            <a
              href={`#/pamphlet/${data.target.id}`}
              className="truncate font-bold text-primary hover:underline"
            >
              {data.target.title}
            </a>
          </dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="font-black text-gray-500">ایجادکننده:</dt>
          <dd className="font-bold">
            <a href={`#/user/${data.createdBy.id}`} className="text-primary hover:underline">
              {data.createdBy.fullName}
            </a>
            <span className="ms-2 font-normal text-gray-400">{faRelative(data.createdAt)}</span>
          </dd>
        </div>
        {data.reviewedBy && (
          <div className="flex flex-wrap items-center gap-2">
            <dt className="font-black text-gray-500">بررسی‌کننده:</dt>
            <dd className="font-bold">
              <a href={`#/user/${data.reviewedBy.id}`} className="text-primary hover:underline">
                {data.reviewedBy.fullName}
              </a>
              {data.reviewedAt && (
                <span className="ms-2 font-normal text-gray-400">{faDate(data.reviewedAt)}</span>
              )}
            </dd>
          </div>
        )}
      </dl>

      {/* diff stats */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-black">
        <span className="oeg-mono text-success">+{faNumber(data.diff.addedCount)} خط</span>
        <span className="oeg-mono text-danger">−{faNumber(data.diff.removedCount)} خط</span>
      </div>

      {/* diff */}
      <div className="mt-4 border-2 border-ink bg-white">
        <h2 className="border-b-2 border-ink px-4 py-3 font-black">تغییرات پیشنهادی</h2>
        {noChanges ? (
          <div className="p-4">
            <InfoNote>در خطوط محتوا تغییری ثبت نشده است (شاید فقط محتوای جابه‌جاشده یا خالی).</InfoNote>
          </div>
        ) : (
          <div className="oeg-scroll max-h-[28rem] overflow-y-auto">
            {data.diff.removed.length > 0 && <DiffLines lines={data.diff.removed} kind="removed" />}
            {data.diff.added.length > 0 && <DiffLines lines={data.diff.added} kind="added" />}
          </div>
        )}
      </div>

      {/* creator hint / review actions */}
      {isCreator && data.status === "OPEN" && !canReview && (
        <div className="mt-6">
          <InfoNote>درخواست شما در انتظار بررسی نویسندهٔ جزوهٔ اصلی است…</InfoNote>
        </div>
      )}

      {canReview && (
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t-2 border-gray-200 pt-6">
          <p className="w-full text-sm font-bold text-gray-500 sm:w-auto sm:flex-1">
            شما نویسندهٔ جزوهٔ اصلی هستید — تصمیم با شماست:
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={acting !== null}
                className="h-12 border-2 border-ink bg-success px-6 text-base font-black text-white hover:bg-success/90"
              >
                {acting === "approve" ? <Spinner /> : <GitMerge className="size-5" aria-hidden="true" />}
                تأیید و ادغام
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-2 border-ink">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-black">تأیید و ادغام تغییرات؟</AlertDialogTitle>
                <AlertDialogDescription className="leading-7">
                  با ادغام، نسخهٔ جدیدی از جزوهٔ اصلی ساخته می‌شود و سهم مشارکت‌کننده ثبت خواهد شد.
                  این عمل قابل بازگشت نیست.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10">
                  انصراف
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void review("approve")}
                  className="h-11 border-2 border-ink bg-success font-black text-white hover:bg-success/90 md:h-10"
                >
                  بله، تأیید و ادغام کن
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={acting !== null}
                className="h-12 border-2 border-danger px-6 text-base font-black text-danger hover:bg-danger/10 md:h-11"
              >
                {acting === "reject" ? <Spinner /> : <X className="size-5" aria-hidden="true" />}
                رد کردن
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-2 border-ink">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-black">درخواست را رد می‌کنید؟</AlertDialogTitle>
                <AlertDialogDescription className="leading-7">
                  تغییرات پیشنهادی به جزوهٔ اصلی اضافه نخواهد شد؛ مشارکت‌کننده می‌تواند درخواست
                  جدیدی با اصلاحات ارائه دهد.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10">
                  انصراف
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void review("reject")}
                  className="h-11 border-2 border-ink bg-danger font-black text-white hover:bg-danger/90 md:h-10"
                >
                  بله، رد کن
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* loading overlay for actions */}
      {acting && (
        <div className="mt-4 flex items-center gap-2 text-sm font-bold text-gray-500" aria-live="polite">
          <Spinner /> در حال ثبت نتیجهٔ بررسی…
        </div>
      )}
    </div>
  );
}
