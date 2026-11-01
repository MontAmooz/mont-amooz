"use client";

// مُنت‌آموز — public profile view (#/user/{id}) + own-profile variant with edit dialog (#/profile).

import { Award, CalendarClock, Code, FileText, GitMerge, GraduationCap, Pencil, PlayCircle, Star } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faDate, faNumber, faRating, faToman } from "@/lib/format";
import type { CourseCard, PublicUser, UserProfile, UserProfileTeach } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CourseCover, EmptyBox, ErrorBox, InitialsAvatar, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { PamphletCard } from "./pamphlet-card";
import { useEduStore } from "./store";

/** GET /users/[id] extended with Phase-2 teach + courses blocks. */
interface ProfileWithMarket extends UserProfile {
  teach?: UserProfileTeach;
  courses?: CourseCard[];
}

function EditProfileDialog({
  open,
  onOpenChange,
  user,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: PublicUser;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState(user.fullName);
  const [title, setTitle] = useState(user.title ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [expertise, setExpertise] = useState(user.expertise ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("نام و نام‌خانوادگی را وارد کنید.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { user: updated } = await api<{ user: PublicUser }>("/users/me", {
        method: "PATCH",
        json: {
          fullName: fullName.trim(),
          title: title.trim() || undefined,
          bio: bio.trim() || undefined,
          expertise: expertise.trim() || undefined,
        },
      });
      useEduStore.getState().setUser(updated);
      toast({ title: "پروفایل به‌روزرسانی شد" });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص رخ داد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-2 border-ink sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">ویرایش پروفایل</DialogTitle>
          <DialogDescription>
            این اطلاعات کنار جزوه‌های شما دیده می‌شود؛ سابقه و تخصص‌تان را کامل بنویسید.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="pf-name" className="text-sm font-black">نام و نام‌خانوادگی</Label>
            <Input
              id="pf-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 border-2 bg-white md:h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-title" className="text-sm font-black">عنوان شغلی (اختیاری)</Label>
            <Input
              id="pf-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: دبیر ریاضی دورهٔ متوسطه"
              className="h-11 border-2 bg-white md:h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-bio" className="text-sm font-black">دربارهٔ من (اختیاری)</Label>
            <Textarea
              id="pf-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="چند خط دربارهٔ سابقهٔ تدریس و علاقه‌مندی‌های آموزشی شما"
              className="min-h-24 border-2 bg-white leading-7"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-expertise" className="text-sm font-black">تخصص‌ها (اختیاری)</Label>
            <Input
              id="pf-expertise"
              value={expertise}
              onChange={(e) => setExpertise(e.target.value)}
              placeholder="مثلاً: ریاضی، هندسه، آمادگی کنکور"
              className="h-11 border-2 bg-white md:h-10"
            />
            <p className="text-xs text-gray-400">مهارت‌ها را با ویرگول (،) از هم جدا کنید.</p>
          </div>
          {error && (
            <p className="text-xs font-bold text-danger" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy} className="h-11 w-full border-2 border-ink font-black md:h-10 sm:w-auto">
              {busy && <Spinner />} ذخیرهٔ تغییرات
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProfileView({ id, isMe }: { id: string; isMe?: boolean }) {
  const profile = useFetch<ProfileWithMarket>(() => api<ProfileWithMarket>(`/users/${id}`), [id]);
  const [editOpen, setEditOpen] = useState(false);

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

  const { user, pamphlets, stats, teach, courses } = profile.data;
  const firstName = user.fullName.split(/\s+/)[0];
  const hasTeach =
    !!teach && (teach.openSlots > 0 || teach.completedSessions > 0 || teach.courseCount > 0);

  const statCells = [
    { icon: FileText, label: "جزوه", value: faNumber(stats.pamphletCount) },
    { icon: GitMerge, label: "ادغام موفق", value: faNumber(stats.mergedCount) },
    { icon: Star, label: "میانگین امتیاز", value: faRating(stats.avgRating) },
    { icon: Code, label: "سطر مشارکت", value: faNumber(stats.linesContributed) },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* header card */}
      <div className="flex flex-col gap-6 border-2 border-ink bg-white p-6 md:flex-row md:items-start md:p-8">
        <InitialsAvatar
          name={user.fullName}
          className="size-24 shrink-0 border-2 border-ink text-3xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black md:text-3xl">{user.fullName}</h1>
            <Badge variant="outline" className="border-2 border-gold px-2 font-bold text-[#8a6a24]">
              {user.role}
            </Badge>
            {isMe && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="h-9 border-2 border-ink font-bold hover:bg-gray-50"
              >
                <Pencil className="size-4" aria-hidden="true" /> ویرایش پروفایل
              </Button>
            )}
          </div>

          {user.title && <p className="mt-1 text-sm font-bold text-gray-500">{user.title}</p>}
          {user.bio && (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-7 text-gray-700">
              {user.bio}
            </p>
          )}

          {user.expertise && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {user.expertise
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

          <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
            <Award className="size-4" aria-hidden="true" />
            عضو از: <span className="font-bold text-gray-500">{faDate(user.createdAt)}</span>
          </p>
        </div>
      </div>

      {/* stats */}
      <div className="mt-6 grid grid-cols-2 border-2 border-ink bg-white md:grid-cols-4">
        {statCells.map((cell, i) => (
          <div
            key={cell.label}
            className={cn(
              "p-4 text-center md:p-5",
              i % 2 === 1 && "border-s-2 border-gray-100",
              i >= 2 && "border-t-2 border-gray-100 md:border-t-0",
              i >= 1 && "md:border-s-2 md:border-gray-100"
            )}
          >
            <cell.icon className="mx-auto size-5 text-primary" aria-hidden="true" />
            <p className="oeg-mono mt-2 text-xl font-bold md:text-2xl">{cell.value}</p>
            <p className="mt-1 text-xs text-gray-500">{cell.label}</p>
          </div>
        ))}
      </div>

      {/* تدریس خصوصی (Phase 2) */}
      {hasTeach && teach && (
        <section className="mt-10" aria-label="تدریس خصوصی">
          <h2 className="text-xl font-black md:text-2xl">
            تدریس خصوصی {isMe ? "شما" : firstName}
          </h2>
          <div className="mt-4 border-2 border-ink bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 border-2 border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-bold">
                <GraduationCap className="size-4 text-gray-400" aria-hidden="true" />
                {faNumber(teach.completedSessions)} جلسه برگزارشده
              </span>
              <span className="flex items-center gap-1.5 border-2 border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-bold">
                <Star className="size-4 text-gold" aria-hidden="true" />
                امتیاز کلاس‌ها: <b className="oeg-mono">{faRating(teach.avgSessionRating)}</b>
              </span>
              <span className="flex items-center gap-1.5 border-2 border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-bold">
                <PlayCircle className="size-4 text-gray-400" aria-hidden="true" />
                {faNumber(teach.courseCount)} دوره
              </span>
            </div>
            {teach.openSlots > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t-2 border-gray-100 pt-4">
                <div>
                  {teach.minSlotPrice != null && (
                    <p className="text-xs text-gray-400">شروع از</p>
                  )}
                  <p className="oeg-mono text-lg font-black">
                    {teach.minSlotPrice != null ? faToman(teach.minSlotPrice) : "—"}
                  </p>
                </div>
                <Button
                  onClick={() => navigate(`#/book/${id}`)}
                  className="oeg-hard-shadow h-12 border-2 border-ink px-6 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  <CalendarClock className="size-5" aria-hidden="true" /> رزرو کلاس خصوصی
                </Button>
                <p className="text-xs text-gray-400">
                  {faNumber(teach.openSlots)} زمان آزاد برای رزرو ثبت شده است.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* دوره‌های ویدیویی (Phase 2) */}
      {courses && courses.length > 0 && (
        <section className="mt-10" aria-label="دوره‌های ویدیویی این کاربر">
          <h2 className="text-xl font-black md:text-2xl">
            دوره‌های ویدیویی {isMe ? "شما" : firstName}
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <li key={course.id}>
                <a
                  href={`#/course/${course.id}`}
                  className="flex items-center gap-3 border-2 border-ink bg-white p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <CourseCover
                    src={course.coverUrl}
                    title={course.title}
                    className="h-16 w-24 shrink-0 border-2 border-ink"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm font-black leading-6">{course.title}</span>
                    <span className="oeg-mono mt-1 block text-xs font-bold text-primary">
                      {course.price === 0 ? "رایگان" : faToman(course.price)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* pamphlets */}
      <section className="mt-10" aria-label="جزوه‌های این کاربر">
        <h2 className="text-xl font-black md:text-2xl">
          جزوه‌های {isMe ? "شما" : firstName}
        </h2>
        <div className="mt-5">
          {pamphlets.length === 0 ? (
            <EmptyBox
              title={isMe ? "هنوز جزوه‌ای منتشر نکرده‌اید" : "هنوز جزوه‌ای منتشر نکرده است"}
              description={
                isMe
                  ? "اولین جزوهٔ خود را بارگذاری کنید تا نامتان در کتابخانه ثبت شود."
                  : "به‌محض انتشار اولین جزوه، اینجا نمایش داده می‌شود."
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pamphlets.map((p) => (
                <PamphletCard key={p.id} pamphlet={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {isMe && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          user={user}
          onSaved={profile.retry}
        />
      )}
    </div>
  );
}
