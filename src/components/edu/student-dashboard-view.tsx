"use client";

// مُنت‌آموز — student learning dashboard (#/my-learning, P18): a unified
// progress view symmetric to the P17 teacher analytics — four summary cards,
// the up-next session/lesson and the 20 most recent activities, all gathered
// from signals the platform already tracks. Read-only over
// GET /users/me/dashboard.

import { BookOpen, Calendar, GraduationCap, TrendingUp, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { faNumber, faRelative } from "@/lib/format";
import type { DashboardActivityType, StudentDashboard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AuthRequiredBox, EmptyBox, ErrorBox, PageSkeleton } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";
import { useEduStore } from "./store";

const ACTIVITY_ICONS: Record<DashboardActivityType, typeof BookOpen> = {
  lesson: BookOpen,
  exam: GraduationCap,
  course: Video,
  session: Calendar,
};

function ActivityIcon({ type }: { type: DashboardActivityType }) {
  const Icon = ACTIVITY_ICONS[type];
  return <Icon className="size-5 text-primary" aria-hidden="true" />;
}

/** Borderless mini progress bar (learn-view style) for activity rows. */
function ActivityBar({ pct }: { pct: number }) {
  return (
    <div
      className="h-2 w-20 border-2 border-ink bg-white"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full", pct >= 100 ? "bg-gold" : "bg-success")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function StudentDashboardView() {
  const { user, sessionLoaded } = useEduStore();
  const stats = useFetch<StudentDashboard>(
    () => api<StudentDashboard>("/users/me/dashboard"),
    [user?.id]
  );

  if (!sessionLoaded) return <PageSkeleton />;
  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16">
        <AuthRequiredBox
          title="برای دیدن پیشرفت خود وارد حساب کاربری شوید"
          hint="پیشرفت درس‌ها، آزمون‌ها، دوره‌ها و کلاس‌های شما اینجا جمع می‌شود."
        />
      </div>
    );
  }

  const data = stats.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black md:text-3xl">
            <TrendingUp className="size-7 text-primary" aria-hidden="true" /> پیشرفت من
          </h1>
          <p className="mt-2 text-sm leading-7 text-gray-500">
            پیشرفت و فعالیت‌های شما در یک نگاه — درس‌های تعاملی، آزمون‌ها، دوره‌ها و کلاس‌ها.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("#/learn")}
          className="h-11 border-2 border-ink font-bold md:h-10"
        >
          دوره‌های من
        </Button>
      </div>

      <div className="mt-8">
        {stats.loading && !data ? (
          <PageSkeleton />
        ) : stats.error ? (
          <ErrorBox message={stats.error} onRetry={stats.retry} />
        ) : data ? (
          <DashboardBody data={data} />
        ) : null}
      </div>
    </div>
  );
}

