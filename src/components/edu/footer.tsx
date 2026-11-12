"use client";

// مُنت‌آموز — sticky bottom footer (root wrapper is min-h-screen flex flex-col; this gets mt-auto).

import { LogoMark } from "./bits";

const QUICK_LINKS = [
  { label: "جستجوی جزوه‌ها", hash: "#/" },
  { label: "دوره‌های ویدیویی", hash: "#/courses" },
  { label: "بازارچهٔ تدریس", hash: "#/market" },
  { label: "بارگذاری جزوه", hash: "#/create" },
  { label: "درخواست‌های ادغام", hash: "#/requests" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t-2 border-ink bg-ink pb-[env(safe-area-inset-bottom)] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:grid-cols-3 md:py-12">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark className="size-8 text-white" />
            <span className="text-lg font-black">
              مُنت <span className="text-gold">آموز</span>
            </span>
          </div>
          <p className="mt-4 text-sm leading-7 text-white/60">
            کتابخانهٔ زندهٔ جزوه‌های درسی ایران؛ معلم‌ها جزوه می‌گذارند، جامعه بهترش می‌کند — و حالا کلاس خصوصی رزرو می‌کن و دوره می‌خر.
          </p>
        </div>

        <nav aria-label="پیوندهای سریع">
          <h3 className="text-sm font-black text-gold">دسترسی سریع</h3>
          <ul className="mt-4 space-y-1 text-sm">
            {QUICK_LINKS.map((link) => (
              <li key={link.hash}>
                <a
                  href={link.hash}
                  className="inline-flex h-8 items-center text-white/70 transition-colors hover:text-white hover:underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="text-sm font-black text-gold">مجوزها</h3>
          <p className="mt-4 text-sm leading-7 text-white/70">
            کد: <span className="oeg-mono" dir="ltr">AGPLv3</span>
            <span className="mx-2 text-white/30">—</span>
            محتوا: <span className="oeg-mono" dir="ltr">CC BY-SA 4.0</span>
          </p>
          <blockquote className="mt-4 border-s-2 border-gold ps-3 text-sm leading-7 text-gold">
            «تنها راه رسیدن به بهترین جزوه، نوشتن آن با هم است.»
          </blockquote>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-white/40">
        <span className="oeg-mono">مُنت‌آموز</span> — ساخته‌شده با عشق برای معلم‌های ایران
      </div>
    </footer>
  );
}
