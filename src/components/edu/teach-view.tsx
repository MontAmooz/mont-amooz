"use client";

// مُنت‌آموز — Phase 2 teacher panel (#/teach): tabs کلاس‌ها (sessions + earnings summary),
// برنامهٔ تدریس (slot create/delete), دوره‌ها (my courses + management + create wizard).

import {
  CalendarClock,
  CalendarDays,
  CheckCheck,
  Clock,
  DoorOpen,
  GraduationCap,
  Pencil,
  PlayCircle,
  Plus,
  PlusCircle,
  Settings2,
  Star,
  Trash2,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import {
  DIFFICULTIES,
  GRADES,
  SLOT_DURATIONS,
  SLOT_MAX_PRICE,
  SLOT_MIN_PRICE,
  SUBJECTS,
} from "@/lib/constants";
import {
  faDateTime,
  faDayLabel,
  faDuration,
  faNumber,
  faRating,
  faTime,
  faToman,
  toFaDigits,
} from "@/lib/format";
import type {
  CourseCard,
  CourseDetail,
  MySlotItem,
  SessionItem,
  UserProfileTeach,
  WalletResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AuthRequiredBox,
  CourseCover,
  EmptyBox,
  ErrorBox,
  InfoNote,
  PageSkeleton,
  SessionStatusBadge,
  Spinner,
} from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";

/* ---------------- helpers ---------------- */

const SAMPLE_VIDEOS = [
  { value: "/videos/lesson-calculus.mp4", label: "نمونه: حسابان" },
  { value: "/videos/lesson-statistics.mp4", label: "نمونه: آمار و احتمال" },
  { value: "/videos/lesson-science.mp4", label: "نمونه: علوم" },
  { value: "/videos/lesson-literature.mp4", label: "نمونه: ادبیات" },
  { value: "/videos/lesson-geometry.mp4", label: "نمونه: هندسه" },
] as const;

type MyCourse = CourseCard & { status: "DRAFT" | "PUBLISHED"; salesCount: number };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dayHeader(iso: string): string {
  const diffDays = Math.round(
    (new Date(localDateKey(iso)).getTime() - new Date(localDateKey(new Date().toISOString())).getTime()) /
      86_400_000
  );
  const label = faDayLabel(iso);
  if (diffDays === 0) return `امروز — ${label}`;
  if (diffDays === 1) return `فردا — ${label}`;
  return label;
}

/** next `count` days as select options (value = YYYY-MM-DD local). */
function nextDayOptions(count: number): Array<{ value: string; label: string }> {
  const now = new Date();
  const options: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const value = localDateKey(d.toISOString());
    options.push({ value, label: dayHeader(d.toISOString()) });
  }
  return options;
}

/** 08:00–22:00 half-hour steps (value = HH:MM, label = faTime). */
const TIME_OPTIONS: Array<{ value: string; label: string }> = (() => {
  const out: Array<{ value: string; label: string }> = [];
  for (let h = 8; h <= 22; h++) {
    for (const m of [0, 30]) {
      const value = `${pad2(h)}:${pad2(m)}`;
      out.push({ value, label: faTime(new Date(2024, 0, 1, h, m)) });
    }
  }
  return out;
})();

/* ================= tab 1: classes ================= */

function ClassesTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  const [confirm, setConfirm] = useState<{ action: "cancel" | "complete"; session: SessionItem } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sessions = useFetch<{ items: SessionItem[] }>(
    () => api<{ items: SessionItem[] }>(`/sessions?role=teacher&status=${when}&page=1&pageSize=50`),
    [when, userId]
  );
  const wallet = useFetch<WalletResponse>(() => api<WalletResponse>("/wallet"), [userId]);
  const profile = useFetch<{ teach?: UserProfileTeach }>(
    () => api<{ teach?: UserProfileTeach }>(`/users/${userId}`),
    [userId]
  );

  const earned = useMemo(
    () =>
      (wallet.data?.transactions ?? [])
        .filter(
          (txn) =>
            txn.status === "SUCCESS" &&
            (txn.type === "SESSION_EARNING" || txn.type === "COURSE_EARNING")
        )
        .reduce((sum, txn) => sum + txn.amount, 0),
    [wallet.data]
  );

  async function runAction() {
    if (!confirm) return;
    setBusyId(confirm.session.id);
    try {
      if (confirm.action === "complete") {
        await api(`/sessions/${confirm.session.id}/complete`, { method: "POST" });
        toast({
          title: "جلسه پایان یافت",
          description: `سهم شما (${faToman(confirm.session.teacherShare)}) به کیف پولتان واریز شد.`,
        });
      } else {
        await api(`/sessions/${confirm.session.id}/cancel`, { method: "POST" });
        toast({ title: "جلسه لغو شد", description: "کل مبلغ به دانش‌آموز بازگردانده شد." });
      }
      setConfirm(null);
      sessions.retry();
      wallet.retry();
    } catch (err) {
      toast({
        title: "انجام عملیات ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  const items = sessions.data?.items ?? [];

  return (
    <div className="space-y-6">
      {/* summary card */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="border-2 border-ink bg-ink p-5 text-white">
          <p className="flex items-center gap-2 text-xs font-bold text-white/60">
            <WalletIcon className="size-4 text-gold" aria-hidden="true" /> درآمد کل ثبت‌شده
          </p>
          <p className="oeg-mono mt-2 text-3xl font-black">
            {wallet.loading && !wallet.data ? "…" : wallet.error ? "—" : faNumber(earned)}
          </p>
          <p className="mt-1 text-xs text-white/50">تومان — از تدریس و فروش دوره</p>
          <button
            type="button"
            onClick={() => navigate("#/wallet")}
            className="mt-3 text-xs font-black text-gold underline underline-offset-4 hover:text-gold/80"
          >
            برداشت / شارژ کیف پول
          </button>
        </div>
        <div className="border-2 border-ink bg-white p-5">
          <p className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <GraduationCap className="size-4 text-primary" aria-hidden="true" /> جلسات برگزارشده
          </p>
          <p className="oeg-mono mt-2 text-3xl font-black">
            {profile.loading && !profile.data ? "…" : faNumber(profile.data?.teach?.completedSessions ?? 0)}
          </p>
          <p className="mt-1 text-xs text-gray-400">به‌عنوان معلم</p>
        </div>
        <div className="border-2 border-ink bg-white p-5">
          <p className="flex items-center gap-2 text-xs font-bold text-gray-500">
            <Star className="size-4 text-gold" aria-hidden="true" /> امتیاز کلاس‌های شما
          </p>
          <p className="oeg-mono mt-2 text-3xl font-black">
            {profile.loading && !profile.data
              ? "…"
              : faRating(profile.data?.teach?.avgSessionRating ?? 0)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            از {faNumber(profile.data?.teach?.sessionRatingCount ?? 0)} بازخورد دانش‌آموز
          </p>
        </div>
      </div>

      {/* upcoming / past */}
      <div className="flex border-2 border-ink bg-white" role="group" aria-label="فیلتر زمان جلسه‌ها">
        {(
          [
            { value: "upcoming", label: "پیش‌رو" },
            { value: "past", label: "گذشته" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={when === option.value}
            onClick={() => setWhen(option.value)}
            className={cn(
              "h-11 flex-1 text-sm font-black transition-colors md:h-10",
              when === option.value ? "bg-ink text-white" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {sessions.loading && !sessions.data ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : sessions.error ? (
        <ErrorBox message={sessions.error} onRetry={sessions.retry} />
      ) : items.length === 0 ? (
        <EmptyBox
          title={when === "upcoming" ? "جلسهٔ پیش‌رویی ندارید" : "هنوز جلسه‌ای برگزار نکرده‌اید"}
          description="زمان‌های آزادتان را در تب «برنامهٔ تدریس» ثبت کنید تا دانش‌آموزان بتوانند رزرو کنند."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((session) => (
            <li key={session.id} className="border-2 border-ink bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <SessionStatusBadge status={session.status} />
                <h3 className="min-w-0 flex-1 font-black">{session.topic || "جلسهٔ تدریس"}</h3>
                <span className="oeg-mono border-2 border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-bold tracking-widest">
                  {session.meetingCode}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                <span>
                  با{" "}
                  <a href={`#/user/${session.student.id}`} className="font-bold text-primary hover:underline">
                    {session.student.fullName}
                  </a>
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-gray-400" aria-hidden="true" />
                  {faDateTime(session.startAt)}
                </span>
                <span>{faDuration(session.durationMinutes)}</span>
                {session.status === "COMPLETED" ? (
                  <span className="oeg-mono font-black text-success">
                    درآمد: {faToman(session.teacherShare)}
                  </span>
                ) : (
                  <span className="oeg-mono font-black text-ink">{faToman(session.price)}</span>
                )}
              </div>
              {session.status === "BOOKED" && (
                <div className="mt-3 flex flex-wrap gap-2 border-t-2 border-gray-100 pt-3">
                  <Button
                    onClick={() => navigate(`#/session/${session.id}`)}
                    className="h-11 border-2 border-ink px-5 font-black md:h-10"
                  >
                    <DoorOpen className="size-4" aria-hidden="true" /> ورود به کلاس
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busyId === session.id}
                    onClick={() => setConfirm({ action: "complete", session })}
                    className="h-11 border-2 border-success font-black text-success hover:bg-success/10 md:h-10"
                  >
                    {busyId === session.id ? <Spinner /> : <CheckCheck className="size-4" aria-hidden="true" />}
                    پایان جلسه
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busyId === session.id}
                    onClick={() => setConfirm({ action: "cancel", session })}
                    className="h-11 border-2 border-danger font-bold text-danger hover:bg-danger/10 md:h-10"
                  >
                    <X className="size-4" aria-hidden="true" /> لغو جلسه
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && busyId === null) setConfirm(null);
        }}
      >
        <AlertDialogContent className="border-2 border-ink">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">
              {confirm?.action === "complete" ? "پایان جلسه را ثبت می‌کنید؟" : "لغو این جلسه؟"}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-7">
              {confirm?.action === "complete"
                ? `سهم شما (${faToman(confirm.session.teacherShare)}) به کیف پولتان واریز می‌شود و جلسه «برگزار شده» ثبت می‌گردد.`
                : "کل مبلغ پرداختی به کیف پول دانش‌آموز بازگردانده می‌شود."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10" disabled={busyId !== null}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void runAction();
              }}
              disabled={busyId !== null}
              className={cn(
                "h-11 border-2 border-ink font-black text-white md:h-10",
                confirm?.action === "complete" ? "bg-success hover:bg-success/90" : "bg-danger hover:bg-danger/90"
              )}
            >
              {busyId ? <Spinner /> : null}
              بله، {confirm?.action === "complete" ? "پایان جلسه" : "لغو کن"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ================= tab 2: schedule ================= */

function ScheduleTab() {
  const { toast } = useToast();
  const mine = useFetch<{ items: MySlotItem[] }>(() => api<{ items: MySlotItem[] }>("/slots/mine"), []);
  const [day, setDay] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [duration, setDuration] = useState<string>("60");
  const [price, setPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MySlotItem | null>(null);

  const dayOptions = useMemo(() => nextDayOptions(14), []);
  const priceNumber = Number(price.replace(/[,٬\s]/g, ""));

  async function createSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!day) {
      setFormError("روز را انتخاب کنید.");
      return;
    }
    if (!time) {
      setFormError("ساعت شروع را انتخاب کنید.");
      return;
    }
    if (!Number.isFinite(priceNumber) || priceNumber < SLOT_MIN_PRICE || priceNumber > SLOT_MAX_PRICE || priceNumber % 5_000 !== 0) {
      setFormError(`نرخ هر جلسه باید بین ${faToman(SLOT_MIN_PRICE)} تا ${faToman(SLOT_MAX_PRICE)} و مضرب ${faNumber(5_000)} باشد.`);
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const startAt = new Date(`${day}T${time}:00`).toISOString();
      await api("/slots", {
        method: "POST",
        json: {
          slots: [{ startAt, durationMinutes: Number(duration), price: priceNumber }],
        },
      });
      toast({ title: "اسلات افزوده شد", description: "دانش‌آموزان از این به بعد می‌توانند این زمان را رزرو کنند." });
      setPrice("");
      mine.retry();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "خطای نامشخص رخ داد.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSlot() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api(`/slots/${deleteTarget.id}`, { method: "DELETE" });
      toast({ title: "اسلات حذف شد" });
      setDeleteTarget(null);
      mine.retry();
    } catch (err) {
      toast({
        title: "حذف اسلات ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const groups: Array<{ key: string; header: string; items: MySlotItem[] }> = [];
    for (const slot of mine.data?.items ?? []) {
      const key = localDateKey(slot.startAt);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(slot);
      else groups.push({ key, header: dayHeader(slot.startAt), items: [slot] });
    }
    return groups;
  }, [mine.data]);

  return (
    <div className="space-y-6">
      {/* create form */}
      <form onSubmit={createSlot} className="border-2 border-ink bg-white p-4 md:p-6" aria-label="ثبت زمان آزاد جدید">
        <h2 className="font-black">ثبت زمان آزاد جدید</h2>
        <p className="mt-1 text-xs text-gray-500">
          زمان‌ها دست‌کم ۱ ساعت بعد از اکنون باید باشند؛ زمان‌های هم‌پوشان قبول نمی‌شوند.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-gray-500">روز</Label>
            <Select value={day} onValueChange={(v) => { setDay(v); setFormError(null); }}>
              <SelectTrigger className="h-11 border-2 border-gray-200 bg-white font-medium hover:border-ink md:h-10" aria-label="روز">
                <SelectValue placeholder="انتخاب روز" />
              </SelectTrigger>
              <SelectContent>
                {dayOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-gray-500">ساعت شروع</Label>
            <Select value={time} onValueChange={(v) => { setTime(v); setFormError(null); }}>
              <SelectTrigger className="h-11 border-2 border-gray-200 bg-white font-medium hover:border-ink md:h-10" aria-label="ساعت شروع">
                <SelectValue placeholder="—:—" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {TIME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-gray-500">مدت جلسه</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="h-11 border-2 border-gray-200 bg-white font-medium hover:border-ink md:h-10" aria-label="مدت جلسه">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLOT_DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{faDuration(d)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slot-price" className="text-xs font-black text-gray-500">نرخ (تومان)</Label>
            <Input
              id="slot-price"
              inputMode="numeric"
              value={price}
              onChange={(e) => { setPrice(e.target.value); setFormError(null); }}
              placeholder={faNumber(90_000)}
              className="oeg-mono h-11 border-2 bg-white md:h-10"
              aria-invalid={!!formError}
            />
            {price.trim() !== "" && Number.isFinite(priceNumber) && (
              <p className="text-xs text-gray-400">پیش‌نمایش: {faToman(priceNumber)}</p>
            )}
          </div>
        </div>
        {formError && (
          <p className="mt-3 text-sm font-bold text-danger" role="alert">{formError}</p>
        )}
        <Button type="submit" disabled={busy} className="mt-4 h-11 border-2 border-ink font-black md:h-10">
          {busy ? <Spinner /> : <Plus className="size-4" aria-hidden="true" />} افزودن اسلات
        </Button>
      </form>

      {/* my slots */}
      <section aria-label="برنامهٔ تدریس من">
        <h2 className="text-xl font-black">برنامهٔ من</h2>
        <div className="mt-4 space-y-6">
          {mine.loading && !mine.data ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : mine.error ? (
            <ErrorBox message={mine.error} onRetry={mine.retry} />
          ) : grouped.length === 0 ? (
            <EmptyBox
              title="هنوز زمانی ثبت نکرده‌اید"
              description="با ثبت زمان آزاد، نام شما در بازارچهٔ تدریس به دانش‌آموزان نمایش داده می‌شود."
            />
          ) : (
            grouped.map((group) => (
              <div key={group.key}>
                <h3 className="border-s-4 border-gold ps-3 text-sm font-black text-gray-600">
                  {group.header}
                </h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.items.map((slot) => {
                    const booked = slot.status === "BOOKED";
                    return (
                      <li
                        key={slot.id}
                        className={cn(
                          "flex items-center justify-between gap-3 border-2 p-3",
                          booked ? "border-gold bg-gold/10" : "border-ink bg-white"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="oeg-mono text-base font-black">
                            {faTime(slot.startAt)}
                            <span className="ms-2 text-xs font-bold text-gray-400">
                              {faDuration(slot.durationMinutes)}
                            </span>
                          </p>
                          {booked && slot.session ? (
                            <p className="mt-1 truncate text-xs">
                              رزرو توسط{" "}
                              <a
                                href={`#/session/${slot.session.id}`}
                                className="font-bold text-primary hover:underline"
                              >
                                {slot.session.student.fullName}
                              </a>
                              {slot.session.topic ? ` — ${slot.session.topic}` : ""}
                            </p>
                          ) : (
                            <p className="oeg-mono mt-1 text-xs font-bold text-gray-500">
                              {faToman(slot.price)} · آزاد
                            </p>
                          )}
                        </div>
                        {!booked && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(slot)}
                            aria-label={`حذف اسلات ${faDateTime(slot.startAt)}`}
                            className="size-9 shrink-0 border-2 border-gray-200 p-0 text-gray-400 hover:border-danger hover:text-danger"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="border-2 border-ink">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">این زمان آزاد حذف شود؟</AlertDialogTitle>
            <AlertDialogDescription className="leading-7">
              {deleteTarget ? faDateTime(deleteTarget.startAt) : ""} — دانش‌آموزان دیگر نمی‌توانند
              این زمان را رزرو کنند. زمان‌های رزروشده قابل حذف نیستند.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10" disabled={busy}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void removeSlot();
              }}
              disabled={busy}
              className="h-11 border-2 border-ink bg-danger font-black text-white hover:bg-danger/90 md:h-10"
            >
              {busy ? <Spinner /> : <Trash2 className="size-4" aria-hidden="true" />}
              بله، حذف کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ================= tab 3: courses ================= */

interface LessonDraft {
  title: string;
  videoUrl: string;
  customUrl: string;
  durationMinutes: string;
  isFreePreview: boolean;
}

const EMPTY_LESSON: LessonDraft = {
  title: "",
  videoUrl: SAMPLE_VIDEOS[0].value,
  customUrl: "",
  durationMinutes: "10",
  isFreePreview: false,
};

function CreateCourseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("");
  const [price, setPrice] = useState("0");
  const [lessons, setLessons] = useState<LessonDraft[]>([{ ...EMPTY_LESSON, isFreePreview: true }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const priceNumber = Number(price.replace(/[,٬\s]/g, "")) || 0;

  function reset() {
    setStep(0);
    setTitle("");
    setDescription("");
    setGrade("");
    setSubject("");
    setLevel("");
    setPrice("0");
    setLessons([{ ...EMPTY_LESSON, isFreePreview: true }]);
    setError(null);
  }

  function close() {
    if (busy) return;
    reset();
    onOpenChange(false);
  }

  function next() {
    if (title.trim().length < 3) {
      setError("عنوان دوره باید بین ۳ تا ۱۲۰ نویسه باشد.");
      return;
    }
    if (!grade) {
      setError("پایهٔ تحصیلی را انتخاب کنید.");
      return;
    }
    if (!subject) {
      setError("درس را انتخاب کنید.");
      return;
    }
    if (!Number.isFinite(priceNumber) || priceNumber < 0 || priceNumber > 5_000_000 || priceNumber % 10_000 !== 0) {
      setError("قیمت باید حداکثر ۵٬۰۰۰٬۰۰۰ تومان و مضرب ۱۰٬۰۰۰ باشد (رایگان = ۰).");
      return;
    }
    setError(null);
    setStep(1);
  }

  async function create() {
    const payloadLessons = lessons.map((lesson, i) => ({
      title: lesson.title.trim() || `درس ${toFaDigits(i + 1)}`,
      videoUrl: lesson.videoUrl === "custom" ? lesson.customUrl.trim() : lesson.videoUrl,
      durationMinutes: Number(lesson.durationMinutes) || undefined,
      isFreePreview: lesson.isFreePreview,
    }));
    if (lessons.some((lesson) => lesson.videoUrl === "custom" && !lesson.customUrl.trim())) {
      setError("نشانی ویدیوی سفارشی را برای همهٔ درس‌ها وارد کنید.");
      return;
    }
    if (payloadLessons.length < 1) {
      setError("هر دوره باید دست‌کم یک درس داشته باشد.");
      return;
    }
    setBusy(true);
    try {
      const { id } = await api<{ id: string }>("/courses", {
        method: "POST",
        json: {
          title: title.trim(),
          description: description.trim() || undefined,
          grade,
          subject,
          level: level || undefined,
          price: priceNumber,
          lessons: payloadLessons,
        },
      });
      toast({ title: "دوره ساخته شد!", description: "می‌توانید درس‌های بیشتری اضافه یا آن را منتشر کنید." });
      reset();
      onOpenChange(false);
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص رخ داد.");
    } finally {
      setBusy(false);
    }
  }

  const selectTrigger = "h-11 w-full border-2 border-gray-200 bg-white font-medium hover:border-ink md:h-10";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-2 border-ink sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">ساخت دورهٔ جدید</DialogTitle>
          <DialogDescription>
            {step === 0 ? "گام ۱ از ۲ — مشخصات دوره" : "گام ۲ از ۲ — درس‌های دوره"}
          </DialogDescription>
        </DialogHeader>

        {/* stepper */}
        <ol className="flex items-center" aria-label="مراحل ساخت دوره">
          {["مشخصات", "درس‌ها"].map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center border-2 text-xs font-black",
                  i < step
                    ? "border-primary bg-primary text-white"
                    : i === step
                      ? "border-ink bg-white"
                      : "border-gray-200 bg-white text-gray-300"
                )}
              >
                {toFaDigits(i + 1)}
              </span>
              <span className={cn("text-xs font-black", i === step ? "text-ink" : "text-gray-400")}>
                {label}
              </span>
              {i === 0 && <span className={cn("h-0.5 flex-1 border-t-2", step > 0 ? "border-primary" : "border-gray-200")} aria-hidden="true" />}
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-black">عنوان دوره <span className="text-danger">*</span></Label>
              <Input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(null); }}
                placeholder="مثلاً: حسابان یک — از صفر تا صد"
                className="h-11 border-2 bg-white md:h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-black">توضیح (اختیاری)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="این دوره برای چه کسی مناسب است و چه چیزهایی پوشش می‌دهد…"
                className="min-h-20 border-2 bg-white leading-7"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-gray-500">پایه <span className="text-danger">*</span></Label>
                <Select value={grade} onValueChange={(v) => { setGrade(v); setError(null); }}>
                  <SelectTrigger className={selectTrigger} aria-label="پایهٔ تحصیلی">
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-gray-500">درس <span className="text-danger">*</span></Label>
                <Select value={subject} onValueChange={(v) => { setSubject(v); setError(null); }}>
                  <SelectTrigger className={selectTrigger} aria-label="درس">
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-gray-500">سطح (اختیاری)</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger className={selectTrigger} aria-label="سطح دوره">
                    <SelectValue placeholder="بدون سطح" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون سطح</SelectItem>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-price" className="text-sm font-black">
                قیمت (تومان — ۰ = رایگان)
              </Label>
              <Input
                id="course-price"
                inputMode="numeric"
                value={price}
                onChange={(e) => { setPrice(e.target.value); setError(null); }}
                className="oeg-mono h-11 border-2 bg-white md:h-10"
                aria-invalid={!!error}
              />
              <p className="text-xs text-gray-400">
                پیش‌نمایش: {priceNumber === 0 ? "رایگان" : faToman(priceNumber)} — باید مضرب{" "}
                {faNumber(10_000)} باشد.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson, i) => (
              <fieldset key={i} className="border-2 border-gray-200 p-3">
                <legend className="px-1 text-xs font-black text-gray-500">
                  درس {toFaDigits(i + 1)}
                  {i === 0 && <span className="ms-1 text-gold">(پیش‌نمایش رایگان)</span>}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-500">عنوان درس</Label>
                    <Input
                      value={lesson.title}
                      onChange={(e) =>
                        setLessons((prev) =>
                          prev.map((l, j) => (j === i ? { ...l, title: e.target.value } : l))
                        )
                      }
                      placeholder="مثلاً: معرفی مفهوم مشتق"
                      className="h-10 border-2 bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-500">ویدیو</Label>
                    <Select
                      value={lesson.videoUrl}
                      onValueChange={(v) =>
                        setLessons((prev) => prev.map((l, j) => (j === i ? { ...l, videoUrl: v } : l)))
                      }
                    >
                      <SelectTrigger className="h-10 border-2 border-gray-200 bg-white text-sm" aria-label={`ویدیوی درس ${toFaDigits(i + 1)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SAMPLE_VIDEOS.map((sample) => (
                          <SelectItem key={sample.value} value={sample.value}>{sample.label}</SelectItem>
                        ))}
                        <SelectItem value="custom">نشانی سفارشی…</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {lesson.videoUrl === "custom" && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-gray-500">نشانی ویدیوی سفارشی</Label>
                      <Input
                        dir="ltr"
                        value={lesson.customUrl}
                        onChange={(e) =>
                          setLessons((prev) =>
                            prev.map((l, j) => (j === i ? { ...l, customUrl: e.target.value } : l))
                          )
                        }
                        placeholder="https://… یا /videos/…"
                        className="h-10 border-2 bg-white text-sm"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-500">مدت (دقیقه)</Label>
                    <Input
                      inputMode="numeric"
                      value={lesson.durationMinutes}
                      onChange={(e) =>
                        setLessons((prev) =>
                          prev.map((l, j) => (j === i ? { ...l, durationMinutes: e.target.value } : l))
                        )
                      }
                      className="oeg-mono h-10 border-2 bg-white"
                    />
                  </div>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold">
                    <Checkbox
                      checked={lesson.isFreePreview}
                      onCheckedChange={(checked) =>
                        setLessons((prev) =>
                          prev.map((l, j) => (j === i ? { ...l, isFreePreview: checked === true } : l))
                        )
                      }
                      aria-label={`درس ${toFaDigits(i + 1)} پیش‌نمایش رایگان باشد`}
                    />
                    پیش‌نمایش رایگان
                  </label>
                </div>
                {lessons.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLessons((prev) => prev.filter((_, j) => j !== i))}
                    className="mt-2 h-9 border-2 border-danger text-xs font-bold text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" /> حذف این درس
                  </Button>
                )}
              </fieldset>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => setLessons((prev) => [...prev, { ...EMPTY_LESSON }])}
              className="h-11 w-full border-2 border-dashed border-ink font-bold hover:bg-gray-50 md:h-10"
            >
              <PlusCircle className="size-4" aria-hidden="true" /> افزودن درس دیگر
            </Button>
          </div>
        )}

        {error && (
          <p className="text-sm font-bold text-danger" role="alert">{error}</p>
        )}

        <div className="flex items-center justify-between gap-3">
          {step === 0 ? (
            <Button variant="outline" onClick={close} className="h-11 border-2 border-ink font-bold md:h-10" disabled={busy}>
              انصراف
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setStep(0)} className="h-11 border-2 border-ink font-bold hover:bg-gray-50 md:h-10" disabled={busy}>
              مرحلهٔ قبل
            </Button>
          )}
          {step === 0 ? (
            <Button onClick={next} className="h-11 border-2 border-ink px-6 font-black md:h-10">
              مرحلهٔ بعد
            </Button>
          ) : (
            <Button onClick={() => void create()} disabled={busy} className="h-11 border-2 border-ink px-6 font-black md:h-10">
              {busy ? <Spinner /> : <PlayCircle className="size-4" aria-hidden="true" />}
              ساخت دوره ({toFaDigits(lessons.length)} درس)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CourseManageDialog({
  courseId,
  onClose,
  onChanged,
}: {
  courseId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  // the dialog fetches the FULL course detail (lessons, status, salesCount) itself
  const detail = useFetch<CourseDetail>(
    () => api<CourseDetail>(`/courses/${courseId ?? ""}`),
    [courseId],
    { enabled: courseId !== null }
  );

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // 'save' | 'status' | 'lesson-add' | lesson id
  const [newTitle, setNewTitle] = useState("");
  const [newVideo, setNewVideo] = useState<string>(SAMPLE_VIDEOS[0].value);
  const [newCustomUrl, setNewCustomUrl] = useState("");
  const [newDuration, setNewDuration] = useState("10");
  const [newFreePreview, setNewFreePreview] = useState(false);
  const [deleteLesson, setDeleteLesson] = useState<string | null>(null);
  const [adopted, setAdopted] = useState<string | null>(null);

  const course = detail.data;

  // adopt the course fields whenever a (new) course arrives (render-time adjust)
  if (course && course.id !== adopted) {
    setAdopted(course.id);
    setTitle(course.title);
    setPrice(String(course.price));
    setError(null);
  }

  async function save() {
    const current = detail.data;
    if (!current) return;
    const priceNumber = Number(price.replace(/[,٬\s]/g, ""));
    if (title.trim().length < 3) {
      setError("عنوان دوره باید بین ۳ تا ۱۲۰ نویسه باشد.");
      return;
    }
    if (!Number.isFinite(priceNumber) || priceNumber < 0 || priceNumber > 5_000_000 || priceNumber % 10_000 !== 0) {
      setError("قیمت باید حداکثر ۵٬۰۰۰٬۰۰۰ تومان و مضرب ۱۰٬۰۰۰ باشد (رایگان = ۰).");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      await api(`/courses/${current.id}`, {
        method: "PATCH",
        json: { title: title.trim(), price: priceNumber },
      });
      toast({ title: "تغییرات ذخیره شد" });
      onChanged();
      detail.retry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص رخ داد.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus() {
    const current = detail.data;
    if (!current) return;
    setBusy("status");
    try {
      await api(`/courses/${current.id}`, {
        method: "PATCH",
        json: { status: current.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" },
      });
      toast({
        title: current.status === "PUBLISHED" ? "دوره به پیش‌نویس برگشت" : "دوره منتشر شد",
        description:
          current.status === "PUBLISHED"
            ? "تا انتشار مجدد در فروشگاه دیده نمی‌شود."
            : "دوره در فروشگاه برای همه قابل مشاهده است.",
      });
      onChanged();
      detail.retry();
    } catch (err) {
      toast({
        title: "تغییر وضعیت ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  async function addLesson() {
    const current = detail.data;
    if (!current) return;
    setBusy("lesson-add");
    setError(null);
    try {
      await api(`/courses/${current.id}/lessons`, {
        method: "POST",
        json: {
          title: newTitle.trim() || "درس تازه",
          videoUrl: newVideo === "custom" ? newCustomUrl.trim() : newVideo,
          durationMinutes: Number(newDuration) || undefined,
          isFreePreview: newFreePreview,
        },
      });
      toast({ title: "درس افزوده شد" });
      setNewTitle("");
      setNewCustomUrl("");
      setNewFreePreview(false);
      onChanged();
      detail.retry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص رخ داد.");
    } finally {
      setBusy(null);
    }
  }

  async function removeLesson(lessonId: string) {
    const current = detail.data;
    if (!current) return;
    setBusy(lessonId);
    try {
      await api(`/courses/${current.id}/lessons/${lessonId}`, { method: "DELETE" });
      toast({ title: "درس حذف شد" });
      setDeleteLesson(null);
      onChanged();
      detail.retry();
    } catch (err) {
      toast({
        title: "حذف درس ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={courseId !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && busy === null) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto border-2 border-ink sm:max-w-xl">
        {detail.loading && !course ? (
          <div className="space-y-3 p-2" aria-busy="true">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : detail.error || !course ? (
          <div className="p-2">
            <ErrorBox message={detail.error ?? "دوره پیدا نشد."} onRetry={detail.retry} compact />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-xl font-black">
                مدیریت دوره
                <Badge
                  className={cn(
                    "border-2 px-2 font-bold",
                    course.status === "PUBLISHED"
                      ? "border-success bg-success/10 text-success"
                      : "border-gray-300 bg-gray-100 text-gray-600"
                  )}
                >
                  {course.status === "PUBLISHED" ? "منتشرشده" : "پیش‌نویس"}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {faNumber(course.salesCount ?? 0)} فروش · {faNumber(course.lessons.length)} درس
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {/* edit fields */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-black">عنوان</Label>
                  <Input
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setError(null); }}
                    className="h-11 border-2 bg-white md:h-10"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor="mgmt-price" className="text-sm font-black">قیمت (تومان — ۰ = رایگان)</Label>
                    <Input
                      id="mgmt-price"
                      inputMode="numeric"
                      value={price}
                      onChange={(e) => { setPrice(e.target.value); setError(null); }}
                      className="oeg-mono h-11 border-2 bg-white md:h-10"
                    />
                  </div>
                  <Button
                    onClick={() => void save()}
                    disabled={busy !== null}
                    className="h-11 shrink-0 border-2 border-ink font-black md:h-10"
                  >
                    {busy === "save" ? <Spinner /> : null} ذخیره
                  </Button>
                </div>
              </div>

              {/* status toggle */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    className={cn(
                      "h-11 w-full border-2 font-black md:h-10",
                      course.status === "PUBLISHED"
                        ? "border-gray-300 text-gray-600 hover:bg-gray-50"
                        : "border-success text-success hover:bg-success/10"
                    )}
                  >
                    {busy === "status" ? <Spinner /> : null}
                    {course.status === "PUBLISHED" ? "تبدیل به پیش‌نویس" : "انتشار دوره"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-2 border-ink">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-black">
                      {course.status === "PUBLISHED" ? "دوره از فروشگاه برداشته شود؟" : "دوره منتشر شود؟"}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="leading-7">
                      {course.status === "PUBLISHED"
                        ? "دانشجویان فعلی دسترسی خود را نگه می‌دارند؛ اما خرید جدید ممکن نیست."
                        : "دوره برای همهٔ کاربران در فروشگاه نمایش داده می‌شود."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10">انصراف</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        void toggleStatus();
                      }}
                      className="h-11 border-2 border-ink font-black md:h-10"
                    >
                      بله، ادامه بده
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* lessons */}
              <div>
                <h3 className="font-black">درس‌ها</h3>
                <ul className="mt-2 border-2 border-gray-200">
                  {course.lessons.map((lesson) => (
                    <li key={lesson.id} className="flex items-center gap-2 border-b-2 border-gray-100 p-2.5 last:border-b-0">
                      <span className="oeg-mono flex size-7 shrink-0 items-center justify-center border-2 border-ink text-xs font-black">
                        {toFaDigits(lesson.order)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{lesson.title}</span>
                      {lesson.isFreePreview && (
                        <Badge className="border-2 border-gold bg-gold/15 px-1.5 text-[10px] font-black text-[#8a6a24]">
                          پیش‌نمایش
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteLesson(lesson.id)}
                        aria-label={`حذف درس ${lesson.title}`}
                        className="size-8 shrink-0 border-2 border-gray-200 p-0 text-gray-400 hover:border-danger hover:text-danger"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>

                {/* add lesson */}
                <div className="mt-3 border-2 border-dashed border-gray-300 p-3">
                  <p className="text-xs font-black text-gray-500">افزودن درس جدید</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="عنوان درس"
                      className="h-10 border-2 bg-white text-sm"
                      aria-label="عنوان درس جدید"
                    />
                    <Select value={newVideo} onValueChange={setNewVideo}>
                      <SelectTrigger className="h-10 border-2 border-gray-200 bg-white text-sm" aria-label="ویدیوی درس جدید">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SAMPLE_VIDEOS.map((sample) => (
                          <SelectItem key={sample.value} value={sample.value}>{sample.label}</SelectItem>
                        ))}
                        <SelectItem value="custom">نشانی سفارشی…</SelectItem>
                      </SelectContent>
                    </Select>
                    {newVideo === "custom" && (
                      <Input
                        dir="ltr"
                        value={newCustomUrl}
                        onChange={(e) => setNewCustomUrl(e.target.value)}
                        placeholder="https://… یا /videos/…"
                        className="h-10 border-2 bg-white text-sm sm:col-span-2"
                        aria-label="نشانی ویدیوی سفارشی"
                      />
                    )}
                    <Input
                      inputMode="numeric"
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                      placeholder="مدت (دقیقه)"
                      className="oeg-mono h-10 border-2 bg-white text-sm"
                      aria-label="مدت درس جدید به دقیقه"
                    />
                    <label className="flex items-center gap-2 text-sm font-bold">
                      <Checkbox
                        checked={newFreePreview}
                        onCheckedChange={(checked) => setNewFreePreview(checked === true)}
                        aria-label="درس جدید پیش‌نمایش رایگان باشد"
                      />
                      پیش‌نمایش رایگان
                    </label>
                  </div>
                  <Button
                    onClick={() => void addLesson()}
                    disabled={busy !== null}
                    className="mt-2 h-10 border-2 border-ink px-4 text-sm font-black"
                  >
                    {busy === "lesson-add" ? <Spinner /> : <Plus className="size-4" aria-hidden="true" />}
                    افزودن درس
                  </Button>
                </div>
              </div>

              {error && (
                <p className="text-sm font-bold text-danger" role="alert">{error}</p>
              )}
            </div>

            {/* delete-lesson confirm */}
            <AlertDialog
              open={deleteLesson !== null}
              onOpenChange={(open) => {
                if (!open && busy === null) setDeleteLesson(null);
              }}
            >
              <AlertDialogContent className="border-2 border-ink">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-black">این درس حذف شود؟</AlertDialogTitle>
                  <AlertDialogDescription className="leading-7">
                    ترتیب درس‌های بعدی به‌روز می‌شود؛ آخرین درس دوره قابل حذف نیست.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10" disabled={busy !== null}>
                    انصراف
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      if (deleteLesson) void removeLesson(deleteLesson);
                    }}
                    disabled={busy !== null}
                    className="h-11 border-2 border-ink bg-danger font-black text-white hover:bg-danger/90 md:h-10"
                  >
                    {busy ? <Spinner /> : <Trash2 className="size-4" aria-hidden="true" />}
                    بله، حذف کن
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CoursesTab() {
  const mine = useFetch<{ items: MyCourse[] }>(() => api<{ items: MyCourse[] }>("/courses/mine"), []);
  const [manageId, setManageId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const items = mine.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black">دوره‌های من</h2>
        <Button
          onClick={() => setCreateOpen(true)}
          className="oeg-hard-shadow h-11 border-2 border-ink px-5 font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none md:h-10"
        >
          <PlusCircle className="size-4" aria-hidden="true" /> ساخت دورهٔ جدید
        </Button>
      </div>

      {mine.loading && !mine.data ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : mine.error ? (
        <ErrorBox message={mine.error} onRetry={mine.retry} />
      ) : items.length === 0 ? (
        <EmptyBox
          title="هنوز دوره‌ای نساخته‌اید"
          description="اولین دورهٔ ویدیویی خود را بسازید؛ درس‌به‌درس ویدیو اضافه کنید و بفروشید."
          action={
            <Button
              className="h-11 border-2 border-ink font-black md:h-10"
              onClick={() => setCreateOpen(true)}
            >
              <PlusCircle className="size-4" aria-hidden="true" /> ساخت دورهٔ جدید
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((course) => (
            <li
              key={course.id}
              className="flex flex-col border-2 border-ink bg-white transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#111827] sm:flex-row"
            >
              <CourseCover
                src={course.coverUrl}
                title={course.title}
                className="h-36 w-full shrink-0 border-b-2 border-ink sm:h-auto sm:w-40 sm:border-b-0 sm:border-s-2"
              />
              <div className="flex min-w-0 flex-1 flex-col p-4">
                <div className="flex items-start gap-2">
                  <h3 className="line-clamp-2 min-w-0 flex-1 font-black leading-6">{course.title}</h3>
                  <Badge
                    className={cn(
                      "shrink-0 border-2 px-2 font-bold",
                      course.status === "PUBLISHED"
                        ? "border-success bg-success/10 text-success"
                        : "border-gray-300 bg-gray-100 text-gray-600"
                    )}
                  >
                    {course.status === "PUBLISHED" ? "منتشرشده" : "پیش‌نویس"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span className="oeg-mono font-black text-ink">
                    {course.price === 0 ? "رایگان" : faToman(course.price)}
                  </span>
                  <span>{faNumber(course.salesCount)} فروش</span>
                  <span className="flex items-center gap-1">
                    <Star className="size-3.5 text-gold" aria-hidden="true" />
                    <b className="oeg-mono">{faRating(course.ratingAvg)}</b>
                    <span className="oeg-mono">({faNumber(course.ratingCount)})</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <PlayCircle className="size-3.5" aria-hidden="true" />
                    {faNumber(course.lessonCount)} درس
                  </span>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <Button
                    onClick={() => setManageId(course.id)}
                    className="h-10 border-2 border-ink px-4 text-sm font-black"
                  >
                    <Settings2 className="size-4" aria-hidden="true" /> مدیریت
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate(`#/course/${course.id}`)}
                    className="h-10 border-2 border-ink px-4 text-sm font-bold hover:bg-gray-50"
                  >
                    <Pencil className="size-4" aria-hidden="true" /> مشاهده
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateCourseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          mine.retry();
          navigate(`#/course/${id}`);
        }}
      />
      <CourseManageDialog
        courseId={manageId}
        onClose={() => setManageId(null)}
        onChanged={() => mine.retry()}
      />
    </div>
  );
}

/* ================= main view ================= */

export default function TeachView() {
  const { user, sessionLoaded } = useEduStore();
  const [tab, setTab] = useState("classes");

  if (!sessionLoaded) {
    return <PageSkeleton />;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <AuthRequiredBox
          title="برای استفاده از پنل تدریس وارد حساب کاربری شوید"
          hint="مدیریت زمان‌های تدریس، کلاس‌ها و دوره‌های ویدیویی شما اینجا انجام می‌شود."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">پنل تدریس</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-500">
            زمان‌های آزادتان را ثبت کنید، کلاس‌ها را برگزار کنید و دوره‌های ویدیویی بسازید و بفروشید.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`#/user/${user.id}`)}
            className="h-11 border-2 border-ink font-bold hover:bg-gray-50 md:h-10"
          >
            <GraduationCap className="size-4" aria-hidden="true" /> پروفایل عمومی من
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList className="h-11 w-full grid-cols-3 sm:w-fit">
          <TabsTrigger value="classes" className="gap-1.5 px-4 font-bold">
            <CalendarClock className="size-4" aria-hidden="true" /> کلاس‌ها
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5 px-4 font-bold">
            <Clock className="size-4" aria-hidden="true" /> برنامهٔ تدریس
          </TabsTrigger>
          <TabsTrigger value="courses" className="gap-1.5 px-4 font-bold">
            <PlayCircle className="size-4" aria-hidden="true" /> دوره‌ها
          </TabsTrigger>
        </TabsList>
        <TabsContent value="classes" className="mt-6">
          <ClassesTab userId={user.id} />
        </TabsContent>
        <TabsContent value="schedule" className="mt-6">
          <ScheduleTab />
        </TabsContent>
        <TabsContent value="courses" className="mt-6">
          <CoursesTab />
        </TabsContent>
      </Tabs>

      <div className="mt-8">
        <InfoNote>
          سهم شما از هر جلسه و فروش دوره ۸۰٪ است؛ ۲۰٪ حق پلتفرم بوده و پس از برگزاری جلسه یا
          خرید دوره به‌صورت خودکار به کیف پولتان واریز می‌شود.
        </InfoNote>
      </div>
    </div>
  );
}
