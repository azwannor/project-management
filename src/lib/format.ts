/**
 * Format duration in seconds into `HHh MMm` for tabular KPI & time tracker UI.
 */
export function formatDurationCompact(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "00h 00m";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${String(hrs).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
}

/**
 * Format duration in seconds into `HH:MM:SS` for live running timers.
 */
export function formatLiveHms(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "00:00:00";
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Format a date consistently using `dd MMM yyyy` display style.
 */
export function formatShortDate(value?: string | Date | null, locale: "en" | "id" = "en"): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(locale === "id" ? "id-ID" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
