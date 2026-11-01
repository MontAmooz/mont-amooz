"use client";

// مُنت‌آموز — Phase 2 booking page (#/book/{id}): teacher header + open slots grouped
// by day; booking an available slot charges the wallet (with confirm dialog + commission note).

import { ArrowRight, CalendarClock, Clock, GraduationCap, Star, Wallet as WalletIcon } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { PLATFORM_COMMISSION_PERCENT } from "@/lib/constants";
import { faDateTime, faDayLabel, faDuration, faNumber, faRating, faTime, faToman } from "@/lib/format";
import type {
  CourseCard,
  SlotItem,
  UserProfile,
  UserProfileTeach,
  WalletResponse,
} from "@/lib/types";
import { AuthRequiredBox, EmptyBox, ErrorBox, InitialsAvatar, InfoNote, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";

/** GET /users/[id] extended with Phase-2 teach + courses blocks. */
interface TeacherProfile extends UserProfile {
  teach?: UserProfileTeach;
  courses?: CourseCard[];
}

function localDay(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** «امروز — شنبه ۱۲ دی» / «فردا — …» / «شنبه ۱۲ دی» */
function dayHeader(iso: string): string {
  const diffDays = Math.round((localDay(iso) - localDay(new Date().toISOString())) / 86_400_000);
  const label = faDayLabel(iso);
  if (diffDays === 0) return `امروز — ${label}`;
  if (diffDays === 1) return `فردا — ${label}`;
  return label;
}

export default function BookView({ id }: { id: string }) {
  const { toast } = useToast();
  const { user, sessionLoaded } = useEduStore();

  const profile = useFetch<TeacherProfile>(
    () => api<TeacherProfile>(`/users/${id}`),
    [id]
  );
  const slots = useFetch<{ items: SlotItem[] }>(
    () => api<{ items: SlotItem[] }>(`/teachers/${id}/slots`),
    [id]
  );
  const wallet = useFetch<WalletResponse>(() => api<WalletResponse>("/wallet"), [user?.id], {
    enabled: !!user,
  });

  const [pendingSlot, setPendingSlot] = useState<SlotItem | null>(null);
  const [booking, setBooking] = useState(false);

  const grouped = useMemo(() => {
    const groups: Array<{ key: string; header: string; items: SlotItem[] }> = [];
    for (const slot of slots.data?.items ?? []) {
      const key = new Date(slot.startAt).toISOString().slice(0, 10);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.items.push(slot);
      } else {
        groups.push({ key, header: dayHeader(slot.startAt), items: [slot] });
      }
    }
    return groups;
  }, [slots.data]);

  if (profile.loading && !profile.data) {
    return <PageSkeleton />;
  }
  if (profile.error || !profile.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorBox message={profile.error ?? "کاربر پیدا نشد."} onRetry={profile.retry} />
      </div>
    );
  }

  const teacher = profile.data.user;
  const teach = profile.data.teach;
  const isMe = user?.id === teacher.id;
  const balance = wallet.data?.balance ?? 0;
  const insufficient = !!pendingSlot && !!user && balance < pendingSlot.price;

  async function book() {
    if (!pendingSlot) return;
    setBooking(true);
    try {
      await api<{ id: string }>("/sessions", {
        method: "POST",
        json: { slotId: pendingSlot.id },
      });
      toast({
        title: "جلسه رزرو شد!",
        description: "کد جلسه در کلاس‌های من قابل مشاهده است؛ می‌توانید وارد کلاس شوید.",
      });
      setPendingSlot(null);
      navigate("#/sessions");
    } catch (err) {
      toast({
        title: "رزرو جلسه ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      slots.retry(); // slot may have been taken in the meantime
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <a
        href="#/market"
        className="inline-flex h-9 items-center gap-1 text-sm font-bold text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowRight className="size-4" aria-hidden="true" /> بازارچهٔ تدریس
      </a>

      {/* ---------- teacher header ---------- */}
      <div className="mt-4 border-2 border-ink bg-white p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <InitialsAvatar name={teacher.fullName} className="size-20 shrink-0 border-2 border-ink text-2xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black">{teacher.fullName}</h1>
            {teacher.title && <p className="mt-1 text-sm font-bold text-gray-500">{teacher.title}</p>}
            {teacher.bio && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">{teacher.bio}</p>
            )}
            {teacher.expertise && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {teacher.expertise
                  .split(/[,،]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((tag) => (
                    <span
                      key={tag}
                      className="border-2 border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-bold text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            )}
            {teach && (
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t-2 border-gray-100 pt-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="size-4 text-gray-400" aria-hidden="true" />
                  {faNumber(teach.completedSessions)} جلسه برگزارشده
                </span>
                <span className="flex items-center gap-1.5">
                  <Star className="size-4 text-gold" aria-hidden="true" />
                  امتیاز کلاس‌ها: <b className="oeg-mono">{faRating(teach.avgSessionRating)}</b>
                </span>
                {teach.openSlots > 0 && (
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="size-4 text-gray-400" aria-hidden="true" />
                    {faNumber(teach.openSlots)} زمان آزاد
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isMe && (
        <div className="mt-4">
          <InfoNote>
            این پروفایل خودتان است؛ زمان‌های آزادتان را می‌توانید از پنل تدریس مدیریت کنید.
          </InfoNote>
        </div>
      )}

      {!sessionLoaded ? (
        <div className="mt-8" aria-busy="true">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-4 h-40 w-full" />
        </div>
      ) : !user ? (
        <div className="mt-8">
          <AuthRequiredBox
            title="برای رزرو کلاس وارد حساب کاربری شوید"
            hint="پرداخت جلسه از کیف پول شما انجام می‌شود؛ برای همین اول باید وارد شوید."
          />
        </div>
      ) : (
        <>
          {/* ---------- slots ---------- */}
          <section className="mt-8" aria-label="زمان‌های آزاد معلم">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <CalendarClock className="size-5 text-primary" aria-hidden="true" /> زمان‌های آزاد
            </h2>

            <div className="mt-4 space-y-6">
              {slots.loading ? (
                <div className="space-y-3" aria-busy="true">
                  <Skeleton className="h-6 w-44" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : slots.error ? (
                <ErrorBox message={slots.error} onRetry={slots.retry} />
              ) : grouped.length === 0 ? (
                <EmptyBox
                  title="زمان آزادی ثبت نشده است"
                  description="این معلم فعلاً زمان آزادی برای رزرو ثبت نکرده است؛ بعداً دوباره بررسی کنید."
                  action={
                    <Button
                      variant="outline"
                      className="h-11 border-2 border-ink font-bold"
                      onClick={() => navigate("#/market")}
                    >
                      معلم‌های دیگر
                    </Button>
                  }
                />
              ) : (
                grouped.map((group) => (
                  <div key={group.key}>
                    <h3 className="border-s-4 border-gold ps-3 text-sm font-black text-gray-600">
                      {group.header}
                    </h3>
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                      {group.items.map((slot) => (
                        <li
                          key={slot.id}
                          className="flex items-center justify-between gap-3 border-2 border-ink bg-white p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_#111827]"
                        >
                          <div className="min-w-0">
                            <p className="oeg-mono text-lg font-black">{faTime(slot.startAt)}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="size-3.5" aria-hidden="true" />
                                {faDuration(slot.durationMinutes)}
                              </span>
                              <span className="oeg-mono font-black text-ink">{faToman(slot.price)}</span>
                            </p>
                          </div>
                          <Button
                            onClick={() => setPendingSlot(slot)}
                            className="h-11 shrink-0 border-2 border-ink px-4 font-black md:h-10"
                          >
                            رزرو
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </section>

          {wallet.data && (
            <p className="mt-6 flex items-center gap-1.5 text-xs text-gray-400">
              <WalletIcon className="size-4" aria-hidden="true" />
              موجودی کیف پول شما برای پرداخت:{" "}
              <b className="oeg-mono text-gray-600">{faToman(balance)}</b>
            </p>
          )}
        </>
      )}

      {/* ---------- confirm booking ---------- */}
      <AlertDialog
        open={pendingSlot !== null}
        onOpenChange={(open) => {
          if (!open && !booking) setPendingSlot(null);
        }}
      >
        <AlertDialogContent className="border-2 border-ink">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">رزرو این جلسه؟</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 leading-7">
                <p>
                  زمان: <b>{pendingSlot ? faDateTime(pendingSlot.startAt) : ""}</b> · مدت:{" "}
                  <b>{pendingSlot ? faDuration(pendingSlot.durationMinutes) : ""}</b>
                </p>
                <p>
                  مبلغ: <b className="oeg-mono">{pendingSlot ? faToman(pendingSlot.price) : ""}</b> از
                  کیف پول شما کسر می‌شود (موجودی فعلی:{" "}
                  <b className="oeg-mono">{faToman(balance)}</b>).
                </p>
                <p className="text-xs text-gray-500">
                  {faNumber(100 - PLATFORM_COMMISSION_PERCENT)}٪ مبلغ به معلم می‌رسد؛{" "}
                  {faNumber(PLATFORM_COMMISSION_PERCENT)}٪ حق پلتفرم است و پس از برگزاری جلسه سهم
                  معلم واریز می‌شود.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {insufficient && (
            <p className="border-2 border-danger bg-danger/10 p-3 text-sm font-bold text-danger" role="alert">
              موجودی کیف پول کافی نیست.{" "}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => {
                  setPendingSlot(null);
                  navigate("#/wallet");
                }}
              >
                شارژ کیف پول
              </button>
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 border-2 border-ink font-bold md:h-10" disabled={booking}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // keep the dialog open until the request settles
                void book();
              }}
              disabled={booking || insufficient}
              className="h-11 border-2 border-ink font-black md:h-10"
            >
              {booking && <Spinner />}
              بله، رزرو کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
