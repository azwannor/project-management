"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";

interface ThemedDateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  locale: "en" | "id";
  anchorDate?: Date;
  className?: string;
  fullWidth?: boolean;
  menuAlign?: "left" | "right";
}

function safeParse(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parsed = parseISO(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Built-in themed Calendar Range Picker (Light & Soft Charcoal Dark) without external CSS or browser inputs.
 */
export function ThemedDateRangePicker({
  startDate,
  endDate,
  onChange,
  locale,
  anchorDate,
  className = "",
  fullWidth = false,
  menuAlign = "left",
}: ThemedDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refNow = useMemo(() => anchorDate || new Date(), [anchorDate]);
  const parsedStart = safeParse(startDate);
  const parsedEnd = safeParse(endDate);

  const [viewMonth, setViewMonth] = useState<Date>(() =>
    startOfMonth(parsedStart || parsedEnd || refNow)
  );

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const dfLocale = locale === "id" ? idLocale : enUS;
  const weekDays =
    locale === "id"
      ? ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const handleDayClick = (day: Date) => {
    const iso = format(day, "yyyy-MM-dd");
    // Start a fresh selection if none or a complete range already exists
    if (!parsedStart || (parsedStart && parsedEnd)) {
      onChange(iso, "");
      return;
    }
    // Complete range in chronological order
    if (day < parsedStart) {
      onChange(iso, format(parsedStart, "yyyy-MM-dd"));
    } else {
      onChange(format(parsedStart, "yyyy-MM-dd"), iso);
    }
    setIsOpen(false);
  };

  const applyPreset = (s: Date, e: Date) => {
    onChange(format(s, "yyyy-MM-dd"), format(e, "yyyy-MM-dd"));
    setViewMonth(startOfMonth(s));
    setIsOpen(false);
  };

  const displayLabel = useMemo(() => {
    if (parsedStart && parsedEnd) {
      return `${format(parsedStart, "dd MMM", { locale: dfLocale })} – ${format(
        parsedEnd,
        "dd MMM yyyy",
        { locale: dfLocale }
      )}`;
    }
    if (parsedStart) {
      return `${format(parsedStart, "dd MMM yyyy", { locale: dfLocale })} → ...`;
    }
    return locale === "id" ? "Pilih Rentang" : "Select Dates";
  }, [parsedStart, parsedEnd, dfLocale, locale]);

  const effectiveEnd = parsedEnd || hoverDate;
  const rangeStart =
    parsedStart && effectiveEnd && effectiveEnd < parsedStart ? effectiveEnd : parsedStart;
  const rangeEnd =
    parsedStart && effectiveEnd && effectiveEnd < parsedStart ? parsedStart : effectiveEnd;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={locale === "id" ? "Pilih rentang tanggal" : "Pick custom date range"}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 rounded-full bg-[var(--bg-surface)] border px-3 py-1.5 font-mono-code text-[11px] font-semibold text-[var(--text-ink)] tnum transition-colors cursor-pointer ${
          fullWidth ? "w-full justify-between" : ""
        } ${
          isOpen
            ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/15"
            : "border-[var(--border-subtle)] hover:border-[var(--brand-stroke)]"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          <Calendar className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
          <span className="truncate">{displayLabel}</span>
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 mt-2 w-[304px] sm:w-[324px] max-w-[calc(100vw-2rem)] bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/50 p-3.5 space-y-3 ${
            menuAlign === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset(subDays(refNow, 6), refNow)}
              className="font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--bg-subtle)] hover:bg-[var(--brand-tint)] text-[var(--text-ink2)] hover:text-[var(--brand)] transition-colors cursor-pointer"
            >
              7D
            </button>
            <button
              type="button"
              onClick={() => applyPreset(subDays(refNow, 29), refNow)}
              className="font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--bg-subtle)] hover:bg-[var(--brand-tint)] text-[var(--text-ink2)] hover:text-[var(--brand)] transition-colors cursor-pointer"
            >
              30D
            </button>
            <button
              type="button"
              onClick={() => applyPreset(startOfMonth(refNow), endOfMonth(refNow))}
              className="font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--bg-subtle)] hover:bg-[var(--brand-tint)] text-[var(--text-ink2)] hover:text-[var(--brand)] transition-colors cursor-pointer"
            >
              {locale === "id" ? "Bulan Ini" : "This Month"}
            </button>
            <button
              type="button"
              onClick={() => applyPreset(startOfQuarter(refNow), endOfQuarter(refNow))}
              className="font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--bg-subtle)] hover:bg-[var(--brand-tint)] text-[var(--text-ink2)] hover:text-[var(--brand)] transition-colors cursor-pointer"
            >
              {`Q${Math.floor(refNow.getMonth() / 3) + 1}`}
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setViewMonth((prev) => subMonths(prev, 1))}
              className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] hover:border-[var(--brand-stroke)] hover:text-[var(--text-ink)] cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-heading font-bold text-xs text-[var(--text-ink)]">
              {format(viewMonth, "MMMM yyyy", { locale: dfLocale })}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setViewMonth((prev) => addMonths(prev, 1))}
              className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] hover:border-[var(--brand-stroke)] hover:text-[var(--text-ink)] cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono-code text-[10px] font-bold text-[var(--text-muted)]">
            {weekDays.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const inMonth = isSameMonth(day, viewMonth);
              const isStart = Boolean(rangeStart && isSameDay(day, rangeStart));
              const isEnd = Boolean(rangeEnd && isSameDay(day, rangeEnd));
              const inSpan = Boolean(
                rangeStart &&
                  rangeEnd &&
                  isWithinInterval(day, { start: rangeStart, end: rangeEnd })
              );
              const isToday = isSameDay(day, refNow);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onMouseEnter={() => {
                    if (parsedStart && !parsedEnd) setHoverDate(day);
                  }}
                  onClick={() => handleDayClick(day)}
                  className={`h-8 rounded-lg font-mono-code text-[11px] tnum transition-colors cursor-pointer flex items-center justify-center relative ${
                    isStart || isEnd
                      ? "bg-[var(--brand)] text-white dark:text-[#161A26] font-bold"
                      : inSpan
                      ? "bg-[var(--brand-tint)] text-[var(--brand)] font-semibold"
                      : inMonth
                      ? "text-[var(--text-ink)] hover:bg-[var(--bg-subtle)]"
                      : "text-[var(--text-muted)]/50 hover:bg-[var(--bg-subtle)]/50"
                  }`}
                >
                  {format(day, "d")}
                  {isToday && !isStart && !isEnd && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--brand)]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Hint & Close */}
          <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10.5px]">
            <span className="text-[var(--text-muted)]">
              {parsedStart && !parsedEnd
                ? locale === "id"
                  ? "Klik tanggal akhir..."
                  : "Pick end date..."
                : locale === "id"
                ? "Rentang aktif"
                : "Range active"}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="font-semibold text-[var(--brand)] hover:underline cursor-pointer"
            >
              {locale === "id" ? "Tutup" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
