"use client";

import { useSyncExternalStore } from "react";

const CHANGE_EVENT = "it-tracker-ui-pref-change";

export function setUiPref(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

/**
 * Subscribe cleanly to a localStorage preference without SSR hydration mismatches
 * or synchronous setState inside effects.
 */
export function useUiPref(key: string, fallback: string): [string, (next: string) => void] {
  const value = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const handleStorage = (e: StorageEvent) => {
        if (!e.key || e.key === key) onStoreChange();
      };
      const handleCustom = (e: Event) => {
        const detail = (e as CustomEvent<{ key?: string }>).detail;
        if (!detail?.key || detail.key === key) onStoreChange();
      };
      window.addEventListener("storage", handleStorage);
      window.addEventListener(CHANGE_EVENT, handleCustom);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(CHANGE_EVENT, handleCustom);
      };
    },
    () => {
      if (typeof window === "undefined") return fallback;
      try {
        return window.localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback
  );

  return [value, (next: string) => setUiPref(key, next)];
}