function DashboardBody({ data }: { data: StudentDashboard }) {
  const { summary, upcoming, recent } = data;
  const isEmpty = recent.length === 0;

  const cards = [
    {
      icon: BookOpen,
      label: "درس‌های تعاملی",
      value: `${faNumber(summary.interactiveLessons.started)} از ${faNumber(summary.interactiveLessons.totalAvailable)}`,
      sub: `${faNumber(summary.interactiveLessons.completed)} تکمیل شده`,
      link: "#/lessons",
    },
    {
      icon: GraduationCap,
      label: "آزمون‌ها",
      value: faNumber(summary.exams.taken),
      sub:
        summary.exams.averageScorePct !== null
          ? `میانگین ${faNumber(summary.exams.averageScorePct)}٪`
          : "هنوز شرکت نکرده‌اید",
      link: "#/exams",
    },
    {
      icon: Video,
      label: "دوره‌ها",
      value: faNumber(summary.courses.enrolled),
      sub:
        summary.courses.averageProgressPct !== null
          ? `میانگین پیشرفت ${faNumber(summary.courses.averageProgressPct)}٪`
          : "هنوز ثبت‌نام نکرده‌اید",
      link: "#/courses",
    },
    {
      icon: Calendar,
      label: "جلسات",
      value: faNumber(summary.sessions.attended),
      sub:
        summary.sessions.upcoming > 0
          ? `${faNumber(summary.sessions.upcoming)} جلسهٔ پیش‌رو`
          : "بدون جلسهٔ پیش‌رو",
      link: "#/sessions",
    },
  ];

  return (
    <>
      {/* summary cards — same card grid as P17 teacher analytics */}
      <div className="grid grid-cols-2 border-2 border-ink bg-white md:grid-cols-4">
        {cards.map((card, i) => (
          <a
            key={card.label}
            href={card.link}
            className={cn(
              "block p-4 text-center transition-colors hover:bg-gray-50 md:p-5",
              i % 2 === 1 && "border-s-2 border-gray-100",
              i >= 2 && "border-t-2 border-gray-100 md:border-t-0",
              i >= 1 && "md:border-s-2 md:border-gray-100"
            )}
          >
            <card.icon className="mx-auto size-5 text-primary" aria-hidden="true" />
            <p className="oeg-mono mt-2 text-xl font-black md:text-2xl">{card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.label}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">{card.sub}</p>
          </a>
        ))}
      </div>

      {/* up next */}
      {(upcoming.nextSession || upcoming.nextLesson) && (
        <section className="mt-8">
          <h2 className="text-lg font-black">در پیش</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {upcoming.nextSession && (
              <a
                href={`#/session/${upcoming.nextSession.id}`}
                className="block border-2 border-ink bg-white p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#111827]"
              >
                <p className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <Calendar className="size-4 text-primary" aria-hidden="true" /> جلسهٔ بعدی
                </p>
                <p className="mt-2 font-black">{upcoming.nextSession.topic ?? "جلسهٔ تدریس"}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {upcoming.nextSession.role === "student"
                    ? `با ${upcoming.nextSession.teacherName}`
                    : `دانش‌آموز: ${upcoming.nextSession.studentName}`}
                </p>
                <p className="mt-1 text-sm text-gray-500">{faRelative(upcoming.nextSession.startAt)}</p>
              </a>
            )}
            {upcoming.nextLesson && (
              <a
                href={`#/lesson/${upcoming.nextLesson.lessonId}`}
                className="block border-2 border-ink bg-white p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#111827]"
              >
                <p className="flex items-center gap-2 text-xs font-bold text-gray-500">
                  <BookOpen className="size-4 text-primary" aria-hidden="true" /> ادامهٔ درس
                </p>
                <p className="mt-2 font-black">{upcoming.nextLesson.lessonTitle}</p>
                <p className="mt-1 text-sm text-gray-600">
                  گام {faNumber(upcoming.nextLesson.currentStep)} از {faNumber(upcoming.nextLesson.totalSteps)}
                </p>
                <div className="mt-3">
                  <ActivityBar
                    pct={
                      upcoming.nextLesson.totalSteps > 0
                        ? Math.round(
                            (upcoming.nextLesson.currentStep / upcoming.nextLesson.totalSteps) * 100
                          )
                        : 0
                    }
                  />
                </div>
              </a>
            )}
          </div>
        </section>
      )}

      {/* recent activity */}
      <section className="mt-8">
        <h2 className="text-lg font-black">فعالیت‌های اخیر</h2>
        <div className="mt-3">
          {isEmpty ? (
            <EmptyBox
              title="شما هنوز فعالیتی نداشته‌اید"
              description="با شروع یک درس تعاملی، شرکت در آزمون یا دیدن دوره‌ها، پیشرفتتان اینجا جمع می‌شود."
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={() => navigate("#/lessons")}
                    className="h-11 border-2 border-ink font-black md:h-10"
                  >
                    مشاهدهٔ درس‌ها
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("#/exams")}
                    className="h-11 border-2 border-ink font-black md:h-10"
                  >
                    شرکت در آزمون
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("#/courses")}
                    className="h-11 border-2 border-ink font-black md:h-10"
                  >
                    دوره‌ها
                  </Button>
                </div>
              }
            />
          ) : (
            <ul className="border-2 border-ink bg-white">
              {recent.map((item) => (
                <li key={`${item.type}-${item.id}`} className="border-b border-gray-100 last:border-b-0">
                  <a
                    href={item.linkUrl}
                    className="flex items-center gap-3 p-3 transition-colors hover:bg-gray-50 md:p-4"
                  >
                    <ActivityIcon type={item.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{item.subtitle}</p>
                    </div>
                    {item.progressPct !== undefined && <ActivityBar pct={item.progressPct} />}
                    {item.scorePct !== undefined && (
                      <span className="oeg-mono shrink-0 text-sm font-bold text-gray-600">
                        {faNumber(item.scorePct)}٪
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-gray-400">{faRelative(item.updatedAt)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
