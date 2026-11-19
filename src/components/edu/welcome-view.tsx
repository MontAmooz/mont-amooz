"use client";

// مُنت‌آموز — first-login welcome (#/welcome, P16): a 3-step orientation for
// new accounts. Reached only from the auth success handler (auth-dialog),
// which sets the montamooz_welcomed localStorage flag before redirecting —
// session restores never land here, and finishing/skipping sets the flag too.

import { BookOpen, ClipboardList, GraduationCap, PlayCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { faNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { navigate } from "./router";
import { useEduStore } from "./store";

const WELCOME_FLAG = "montamooz_welcomed";

function finish(hash: string): void {
  try {
    window.localStorage.setItem(WELCOME_FLAG, "1");
  } catch {
    // storage may be unavailable (private mode) — the redirect still works
  }
  navigate(hash);
}

export function WelcomeView() {
  const user = useEduStore((s) => s.user);
  const isTeacher = user?.role === "معلم";
  // teachers get a third step; others finish at «سه راه شروع»
  const lastStep = isTeacher ? 2 : 1;
  const [step, setStep] = useState(0);

  const steps = isTeacher
    ? ["خوش آمدید", "سه راه شروع", "شما معلم هستید"]
    : ["خوش آمدید", "سه راه شروع"];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* skip — top-right in RTL means the END side of the row */}
      <div className="flex items-center justify-between">
        <span className="oeg-mono text-xs font-bold text-gray-400">
          گام {faNumber(step + 1)} از {faNumber(steps.length)}
        </span>
        <button
          type="button"
          onClick={() => finish("#/")}
          className="text-sm font-bold text-gray-400 transition-colors hover:text-ink"
        >
          رد کردن
        </button>
      </div>

      {/* progress dots */}
      <div className="mt-3 flex gap-1.5" aria-label="پیشرفت معرفی">
        {steps.map((label, i) => (
          <span
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={cn("h-2 flex-1 border-2", i <= step ? "border-primary bg-primary" : "border-gray-200 bg-white")}
          />
        ))}
      </div>

      <div className="mt-8 border-2 border-ink bg-white p-6 md:p-10">
        {step === 0 && (
          <div className="text-center">
            <span className="mx-auto flex size-16 items-center justify-center border-2 border-ink bg-primary text-white">
              <BookOpen className="size-8" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-2xl font-black md:text-3xl">
              به مُنت‌آموز خوش آمدید
            </h1>
            <p className="mt-2 text-sm font-bold text-gray-500">
              کتابخانهٔ زندهٔ جزوه‌های درسی ایران
            </p>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-8 text-gray-600 md:text-base">
              اینجا می‌توانید جزوه‌های معلمان سراسر کشور را رایگان بخوانید، آزمون بدهید، در
              کلاس‌های آنلاین شرکت کنید و خودتان هم جزوه بسازید.
            </p>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-center text-xl font-black md:text-2xl">سه راه شروع</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {(
                [
                  { icon: BookOpen, title: "جزوه‌ها را ببینید", desc: "فیلتر بر اساس پایه و درس", hash: "#/" },
                  { icon: ClipboardList, title: "آزمون بدهید", desc: "شرکت در آزمون معلم‌ها", hash: "#/exams" },
                  { icon: GraduationCap, title: "در کلاس‌ها شرکت کنید", desc: "رزرو کلاس خصوصی", hash: "#/market" },
                ] as const
              ).map((c) => (
                <button
                  key={c.hash}
                  type="button"
                  onClick={() => finish(c.hash)}
                  className="flex flex-col items-center gap-2 border-2 border-ink bg-white p-5 text-center transition-all duration-150 hover:-translate-y-1 hover:border-primary hover:shadow-[5px_5px_0_0_#111827]"
                >
                  <c.icon className="size-7 text-primary" aria-hidden="true" />
                  <span className="text-sm font-black">{c.title}</span>
                  <span className="text-xs leading-6 text-gray-500">{c.desc}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-gray-400">
              هر مسیر حساب کاربری می‌خواهد — اگر همین حالا وارد شده‌اید، از همین‌جا برید.
            </p>
          </div>
        )}

        {step === 2 && isTeacher && (
          <div className="text-center">
            <span className="mx-auto flex size-16 items-center justify-center border-2 border-ink bg-gold text-white">
              <PlayCircle className="size-8" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-xl font-black md:text-2xl">شما معلم هستید</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-8 text-gray-600">
              می‌توانید جزوه آپلود کنید، آزمون بسازید، درس تعاملی طراحی کنید و کلاس خصوصی
              برگزار کنید — همه‌چیز از پنل تدریس در دسترس است.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => finish("#/teach")}
                className="oeg-hard-shadow h-12 border-2 border-ink px-8 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                <PlayCircle className="size-5" aria-hidden="true" /> پنل تدریس
              </Button>
              <Button
                variant="outline"
                onClick={() => finish("#/")}
                className="h-12 border-2 border-ink px-6 font-black"
              >
                شروع کنید
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* prev / next */}
      <div className="mt-6 flex items-center justify-between">
        {step > 0 ? (
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            className="h-11 border-2 border-ink font-bold md:h-10"
          >
            قبلی
          </Button>
        ) : (
          <span />
        )}
        {step < lastStep ? (
          <Button onClick={() => setStep((s) => s + 1)} className="h-11 border-2 border-ink px-6 font-black md:h-10">
            بعدی
          </Button>
        ) : (
          !isTeacher && (
            <Button
              onClick={() => finish("#/")}
              className="oeg-hard-shadow h-12 border-2 border-ink px-8 text-base font-black transition-all duration-150 active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              شروع کن
            </Button>
          )
        )}
      </div>
    </div>
  );
}
