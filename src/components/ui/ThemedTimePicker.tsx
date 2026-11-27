"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Clock } from "lucide-react";

interface ThemedTimePickerProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  locale?: "en" | "id";
  minuteStep?: 1 | 5 | 15;
  className?: string;
  menuAlign?: "left" | "right";
  ariaLabel?: string;
}

interface MenuPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

function normalizeTimeParts(value: string): { hour: string; minute: string } {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec((value || "").trim());
  if (!match) return { hour: "09", minute: "00" };
  const h = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
  const m = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)));
  return {
    hour: String(h).padStart(2, "0"),
    minute: String(m).padStart(2, "0"),
  };
}

const HOURS = Array.from({ length: 24 }, (_, idx) => String(idx).padStart(2, "0"));
const QUICK_PRESETS = ["08:00", "09:00", "12:00", "14:00", "17:00"];

/**
 * Shared Portal-based Time Picker styled consistently with Royal Medica's Light Clean & Soft Charcoal Dark tokens.
 * Replaces native browser `<input type="time">` popups across drawers, modals, and forms.
 */
export function ThemedTimePicker({
  value,
  onChange,
  locale = "en",
  minuteStep = 1,
  className = "",
  menuAlign = "right",
  ariaLabel,
}: ThemedTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  const { hour: selectedHour, minute: selectedMinute } = normalizeTimeParts(value);
  const formattedValue = `${selectedHour}:${selectedMinute}`;

  const minutesList = useMemo(() => {
    const items: string[] = [];
    for (let m = 0; m < 60; m += minuteStep) {
      items.push(String(m).padStart(2, "0"));
    }
    if (!items.includes(selectedMinute)) {
      items.push(selectedMinute);
      items.sort();
    }
    return items;
  }, [minuteStep, selectedMinute]);

  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popoverW = 248;
    const estimatedHeight = menuRef.current?.offsetHeight || 352;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove >= spaceBelow;

    const horizontal =
      menuAlign === "right"
        ? {
            right: Math.max(
              8,
              Math.min(window.innerWidth - rect.right, window.innerWidth - popoverW - 8)
            ),
          }
        : {
            left: Math.max(8, Math.min(rect.left, window.innerWidth - popoverW - 8)),
          };

    if (openUpward) {
      const bottom = Math.max(
        8,
        Math.min(window.innerHeight - rect.top + 6, window.innerHeight - estimatedHeight - 8)
      );
      setMenuPos({ bottom, ...horizontal });
    } else {
      const top = Math.max(
        8,
        Math.min(rect.bottom + 6, window.innerHeight - estimatedHeight - 8)
      );
      setMenuPos({ top, ...horizontal });
    }
  }, [menuAlign]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    // Center currently active hour & minute inside the scrollable wheels
    const raf = requestAnimationFrame(() => {
      const hBtn = hourListRef.current?.querySelector<HTMLElement>("[data-selected='true']");
      if (hBtn) hBtn.scrollIntoView({ block: "center" });
      const mBtn = minuteListRef.current?.querySelector<HTMLElement>("[data-selected='true']");
      if (mBtn) mBtn.scrollIntoView({ block: "center" });
    });

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
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  const handleSetNow = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    onChange(`${hh}:${mm}`);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel || (locale === "id" ? "Pilih waktu" : "Pick time")}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-canvas)] border px-3 py-2 font-mono-code text-xs tnum text-[var(--text-ink)] font-medium transition-colors cursor-pointer ${
          isOpen
            ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/15"
            : "border-[var(--border-subtle)] hover:border-[var(--brand-stroke)]"
        }`}
      >
        <span>{formattedValue}</span>
        <Clock className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
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
              right: menuPos.right,
              width: 248,
            }}
            className="z-[90] max-w-[calc(100vw-1rem)] bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/50 p-3 space-y-2.5"
          >
            {/* Header + Current Readout + Now shortcut */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {locale === "id" ? "WAKTU" : "TIME"}
                </span>
                <span className="font-mono-code text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] tnum">
                  {formattedValue}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSetNow}
                className="font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-[var(--brand)] cursor-pointer transition-colors"
              >
                {locale === "id" ? "Sekarang" : "Now"}
              </button>
            </div>

            {/* Workday Quick Presets */}
            <div className="flex flex-wrap gap-1">
              {QUICK_PRESETS.map((preset) => {
                const active = formattedValue === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      onChange(preset);
                      setIsOpen(false);
                    }}
                    className={`font-mono-code text-[10px] font-semibold px-2 py-0.5 rounded-full border tnum transition-colors cursor-pointer ${
                      active
                        ? "bg-[var(--brand)] text-white dark:text-[#161A26] border-transparent"
                        : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-ink2)] hover:border-[var(--brand-stroke)] hover:text-[var(--text-ink)]"
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            {/* Dual Scroll Columns: Hour | Minute */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="font-mono-code text-[9.5px] font-bold uppercase tracking-wider text-center text-[var(--text-muted)] mb-1">
                  {locale === "id" ? "Jam" : "Hour"}
                </p>
                <div
                  ref={hourListRef}
                  className="h-40 overflow-y-auto rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] p-1 space-y-0.5"
                >
                  {HOURS.map((hr) => {
                    const active = hr === selectedHour;
                    return (
                      <button
                        key={hr}
                        type="button"
                        data-selected={active ? "true" : "false"}
                        onClick={() => onChange(`${hr}:${selectedMinute}`)}
                        className={`w-full py-1.5 rounded-lg font-mono-code text-xs tnum transition-colors cursor-pointer ${
                          active
                            ? "bg-[var(--brand)] text-white dark:text-[#161A26] font-bold shadow-2xs"
                            : "text-[var(--text-ink2)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-ink)] font-medium"
                        }`}
                      >
                        {hr}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="font-mono-code text-[9.5px] font-bold uppercase tracking-wider text-center text-[var(--text-muted)] mb-1">
                  {locale === "id" ? "Menit" : "Min"}
                </p>
                <div
                  ref={minuteListRef}
                  className="h-40 overflow-y-auto rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] p-1 space-y-0.5"
                >
                  {minutesList.map((min) => {
                    const active = min === selectedMinute;
                    return (
                      <button
                        key={min}
                        type="button"
                        data-selected={active ? "true" : "false"}
                        onClick={() => onChange(`${selectedHour}:${min}`)}
                        className={`w-full py-1.5 rounded-lg font-mono-code text-xs tnum transition-colors cursor-pointer ${
                          active
                            ? "bg-[var(--brand)] text-white dark:text-[#161A26] font-bold shadow-2xs"
                            : "text-[var(--text-ink2)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-ink)] font-medium"
                        }`}
                      >
                        {min}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-1 border-t border-[var(--border-subtle)] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-[11px] font-semibold cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>{locale === "id" ? "Selesai" : "Done"}</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
