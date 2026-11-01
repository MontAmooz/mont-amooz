"use client";

// مُنت‌آموز — Phase 2 lesson player (#/learn/{courseId}): video player + lesson sidebar
// with progress, watch toggle (POST /lessons/{id}/watched), prev/next navigation.

import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  PlayCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/client";
import { faDuration, faNumber, toFaDigits } from "@/lib/format";
import type { CourseDetail, LessonItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorBox, InfoNote, PageSkeleton, Spinner } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";

export default function LearnPlayerView({ id }: { id: string }) {
  const { toast } = useToast();
  const detail = useFetch<CourseDetail>(
    () => api<CourseDetail>(`/courses/${id}`),
    [id]
  );

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [adoptedFrom, setAdoptedFrom] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const redirectedRef = useRef(false);
  const currentRef = useRef<HTMLLIElement>(null);

  const course = detail.data ?? null;

  // adopt the initial lesson once the course arrives (render-time adjust — lint-safe)
  if (course && course.id !== adoptedFrom) {
    setAdoptedFrom(course.id);
    const valid = currentId && course.lessons.some((lesson) => lesson.id === currentId);
    if (!valid) {
      const first =
        course.lessons.find((lesson) => lesson.watched === false) ??
        course.lessons[course.lessons.length - 1];
      setCurrentId(first?.id ?? null);
    }
  }

  // enrollment guard — redirect once (toast + navigate are external side effects)
  useEffect(() => {
    if (course && !course.enrolled && !course.isMine && !redirectedRef.current) {
      redirectedRef.current = true;
      toast({
        title: "دسترسی ندارید",
        description: "ابتدا دوره را تهیه کنید.",
        variant: "destructive",
      });
      navigate(`#/course/${course.id}`);
    }
  }, [course, toast]);

  const lessons = course?.lessons ?? [];
  const currentIndex = lessons.findIndex((lesson) => lesson.id === currentId);
  const lesson = currentIndex >= 0 ? lessons[currentIndex] : null;
  const watchedCount = lessons.filter((l) => l.watched).length;
  const progressPercent = lessons.length > 0 ? Math.round((watchedCount / lessons.length) * 100) : 0;

  // keep the current lesson visible in the sidebar (DOM-only effect)
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentId]);

  if (detail.loading && !detail.data) {
    return <PageSkeleton />;
  }
  if (detail.error || !course) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorBox message={detail.error ?? "دوره پیدا نشد."} onRetry={detail.retry} />
      </div>
    );
  }

  async function setWatched(target: LessonItem, watched: boolean) {
    setToggling(true);
    try {
      await api(`/lessons/${target.id}/watched`, {
        method: "POST",
        json: { watched },
      });
      detail.setData((prev) =>
        prev
          ? {
              ...prev,
              lessons: prev.lessons.map((l) => (l.id === target.id ? { ...l, watched } : l)),
            }
          : prev
      );
      if (watched) {
        toast({ title: "درس تماشا‌شده علامت خورد", description: "پیشرفت شما ذخیره شد." });
      }
    } catch (err) {
      toast({
        title: "ثبت پیشرفت ناموفق بود",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setToggling(false);
    }
  }

  function goto(delta: number) {
    const next = lessons[currentIndex + delta];
    if (next) {
      setCurrentId(next.id);
      window.scrollTo({ top: 0 });
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col border-2 border-ink bg-white" aria-label="فهرست درس‌ها">
      <div className="border-b-2 border-ink p-4">
        <a
          href={`#/course/${course.id}`}
          className="line-clamp-2 font-black leading-6 hover:text-primary"
        >
          {course.title}
        </a>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span className="font-bold">
            {faNumber(watchedCount)} از {faNumber(lessons.length)} درس
          </span>
          <span className="oeg-mono font-bold">{faNumber(progressPercent)}٪</span>
        </div>
        <div
          className="mt-2 h-3 border-2 border-ink bg-white"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="پیشرفت دوره"
        >
          <div
            className="h-full bg-success"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      <ul className="oeg-scroll min-h-0 flex-1 overflow-y-auto">
        {lessons.map((item) => {
          const isCurrent = item.id === currentId;
          return (
            <li key={item.id} ref={isCurrent ? currentRef : undefined}>
              <button
                type="button"
                onClick={() => setCurrentId(item.id)}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 border-b-2 border-gray-100 p-3 text-start transition-colors",
                  isCurrent ? "border-2 border-primary bg-primary/10" : "hover:bg-gray-50"
                )}
              >
                <span className="oeg-mono flex size-8 shrink-0 items-center justify-center border-2 border-ink bg-white text-xs font-black">
                  {toFaDigits(item.order)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{item.title}</span>
                  {item.durationMinutes ? (
                    <span className="text-[11px] text-gray-400">{faDuration(item.durationMinutes)}</span>
                  ) : null}
                </span>
                {item.watched ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="دیده‌شده" />
                ) : item.locked ? (
                  <Lock className="size-4 shrink-0 text-gray-300" aria-hidden="true" />
                ) : (
                  <PlayCircle className="size-4 shrink-0 text-gray-300" aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <a
        href="#/learn"
        className="inline-flex h-9 items-center gap-1 text-sm font-bold text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowRight className="size-4" aria-hidden="true" /> یادگیری من
      </a>

      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* player column */}
        <div>
          {lesson?.videoUrl ? (
            <video
              key={lesson.id}
              controls
              className="aspect-video w-full border-2 border-ink bg-black"
              src={lesson.videoUrl}
              poster={course.coverUrl ?? undefined}
              onEnded={() => {
                if (!lesson.watched) void setWatched(lesson, true);
              }}
            >
              مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
            </video>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center border-2 border-ink bg-gray-50 p-6 text-center">
              <div>
                <Lock className="mx-auto size-10 text-gray-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-bold text-gray-500">این درس در دسترس شما نیست.</p>
              </div>
            </div>
          )}

          <div className="mt-4 border-2 border-ink bg-white p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="oeg-mono border-2 border-ink px-2 py-0.5 text-sm font-black">
                درس {lesson ? toFaDigits(lesson.order) : "—"}
              </span>
              <h1 className="min-w-0 flex-1 text-lg font-black md:text-xl">{lesson?.title ?? "…"}</h1>
              <Button
                variant={lesson?.watched ? "outline" : "default"}
                disabled={!lesson || toggling}
                onClick={() => lesson && void setWatched(lesson, !lesson.watched)}
                className={cn(
                  "h-11 border-2 font-black md:h-10",
                  lesson?.watched
                    ? "border-success bg-success/10 text-success hover:bg-success/15"
                    : "border-ink"
                )}
              >
                {toggling ? <Spinner /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                {lesson?.watched ? "دیده‌شده (برگرداندن)" : "اتمام این درس"}
              </Button>
            </div>

            {lesson?.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                {lesson.description}
              </p>
            )}
            {lesson?.durationMinutes ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                <Clock className="size-3.5" aria-hidden="true" /> مدت: {faDuration(lesson.durationMinutes)}
              </p>
            ) : null}

            <div className="mt-4 flex items-center justify-between border-t-2 border-gray-100 pt-4">
              <Button
                variant="outline"
                disabled={currentIndex <= 0}
                onClick={() => goto(-1)}
                className="h-11 border-2 border-ink font-bold hover:bg-gray-50 md:h-10"
              >
                <ChevronRight className="size-4" aria-hidden="true" /> درس قبل
              </Button>
              <Button
                variant="outline"
                disabled={currentIndex < 0 || currentIndex >= lessons.length - 1}
                onClick={() => goto(1)}
                className="h-11 border-2 border-ink font-bold hover:bg-gray-50 md:h-10"
              >
                درس بعد <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        {/* sidebar */}
        <div className="h-[560px] lg:h-auto lg:max-h-[calc(100vh-8rem)] lg:sticky lg:top-24">
          {sidebar}
        </div>
      </div>

      {course.isMine && !course.enrolled && (
        <div className="mt-4">
          <InfoNote>این دورهٔ خودتان است؛ پیشرفت دانشجویان برای شما ثبت نمی‌شود.</InfoNote>
        </div>
      )}
    </div>
  );
}
