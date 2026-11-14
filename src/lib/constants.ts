// مُنت‌آموز — shared constants (Persian educational taxonomy)

export const GRADES = [
  "هفتم",
  "هشتم",
  "نهم",
  "دهم",
  "یازدهم",
  "دوازدهم",
] as const;

export const SUBJECTS = [
  "ریاضی",
  "علوم",
  "هندسه",
  "حسابان",
  "آمار و احتمال",
  "فیزیک",
  "شیمی",
  "زیست‌شناسی",
  "ادبیات فارسی",
  "عربی",
  "دینی",
  "زبان انگلیسی",
  "تاریخ",
  "جغرافیا",
] as const;

export const TEACHING_METHODS = [
  "مفهومی",
  "مثال‌محور",
  "کنکوری",
  "جمع‌بندی",
  "حل تمرین",
  "داستان‌محور",
] as const;

export const DIFFICULTIES = ["مقدماتی", "متوسط", "پیشرفته"] as const;

export const ROLES = ["معلم", "دانش‌آموز", "تایپیست", "برنامه‌نویس"] as const;

export const MR_STATUS_LABELS: Record<string, string> = {
  OPEN: "باز",
  MERGED: "ادغام‌شده",
  REJECTED: "ردشده",
};

export const METHOD_STYLES: Record<string, string> = {
  مفهومی: "bg-[#DD614C]/10 text-[#DD614C] border-[#DD614C]/40",
  مثال‌محور: "bg-[#DAA144]/10 text-[#8a6a24] border-[#DAA144]/50",
  کنکوری: "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/40",
  جمع‌بندی: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/40",
  "حل تمرین": "bg-gray-100 text-gray-700 border-gray-300",
  "داستان‌محور": "bg-gray-100 text-gray-700 border-gray-300",
};

export const DIFFICULTY_STYLES: Record<string, string> = {
  مقدماتی: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/40",
  متوسط: "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/40",
  پیشرفته: "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/40",
};

export const SESSION_COOKIE = "ma_session";
export const SESSION_MAX_AGE = 60 * 60 * 24; // 24h — standard login (P10)
export const SESSION_MAX_AGE_REMEMBER = 60 * 60 * 24 * 30; // 30d — «مرا به خاطر بسپار» (P10)

export const SORT_OPTIONS = [
  { value: "newest", label: "جدیدترین" },
  { value: "top", label: "بهترین امتیاز" },
  { value: "popular", label: "پربازدیدترین" },
] as const;

// ===================== Phase 2 — Teaching Marketplace =====================

/** پلتفرم ۲۰٪ کمیسیون، معلم ۸۰٪ */
export const PLATFORM_COMMISSION_PERCENT = 20;

export const TXN_LABELS: Record<string, string> = {
  DEPOSIT: "شارژ کیف پول",
  WITHDRAW: "برداشت",
  SESSION_PAYMENT: "پرداخت جلسه",
  SESSION_REFUND: "بازگشت وجه جلسه",
  SESSION_EARNING: "درآمد تدریس",
  COURSE_PURCHASE: "خرید دوره",
  COURSE_EARNING: "فروش دوره",
};

export const TXN_STYLES: Record<string, string> = {
  DEPOSIT: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/40",
  WITHDRAW: "bg-gray-100 text-gray-700 border-gray-300",
  SESSION_PAYMENT: "bg-[#DD614C]/10 text-[#DD614C] border-[#DD614C]/40",
  SESSION_REFUND: "bg-[#DAA144]/10 text-[#8a6a24] border-[#DAA144]/50",
  SESSION_EARNING: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/40",
  COURSE_PURCHASE: "bg-[#DD614C]/10 text-[#DD614C] border-[#DD614C]/40",
  COURSE_EARNING: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/40",
};

export const SESSION_STATUS_LABELS: Record<string, string> = {
  BOOKED: "رزرو شده",
  COMPLETED: "برگزار شده",
  CANCELLED_STUDENT: "لغو توسط دانش‌آموز",
  CANCELLED_TEACHER: "لغو توسط معلم",
};

export const SESSION_STATUS_STYLES: Record<string, string> = {
  BOOKED: "bg-[#DAA144]/10 text-[#8a6a24] border-[#DAA144]/50",
  COMPLETED: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/40",
  CANCELLED_STUDENT: "bg-gray-100 text-gray-600 border-gray-300",
  CANCELLED_TEACHER: "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/40",
};

export const SLOT_STATUS_LABELS: Record<string, string> = {
  OPEN: "آزاد",
  BOOKED: "رزروشده",
  BLOCKED: "مسدود",
};

export const COURSE_SORT_OPTIONS = [
  { value: "newest", label: "جدیدترین" },
  { value: "top", label: "بهترین امتیاز" },
  { value: "popular", label: "پرطرفدارترین" },
  { value: "price_asc", label: "ارزان‌ترین" },
  { value: "price_desc", label: "گران‌ترین" },
] as const;

export const MARKET_SORT_OPTIONS = [
  { value: "rating", label: "بهترین امتیاز کلاس" },
  { value: "price_asc", label: "ارزان‌ترین نرخ" },
  { value: "price_desc", label: "گران‌ترین نرخ" },
  { value: "sessions", label: "بیشترین جلسات" },
] as const;

/** Wallet limits (Toman) */
export const WALLET_MIN_DEPOSIT = 10_000;
export const WALLET_MAX_DEPOSIT = 5_000_000;
export const WALLET_MIN_WITHDRAW = 50_000;

/** Slot booking rules */
export const SLOT_MIN_PRICE = 20_000;
export const SLOT_MAX_PRICE = 2_000_000;
export const SLOT_DURATIONS = [30, 45, 60, 90, 120] as const;
/** Cancel ≥2h before start → full refund; closer → 50% teacher compensation */
export const SESSION_CANCEL_FULL_REFUND_HOURS = 2;
