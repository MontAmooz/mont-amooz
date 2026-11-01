// Unit tests — src/lib/format.ts (Persian formatting helpers)
// Behavior-capture tests: expectations reflect the ACTUAL implementation
// (e.g. faNumber keeps ASCII commas; faToman(0) → «رایگان»; ZWNJ → space).
import { describe, test, expect } from "vitest";
import {
  toFaDigits,
  faNumber,
  faToman,
  faSignedAmount,
  faRelative,
  faDate,
  faDateTime,
  normalizePersian,
  faDuration,
  faRating,
} from "@/lib/format";

describe("toFaDigits / faNumber", () => {
  test("0 → «۰»", () => {
    expect(toFaDigits(0)).toBe("۰");
  });

  test("123 → «۱۲۳»", () => {
    expect(toFaDigits(123)).toBe("۱۲۳");
  });

  test("1234 → «۱,۲۳۴» (ASCII comma kept — actual behavior)", () => {
    // en-US grouping produces "1,234"; toFaDigits only maps digits,
    // so the separator stays an ASCII comma (not U+066C «٬»).
    expect(faNumber(1234)).toBe("۱,۲۳۴");
  });

  test("rounds fractional input", () => {
    expect(faNumber(1.6)).toBe("۲");
  });

  test("negative → «-۵» (ASCII hyphen — actual behavior)", () => {
    expect(faNumber(-5)).toBe("-۵");
  });

  test("converts digits inside arbitrary strings", () => {
    expect(toFaDigits("نسخه 2 از 10")).toBe("نسخه ۲ از ۱۰");
  });
});

describe("faToman / faSignedAmount", () => {
  test("0 → «رایگان» (actual behavior, not «۰ تومان»)", () => {
    expect(faToman(0)).toBe("رایگان");
  });

  test("50000 → «۵۰,۰۰۰ تومان»", () => {
    expect(faToman(50000)).toBe("۵۰,۰۰۰ تومان");
  });

  test("positive signed amount → «+» prefix", () => {
    expect(faSignedAmount(125000)).toBe("+۱۲۵,۰۰۰");
  });

  test("negative signed amount → «−» prefix (U+2212 minus sign)", () => {
    expect(faSignedAmount(-125000)).toBe("−۱۲۵,۰۰۰");
  });

  test("0 signed → no sign", () => {
    expect(faSignedAmount(0)).toBe("۰");
  });
});

describe("faRelative", () => {
  const now = () => Date.now();

  test("< 60s → «همین حالا»", () => {
    expect(faRelative(new Date(now() - 30_000))).toBe("همین حالا");
  });

  test("5 minutes ago", () => {
    expect(faRelative(new Date(now() - 5 * 60_000))).toBe("۵ دقیقه پیش");
  });

  test("2 hours ago", () => {
    expect(faRelative(new Date(now() - 2 * 3_600_000))).toBe("۲ ساعت پیش");
  });

  test("3 days ago", () => {
    expect(faRelative(new Date(now() - 3 * 86_400_000))).toBe("۳ روز پیش");
  });

  test("2 weeks (~15 days) → «۱۵ روز پیش» (days bucket wins until 30)", () => {
    expect(faRelative(new Date(now() - 15 * 86_400_000))).toBe("۱۵ روز پیش");
  });

  test("3 months (~100 days) → «۳ ماه پیش»", () => {
    expect(faRelative(new Date(now() - 100 * 86_400_000))).toBe("۳ ماه پیش");
  });

  test("future timestamps (negative seconds) also read «همین حالا»", () => {
    expect(faRelative(new Date(now() + 60_000))).toBe("همین حالا");
  });
});

describe("faDate / faDateTime", () => {
  // Deterministic local-time dates (Intl fa-IR uses the runtime timezone).
  const d = new Date(2026, 9, 30, 16, 30); // 2026-10-30 16:30 local

  test("faDate returns a Jalali string with Persian digits", () => {
    const s = faDate(d);
    expect(s).toMatch(/۱۴۰۵/); // Jalali year for 2026-10-30
    expect(s).toMatch(/[-۰-۹]/);
    expect(s).not.toMatch(/[0-9]/); // no ASCII digits
  });

  test("faDateTime includes a time component", () => {
    const s = faDateTime(d);
    expect(s).toMatch(/۱۴۰۵/);
    expect(s.length).toBeGreaterThan(faDate(d).length);
  });

  test("accepts ISO strings", () => {
    expect(faDate("2026-10-30")).toBeTruthy();
  });
});

describe("normalizePersian", () => {
  test("Arabic ي → Persian ی", () => {
    expect(normalizePersian("ي")).toBe("ی");
  });

  test("Arabic ك → Persian ک", () => {
    expect(normalizePersian("ك")).toBe("ک");
  });

  test("Persian ی and ک stay", () => {
    expect(normalizePersian("ی‌ک")).toBe("ی ک"); // ZWNJ → space (actual)
  });

  test("ZWNJ becomes a space (not removed)", () => {
    expect(normalizePersian("می\u200Cرویم")).toBe("می رویم");
  });

  test("diacritics removed", () => {
    expect(normalizePersian("اَ اِ اُ")).toBe("ا ا ا");
  });

  test("Arabic-Indic and Persian digits → ASCII digits", () => {
    expect(normalizePersian("٠١٢")).toBe("012");
    expect(normalizePersian("۰۱۲")).toBe("012");
  });

  test("lowercases Latin and collapses whitespace", () => {
    expect(normalizePersian("  Hello   World  ")).toBe("hello world");
  });

  test("mixed string normalizes consistently (idempotent)", () => {
    const mixed = "رياضی ۱۲ — مِثال‌ها";
    const once = normalizePersian(mixed);
    expect(normalizePersian(once)).toBe(once);
  });
});

describe("faDuration", () => {
  test("30 → «۳۰ دقیقه»", () => {
    expect(faDuration(30)).toBe("۳۰ دقیقه");
  });

  test("60 → «۱ ساعت»", () => {
    expect(faDuration(60)).toBe("۱ ساعت");
  });

  test("90 → «۱ ساعت و ۳۰ دقیقه»", () => {
    expect(faDuration(90)).toBe("۱ ساعت و ۳۰ دقیقه");
  });

  test("0 / negative → «—»", () => {
    expect(faDuration(0)).toBe("—");
    expect(faDuration(-5)).toBe("—");
  });
});

describe("faRating", () => {
  test("4.3 → «۴٫۳»", () => {
    expect(faRating(4.3)).toBe("۴٫۳");
  });

  test("0 / negative → «—»", () => {
    expect(faRating(0)).toBe("—");
    expect(faRating(-1)).toBe("—");
  });
});
