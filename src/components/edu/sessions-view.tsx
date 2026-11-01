"use client";

// مُنت‌آموز — Phase 2 my-sessions view (#/sessions): role tabs + upcoming/past filter,
// session cards with meeting code, cancel (refund rules), complete (teacher) and review.

import { CalendarDays, CheckCheck, Copy, DoorOpen, X } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { SESSION_CANCEL_FULL_REFUND_HOURS } from "@/lib/constants";
import { faDateTime, faDuration, faToman, toFaDigits } from "@/lib/format";
import type { SessionItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyBox, ErrorBox, SessionStatusBadge, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { RatingStars } from "./rating-stars";
import { useEduStore } from "./store";

type RoleFilter = "all" | "student" | "teacher";
type WhenFilter = "all" | "upcoming" | "past";

function SessionCard({
  session,
  onAction, // (action, session) — parent runs the mutation
  busyId,
}: {
  session: SessionItem;
  onAction: (action: "cancel" | "complete" | "review", session: SessionItem) => void;
  busyId: string | null;
}) {
  const { toast } = useToast();
  const isTeacher = session.myRole === "teacher";
  const counterpart = isTeacher ? session.student : session.teacher;
  const hoursLeft = (new Date(session.startAt).getTime() - Date.now()) / 3_600_000;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(session.meetingCode);
      toast({ title: "کد جلسه کپی شد", description: session.meetingCode });
    } catch {
      toast({
        title: "کپی ممکن نشد",
        description: `کد جلسه: ${session.meetingCode}`,
        variant: "destructive",
      });
    }
  }

  return (
    <article className="border-2 border-ink bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <SessionStatusBadge status={session.status} />
        <h2 className="min-w-0 flex-1 font-black leading-6">
          {session.topic || "جلسهٔ تدریس"}
        </h2>
        <button
          type="button"
          onClick={() => void copyCode()}
          className="oeg-mono inline-flex h-8 items-center gap-1.5 border-2 border-gray-200 bg-gray-50 px-2 text-sm font-bold tracking-widest transition-colors hover:border-ink"
          aria-label={`کپی کد جلسه ${session.meetingCode}`}
          title="کپی کد جلسه"
        >
          {session.meetingCode}
          <Copy className="size-3.5 text-gray-400" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600">
        <span>
          {isTeacher ? "دانش‌آموز:" : "معلم:"}{" "}
          <a href={`#/user/${counterpart.id}`} className="font-bold text-primary hover:underline">
            {counterpart.fullName}
          </a>
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-4 text-gray-400" aria-hidden="true" />
          {faDateTime(session.startAt)}
        </span>
        <span>{faDuration(session.durationMinutes)}</span>
        <span className="oeg-mono font-black text-ink">{faToman(session.price)}</span>
      </div>

      {(session.canJoin ||
        (session.myRole === "student" && session.status === "COMPLETED" && !session.hasReview)) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t-2 border-gray-100 pt-4">
          {session.canJoin && (
            <Button
              onClick={() => navigate(`#/session/${session.id}`)}
              className="oeg-hard-shadow h-11 border-2 border-ink px-5 font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none md:h-10"
            >
              <DoorOpen className="size-4" aria-hidden="true" /> ورود به کلاس
            </Button>
          )}
          {session.status === "BOOKED" && (
            <>
              {isTeacher && (
                <Button
                  variant="outline"
                  disabled={busyId === session.id}
                  onClick={() => onAction("complete", session)}
                  className="h-11 border-2 border-success font-black text-success hover:bg-success/10 md:h-10"
                >
                  {busyId === session.id ? <Spinner /> : <CheckCheck className="size-4" aria-hidden="true" />}
                  پایان جلسه
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busyId === session.id}
                onClick={() => onAction("cancel", session)}
                className="h-11 border-2 border-danger font-bold text-danger hover:bg-danger/10 md:h-10"
              >
                <X className="size-4" aria-hidden="true" /> لغو جلسه
              </Button>
            </>
          )}
          {session.myRole === "student" && session.status === "COMPLETED" && !session.hasReview && (
            <Button
              variant="outline"
              onClick={() => onAction("review", session)}
              className="h-11 border-2 border-gold font-black text-[#8a6a24] hover:bg-gold/10 md:h-10"
            >
              ثبت بازخورد
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

export default function SessionsView() {
  const { toast } = useToast();
  const { user } = useEduStore();

  const [role, setRole] = useState<RoleFilter>("all");
  const [when, setWhen] = useState<WhenFilter>("all");
  const [confirm, setConfirm] = useState<{ action: "cancel" | "complete"; session: SessionItem } | null>(null);
  const [reviewFor, setReviewFor] = useState<SessionItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useFetch<{ items: SessionItem[]; total: number }>(
    () =>
      api<{ items: SessionItem[]; total: number }>(
        `/sessions?role=${role}&status=${when}&page=1&pageSize=50`
      ),
    [role, when, user?.id]
  );

  const items = list.data?.items ?? [];
  const upcomingEmpty = when === "upcoming";

  async function runCancel() {
    if (!confirm) return;
    setBusyId(confirm.session.id);
    try {
      await api(`/sessions/${confirm.session.id}/cancel`, { method: "POST" });
      toast({
        title: "جلسه لغو شد",
        description:
          confirm.session.myRole === "teacher"
            ? "کل مبلغ پرداختی به کیف پول دانش‌آموز بازگردانده شد."
            : undefined,
      });
      setConfirm(null);
      list.retry();
    } catch (err) {
      toast({
        title: "لغو جلسه ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function runComplete() {
    if (!confirm) return;
    setBusyId(confirm.session.id);
    try {
      await api(`/sessions/${confirm.session.id}/complete`, { method: "POST" });
      toast({
        title: "جلسه پایان یافت",
        description: `سهم شما (${faToman(confirm.session.teacherShare)}) به کیف پولتان واریز شد.`,
      });
      setConfirm(null);
      list.retry();
    } catch (err) {
      toast({
        title: "پایان جلسه ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  const hoursLeft = confirm
    ? (new Date(confirm.session.startAt).getTime() - Date.now()) / 3_600_000
    : 0;
  const fullRefund = hoursLeft >= SESSION_CANCEL_FULL_REFUND_HOURS;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-black">کلاس‌های من</h1>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-500">
        جلساتی که رزرو کرده‌اید و جلساتی که تدریس می‌کنید، همه این‌جاست؛ با کد جلسه می‌توانید
        وارد اتاق درس شوید.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Tabs value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
          <TabsList className="h-11 grid-cols-3 sm:w-fit">
            <TabsTrigger value="all" className="px-4 font-bold">همه</TabsTrigger>
            <TabsTrigger value="student" className="px-4 font-bold">به‌عنوان دانش‌آموز</TabsTrigger>
            <TabsTrigger value="teacher" className="px-4 font-bold">به‌عنوان معلم</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* upcoming / past segmented control */}
        <div className="flex border-2 border-ink bg-white" role="group" aria-label="فیلتر زمان جلسه‌ها">
          {(
            [
              { value: "all", label: "همه" },
              { value: "upcoming", label: "پیش‌رو" },
              { value: "past", label: "گذشته" },
            ] as Array<{ value: WhenFilter; label: string }>
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={when === option.value}
              onClick={() => setWhen(option.value)}
              className={cn(
                "h-11 px-4 text-sm font-bold transition-colors md:h-10",
                when === option.value ? "bg-ink text-white" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {list.loading && !list.data ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : list.error ? (
          <ErrorBox message={list.error} onRetry={list.retry} />
        ) : items.length === 0 ? (
          <EmptyBox
            title={
              upcomingEmpty
                ? "جلسهٔ پیش‌رویی ندارید"
                : role === "teacher"
                  ? "جلسه‌ای برای تدریس شما ثبت نشده است"
                  : role === "student"
                    ? "هنوز کلاسی رزرو نکرده‌اید"
                    : "هنوز جلسه‌ای ندارید"
            }
            description={
              upcomingEmpty
                ? "از بازارچهٔ تدریس، زمان آزاد معلم‌ها را رزرو کنید یا زمان آزاد خودتان را ثبت کنید."
                : "وقتی کلاسی رزرو یا برگزار کنید، اینجا نمایش داده می‌شود."
            }
            action={
              <Button
                className="h-11 border-2 border-ink font-black md:h-10"
                onClick={() => navigate("#/market")}
              >
                رفتن به بازارچهٔ تدریس
              </Button>
            }
          />
        ) : (
          <ul className="space-y-4">
            {items.map((session) => (
              <li key={session.id}>
                <SessionCard
                  session={session}
                  busyId={busyId}
                  onAction={(action, target) => {
                    if (action === "review") setReviewFor(target);
                    else setConfirm({ action, session: target });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------- cancel / complete confirm ---------- */}
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && busyId === null) setConfirm(null);
        }}
      >
        <AlertDialogContent className="border-2 border-ink">
          {confirm?.action === "cancel" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-black">لغو این جلسه؟</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 leading-7">
                    <p>
                      «{confirm.session.topic || "جلسهٔ تدریس"}» — {faDateTime(confirm.session.startAt)}
                    </p>
                    {confirm.session.myRole === "teacher" ? (
                      <p>با لغو از سمت شما، کل مبلغ پرداختی به کیف پول دانش‌آموز بازگردانده می‌شود.</p>
                    ) : fullRefund ? (
                      <p>
                        بیش از {toFaDigits(SESSION_CANCEL_FULL_REFUND_HOURS)} ساعت تا شروع جلسه مانده؛
                        کل {faToman(confirm.session.price)} به کیف پول شما بازگردانده می‌شود.
                      </p>
                    ) : (
                      <p>
                        کمتر از {toFaDigits(SESSION_CANCEL_FULL_REFUND_HOURS)} ساعت تا شروع جلسه مانده؛
                        ۵۰٪ مبلغ به‌عنوان غرامت دیرهنگام به معلم می‌رسد و ۵۰٪ به شما بازمی‌گردد.
                      </p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10" disabled={busyId !== null}>
                  انصراف
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void runCancel();
                  }}
                  disabled={busyId !== null}
                  className="h-11 border-2 border-ink bg-danger font-black text-white hover:bg-danger/90 md:h-10"
                >
                  {busyId ? <Spinner /> : <X className="size-4" aria-hidden="true" />}
                  بله، لغو کن
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : confirm?.action === "complete" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-black">پایان جلسه را ثبت می‌کنید؟</AlertDialogTitle>
                <AlertDialogDescription className="leading-7">
                  با پایان جلسه، سهم شما ({faToman(confirm.session.teacherShare)}) به کیف پولتان
                  واریز می‌شود و جلسه در وضعیت «برگزار شده» ثبت می‌گردد. این عمل قابل بازگشت نیست.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10" disabled={busyId !== null}>
                  انصراف
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    void runComplete();
                  }}
                  disabled={busyId !== null}
                  className="h-11 border-2 border-ink bg-success font-black text-white hover:bg-success/90 md:h-10"
                >
                  {busyId ? <Spinner /> : <CheckCheck className="size-4" aria-hidden="true" />}
                  بله، پایان جلسه
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------- session review dialog ---------- */}
      {reviewFor && (
        <ReviewDialog
          session={reviewFor}
          onClose={() => setReviewFor(null)}
          onDone={() => {
            setReviewFor(null);
            list.retry();
          }}
        />
      )}
    </div>
  );
}

function ReviewDialog({
  session,
  onClose,
  onDone,
}: {
  session: SessionItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast({
        title: "امتیاز یادتان رفته",
        description: "با ستاره‌ها به کیفیت این جلسه امتیاز بدهید (۱ تا ۵).",
        variant: "destructive",
      });
      return;
    }
    if (comment.trim().length < 2) {
      toast({
        title: "متن بازخورد خیلی کوتاه است",
        description: "چند کلمه دربارهٔ کیفیت تدریس بنویسید.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      await api(`/sessions/${session.id}/review`, {
        method: "POST",
        json: { rating, comment: comment.trim() },
      });
      toast({ title: "بازخورد جلسه ثبت شد؛ ممنون!" });
      onDone();
    } catch (err) {
      toast({
        title: "ثبت بازخورد ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !busy && !open && onClose()}>
      <DialogContent className="border-2 border-ink sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">بازخورد جلسه با {session.teacher.fullName}</DialogTitle>
          <DialogDescription>
            {faDateTime(session.startAt)} — کیفیت تدریس را برای دانش‌آموز‌های بعدی ثبت کنید.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="flex flex-wrap items-center gap-3">
            <RatingStars value={rating} onChange={setRating} size="lg" />
            <span className="oeg-mono text-sm font-bold text-gray-500">
              {rating > 0 ? `${toFaDigits(rating)} از ۵` : "بدون امتیاز"}
            </span>
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="مثلاً: توضیح‌ها روان بود و تمرین‌های خوبی حل کردیم…"
            className="min-h-24 border-2 bg-white leading-7"
            aria-label="متن بازخورد جلسه"
          />
          <DialogFooter>
            <Button type="submit" disabled={busy} className="h-11 w-full border-2 border-ink font-black md:h-10 sm:w-auto">
              {busy && <Spinner />} ثبت بازخورد
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
