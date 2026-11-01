"use client";

// مُنت‌آموز — star rating: display mode (rounded fill) + interactive input mode.

import { useState } from "react";
import { Star } from "lucide-react";
import { toFaDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-7",
} as const;

interface RatingStarsProps {
  /** 0..5 */
  value: number;
  size?: keyof typeof SIZES;
  /** Presence of onChange switches to input mode. */
  onChange?: (value: number) => void;
  className?: string;
}

export function RatingStars({ value, size = "sm", onChange, className }: RatingStarsProps) {
  const [hover, setHover] = useState<number | null>(null);

  if (!onChange) {
    // display mode — half stars approximated by rounding
    const filled = Math.round(value);
    return (
      <span
        className={cn("inline-flex items-center gap-0.5", className)}
        role="img"
        aria-label={`امتیاز ${toFaDigits(value.toFixed(1))} از ۵`}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            aria-hidden="true"
            className={cn(
              SIZES[size],
              i <= filled ? "fill-gold text-gold" : "fill-gray-200 text-gray-300"
            )}
          />
        ))}
      </span>
    );
  }

  const active = hover ?? value;
  return (
    <div className={cn("inline-flex items-center gap-1", className)} role="radiogroup" aria-label="انتخاب امتیاز">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${toFaDigits(i)} ستاره`}
          className="rounded-none transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
          onClick={() => onChange(i)}
        >
          <Star
            aria-hidden="true"
            className={cn(
              SIZES[size],
              i <= active ? "fill-gold text-gold" : "fill-gray-100 text-gray-300"
            )}
          />
        </button>
      ))}
    </div>
  );
}
