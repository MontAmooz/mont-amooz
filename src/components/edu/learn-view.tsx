"use client";

// مُنت‌آموز — Phase 2 my-learning view (#/learn): enrolled course grid with progress.

import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { faNumber } from "@/lib/format";
import type { EnrolledCourse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CourseCover, EmptyBox, ErrorBox, SkeletonCards } from "./bits";
import { useFetch } from "./hooks";
import { navigate } from "./router";

export default function LearnView() {
  const learn = useFetch<{ items: EnrolledCourse[] }>(() => api<{ items: EnrolledCourse[] }>("/learn"), []);

  const items = learn.data?.items ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-black">یادگیری من</h1>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-500">
        دوره‌هایی که تهیه کرده‌اید؛ پیشرفت شما درس‌به‌درس ذخیره می‌شود و همیشه از همان‌جا ادامه دهید.
      </p>

      <div className="mt-8">
        {learn.loading ? (
          <SkeletonCards count={4} />
        ) : learn.error ? (
          <ErrorBox message={learn.error} onRetry={learn.retry} />
        ) : items.length === 0 ? (
          <EmptyBox
            title="هنوز دوره‌ای تهیه نکرده‌اید"
            description="از فروشگاه دوره‌ها، دورهٔ مناسب پایه و درس خودتان را انتخاب کنید؛ دوره‌های رایگان هم داریم."
            action={
              <Button
                className="h-11 border-2 border-ink font-black md:h-10"
                onClick={() => navigate("#/courses")}
              >
                <PlayCircle className="size-4" aria-hidden="true" /> رفتن به دوره‌ها
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((course) => {
              const done = course.progressPercent >= 100;
              return (
                <article
                  key={course.id}
                  className="flex flex-col border-2 border-ink bg-white transition-all duration-150 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#111827]"
                >
                  <CourseCover
                    src={course.coverUrl}
                    title={course.title}
                    className="aspect-video w-full border-b-2 border-ink"
                  />
                  <div className="flex flex-1 flex-col p-4">
                    <h2 className="line-clamp-2 min-h-11 font-black leading-6">{course.title}</h2>
                    <p className="mt-1 truncate text-xs font-bold text-gray-500">{course.teacher.fullName}</p>

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="font-bold">
                          {faNumber(course.watchedLessons)} از {faNumber(course.lessonCount)} درس
                        </span>
                        {done ? (
                          <span className="border-2 border-gold bg-gold/15 px-1.5 font-black text-[#8a6a24]">
                            تکمیل‌شده
                          </span>
                        ) : (
                          <span className="oeg-mono font-bold">{faNumber(course.progressPercent)}٪</span>
                        )}
                      </div>
                      <div
                        className="mt-2 h-3 border-2 border-ink bg-white"
                        role="progressbar"
                        aria-valuenow={course.progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`پیشرفت دورهٔ ${course.title}`}
                      >
                        <div
                          className={cn("h-full", done ? "bg-gold" : "bg-success")}
                          style={{ width: `${course.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={() => navigate(`#/learn/${course.id}`)}
                      className="mt-4 h-11 w-full border-2 border-ink font-black md:h-10"
                    >
                      {done ? "مرور دوره" : "ادامهٔ یادگیری"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
