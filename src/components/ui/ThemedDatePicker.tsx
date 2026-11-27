"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";

interface ThemedDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  locale: "en" | "id";
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
  menuAlign?: "left" | "right";
}

interface MenuPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

function safeParse(val: string): Date | null {
  if (!val) return null;
  const parsed = parseISO(val);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Shared Portal-based Date Picker matching Royal Medica Light Clean & Soft Charcoal Dark tokens.
 * Automatically clamps within mobile/tablet viewports and flips upward when near bottom edge.
 */
export function ThemedDatePicker({
  value,
  onChange,
  locale,
  placeholder,
  allowClear = false,
  className = "",
  menuAlign = "left",
}: ThemedDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = safeParse(value);
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(selected || new Date()));

  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popoverW = Math.min(278, window.innerWidth - 16);
    const estimatedHeight = menuRef.current?.offsetHeight || 298;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove >= spaceBelow;

    // On narrow viewports, ensure horizontal clamp never goes negative (< 8px) or clips right edge
    let left: number;
    if (menuAlign === "right") {
      left = Math.max(8, Math.min(rect.right - popoverW, window.innerWidth - popoverW - 8));
    } else {
      left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverW - 8));
    }

    if (openUpward) {
      const bottom = Math.max(
        8,
        Math.min(window.innerHeight - rect.top + 6, window.innerHeight - estimatedHeight - 8)
      );
      setMenuPos({ bottom, left });
    } else {
      const top = Math.max(
        8,
        Math.min(rect.bottom + 6, window.innerHeight - estimatedHeight - 8)
      );
      setMenuPos({ top, left });
    }
  }, [menuAlign]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  const dfLocale = locale === "id" ? idLocale : enUS;
  const weekDays =
    locale === "id"
      ? ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const days = useMemo(() => {
    const s = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
    const e = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: s, end: e });
  }, [viewMonth]);

  const label = selected
    ? format(selected, "dd MMM yyyy", { locale: dfLocale })
    : placeholder || (locale === "id" ? "Pilih tanggal" : "Pick date");

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (!isOpen && selected) setViewMonth(startOfMonth(selected));
          setIsOpen((p) => !p);
        }}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-canvas)] border px-3 py-2 font-mono-code text-xs tnum transition-colors cursor-pointer ${
          isOpen
            ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/15"
            : "border-[var(--border-subtle)] hover:border-[var(--brand-stroke)]"
        } ${selected ? "text-[var(--text-ink)] font-medium" : "text-[var(--text-muted)]"}`}
      >
        <span className="truncate">{label}</span>
        <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuPos.top,
              bottom: menuPos.bottom,
              left: menuPos.left,
              width: 278,
            }}
            className="z-[90] max-w-[calc(100vw-1rem)] bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/50 p-3 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((p) => subMonths(p, 1))}
                className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] hover:text-[var(--text-ink)] cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-heading font-bold text-xs text-[var(--text-ink)]">
                {format(viewMonth, "MMMM yyyy", { locale: dfLocale })}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth((p) => addMonths(p, 1))}
                className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] hover:text-[var(--text-ink)] cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center font-mono-code text-[10px] font-bold text-[var(--text-muted)]">
              {weekDays.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const inMonth = isSameMonth(d, viewMonth);
                const isSelected = Boolean(selected && isSameDay(d, selected));
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => {
                      onChange(format(d, "yyyy-MM-dd"));
                      setIsOpen(false);
                    }}
                    className={`h-7 rounded-lg font-mono-code text-[11px] tnum transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[var(--brand)] text-white dark:text-[#161A26] font-bold"
                        : inMonth
                          ? "text-[var(--text-ink)] hover:bg-[var(--bg-subtle)]"
                          : "text-[var(--text-muted)]/50 hover:bg-[var(--bg-subtle)]/50"
                    }`}
                  >
                    {format(d, "d")}
                  </button>
                );
              })}
            </div>

            {allowClear && selected && (
              <div className="pt-1.5 border-t border-[var(--border-subtle)] flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                  className="font-mono-code text-[10px] font-bold text-[var(--err)] hover:underline cursor-pointer"
                >
                  {locale === "id" ? "Hapus tanggal" : "Clear date"}
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
