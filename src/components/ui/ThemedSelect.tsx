"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface ThemedSelectOption {
  value: string;
  label: string;
  badge?: string;
}

interface ThemedSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ThemedSelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  menuAlign?: "left" | "right";
}

interface MenuPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  minWidth: number;
}

/**
 * Architectural theme-native dropdown selector supporting Light Clean and Soft Charcoal Dark modes.
 * Uses a portal so menus never clip inside tables, overflow containers, or side drawers.
 */
export function ThemedSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  icon,
  ariaLabel,
  className = "",
  menuAlign = "left",
}: ThemedSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const updatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estimatedHeight = Math.min(272, Math.max(88, options.length * 36 + 16));
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
    const minWidth = Math.max(200, Math.round(rect.width));

    if (menuAlign === "right") {
      const right = Math.max(8, window.innerWidth - rect.right);
      setMenuPos(
        openUpward
          ? { bottom: window.innerHeight - rect.top + 6, right, minWidth }
          : { top: rect.bottom + 6, right, minWidth }
      );
    } else {
      const clampedLeft = Math.max(8, Math.min(rect.left, window.innerWidth - minWidth - 8));
      setMenuPos(
        openUpward
          ? { bottom: window.innerHeight - rect.top + 6, left: clampedLeft, minWidth }
          : { top: rect.bottom + 6, left: clampedLeft, minWidth }
      );
    }
  }, [menuAlign, options.length]);

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

    function handleViewportChange() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, updatePosition]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
      } else {
        setActiveIndex((prev) => (prev + 1) % Math.max(1, options.length));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(Math.max(0, options.findIndex((o) => o.value === value)));
      } else {
        setActiveIndex((prev) => (prev - 1 + options.length) % Math.max(1, options.length));
      }
    } else if (e.key === "Enter" && isOpen && activeIndex >= 0 && options[activeIndex]) {
      e.preventDefault();
      onChange(options[activeIndex].value);
      setIsOpen(false);
    }
  };

  const listboxEl =
    isOpen && menuPos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: "fixed",
              top: menuPos.top,
              bottom: menuPos.bottom,
              left: menuPos.left,
              right: menuPos.right,
              minWidth: menuPos.minWidth,
            }}
            className="z-[10050] w-max max-w-[calc(100vw-16px)] bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/45 p-1.5 max-h-64 overflow-y-auto"
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === activeIndex;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[var(--brand-tint)] text-[var(--brand)] font-semibold"
                      : isHighlighted
                      ? "bg-[var(--bg-subtle)] text-[var(--text-ink)]"
                      : "text-[var(--text-ink2)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{opt.label}</span>
                    {opt.badge && (
                      <span className="font-mono-code text-[9.5px] px-1.5 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)] shrink-0">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setActiveIndex(options.findIndex((o) => o.value === value));
        }}
        className={`w-full flex items-center justify-between gap-2 rounded-full bg-[var(--bg-surface)] border px-3 py-1.5 text-xs font-medium text-[var(--text-ink)] transition-colors cursor-pointer ${
          isOpen
            ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/15"
            : "border-[var(--border-subtle)] hover:border-[var(--brand-stroke)]"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {icon && <span className="text-[var(--text-muted)] shrink-0">{icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-[var(--brand)]" : ""
          }`}
        />
      </button>

      {listboxEl}
    </div>
  );
}
