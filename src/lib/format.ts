// مُنت‌آموز — Persian formatting helpers (client-safe, no server deps)

const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert any digits in string to Persian digits. */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => faDigits[Number(d)]);
}

/** Format a number with Persian digits and thousand separators. */
export function faNumber(n: number): string {
  return toFaDigits(new Intl.NumberFormat("en-US").format(Math.round(n)));
}

/** Persian (Jalali) date, e.g. «۲۳ مهر ۱۴۰۴». */
export function faDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(d);
  } catch {
    return toFaDigits(d.toISOString().slice(0, 10));
  }
}

/** Relative Persian time, e.g. «۳ روز پیش». */
export function faRelative(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "همین حالا";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${toFaDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toFaDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${toFaDigits(days)} روز پیش`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${toFaDigits(months)} ماه پیش`;
  return faDate(d);
}

/** Normalize Persian text for search: unify ی/ك, strip ZWNJ & diacritics, lowercase. */
export function normalizePersian(text: string): string {
  return text
    .replace(/[\u064A\u0649]/g, "\u06CC") // ي → ی
    .replace(/\u0643/g, "\u06A9") // ك → ک
    .replace(/[\u200c\u200f\u200e]/g, " ") // ZWNJ → space
    .replace(/[\u064B-\u065F\u0670]/g, "") // diacritics
    .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
      const c = d.charCodeAt(0);
      const n = c >= 0x06F0 ? c - 0x06F0 : c - 0x0660;
      return String(n);
    })
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Star rating display: 4.3 → «۴٫۳». */
export function faRating(r: number): string {
  if (!r || r <= 0) return "—";
  const s = r.toFixed(1).replace(".", "٫");
  return toFaDigits(s);
}

/** Truncate text with ellipsis. */
export function truncate(text: string, len: number): string {
  return text.length > len ? text.slice(0, len) + "…" : text;
}

/** Persian date + time, e.g. «۲۳ مهر ۱۴۰۴، ۱۶:۳۰». */
export function faDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(d);
  } catch {
    return faDate(d);
  }
}

/** Time only, e.g. «۱۶:۳۰». */
export function faTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(d);
  } catch {
    return toFaDigits(d.toISOString().slice(11, 16));
  }
}

/** Weekday + Jalali date without year, e.g. «شنبه ۱۲ دی» (great for slot pickers). */
export function faDayLabel(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  try {
    return new Intl.DateTimeFormat("fa-IR", { weekday: "long", month: "long", day: "numeric" }).format(d);
  } catch {
    return faDate(d);
  }
}

/** Money in Toman with Persian digits, e.g. ۱۲۵٬۰۰۰ تومان. */
export function faToman(amount: number): string {
  if (!amount) return "رایگان";
  return `${faNumber(amount)} تومان`;
}

/** Signed money for transaction lists: +۱۲۵٬۰۰۰ / −۱۲۵٬۰۰۰ (without the word). */
export function faSignedAmount(amount: number): string {
  const sign = amount > 0 ? "+" : amount < 0 ? "−" : "";
  return `${sign}${faNumber(Math.abs(amount))}`;
}

/** Minutes → Persian duration, e.g. «۹۰ دقیقه» or «۲ ساعت و ۳۰ دقیقه». */
export function faDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${toFaDigits(h)} ساعت و ${toFaDigits(m)} دقیقه`;
  if (h) return `${toFaDigits(h)} ساعت`;
  return `${toFaDigits(m)} دقیقه`;
}
