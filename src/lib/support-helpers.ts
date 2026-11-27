import { computeTaskLoggedSeconds, type MinimalTimeLog } from "./project-helpers";

export type CanonicalPriority = "Urgent" | "High" | "Normal" | "Low";

export type SlaHealthState = "ON_TRACK" | "AT_RISK" | "BREACHED" | "MET" | "MISSED" | "NONE";

export interface SlaPolicyInput {
  priority: string;
  firstResponseMinutes: number;
  targetMinutes: number;
  reminderThresholdPercent: number;
}

export interface SlaEvaluation {
  state: SlaHealthState;
  dueAt: Date | null;
  targetMinutes: number | null;
  remainingMinutes: number | null;
  elapsedMinutes: number | null;
  percentUsed: number | null;
}

export const TICKET_STATUS_VALUES = ["Not Started", "Ongoing", "Suspended", "Done"] as const;
export const TICKET_PRIORITY_VALUES = ["Urgent", "High", "Normal", "Low"] as const;

/**
 * Normalize legacy priority casing (e.g. "URGENT" -> "Urgent") for consistent SLA policy matching.
 */
export function normalizeSupportPriority(priority?: string | null): CanonicalPriority {
  const clean = (priority || "").trim().toLowerCase();
  if (clean === "urgent") return "Urgent";
  if (clean === "high") return "High";
  if (clean === "low") return "Low";
  return "Normal";
}

/**
 * Compute sequential ticket number in `SUP-YYYY-XXXX` format given existing highest ticket number in the same year.
 */
export function formatNextTicketNumber(
  latestTicketNumber: string | null | undefined,
  year: number = new Date().getFullYear()
): string {
  const prefix = `SUP-${year}-`;
  let nextSeq = 1;

  if (latestTicketNumber && latestTicketNumber.startsWith(prefix)) {
    const suffix = latestTicketNumber.slice(prefix.length);
    const parsed = Number.parseInt(suffix, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      nextSeq = parsed + 1;
    }
  }

  const padded = String(nextSeq).padStart(4, "0");
  return `${prefix}${padded}`;
}

/**
 * Look up SLA target minutes & reminder threshold from policies for a ticket's normalized priority.
 */
export function resolveSlaPolicy(
  priority: string | null | undefined,
  policies: SlaPolicyInput[]
): SlaPolicyInput | null {
  const norm = normalizeSupportPriority(priority);
  return (
    policies.find((p) => normalizeSupportPriority(p.priority) === norm) ||
    null
  );
}

/**
 * Compute `slaDueAt` timestamp when a REQUEST ticket is created or updated with a start time & priority.
 */
export function computeSlaDueAt(
  startDate: Date,
  targetMinutes: number | null | undefined
): Date | null {
  if (!targetMinutes || !Number.isFinite(targetMinutes) || targetMinutes <= 0) {
    return null;
  }
  return new Date(startDate.getTime() + targetMinutes * 60_000);
}

/**
 * Evaluate live SLA compliance state for a ticket using its `slaDueAt`, `status`, `endDate`, and policy threshold.
 */
export function evaluateTicketSla(
  ticket: {
    ticketType?: string | null;
    status: string;
    priority: string;
    startDate: string | Date;
    endDate?: string | Date | null;
    slaDueAt?: string | Date | null;
    slaTargetMinutes?: number | null;
  },
  policies: SlaPolicyInput[],
  nowMs: number = Date.now()
): SlaEvaluation {
  const isRequest = ticket.ticketType === "REQUEST";
  if (!isRequest && !ticket.slaDueAt && !ticket.slaTargetMinutes) {
    return {
      state: "NONE",
      dueAt: null,
      targetMinutes: null,
      remainingMinutes: null,
      elapsedMinutes: null,
      percentUsed: null,
    };
  }

  const startMs = new Date(ticket.startDate).getTime();
  if (Number.isNaN(startMs)) {
    return {
      state: "NONE",
      dueAt: null,
      targetMinutes: null,
      remainingMinutes: null,
      elapsedMinutes: null,
      percentUsed: null,
    };
  }

  const policy = resolveSlaPolicy(ticket.priority, policies);
  const targetMinutes = ticket.slaTargetMinutes ?? policy?.targetMinutes ?? null;
  const dueDate = ticket.slaDueAt
    ? new Date(ticket.slaDueAt)
    : computeSlaDueAt(new Date(startMs), targetMinutes);

  if (!dueDate || Number.isNaN(dueDate.getTime())) {
    return {
      state: "NONE",
      dueAt: null,
      targetMinutes,
      remainingMinutes: null,
      elapsedMinutes: null,
      percentUsed: null,
    };
  }

  const dueMs = dueDate.getTime();
  const totalWindowMs = Math.max(60_000, dueMs - startMs);
  const thresholdPercent = policy?.reminderThresholdPercent ?? 75;

  if (ticket.status === "Done" || ticket.status === "Completed") {
    const resolvedMs = ticket.endDate ? new Date(ticket.endDate).getTime() : nowMs;
    const elapsedMinutes = Math.max(0, Math.round((resolvedMs - startMs) / 60_000));
    const remainingMinutes = Math.round((dueMs - resolvedMs) / 60_000);
    const percentUsed = Math.round(((resolvedMs - startMs) / totalWindowMs) * 100);
    return {
      state: resolvedMs <= dueMs ? "MET" : "MISSED",
      dueAt: dueDate,
      targetMinutes,
      remainingMinutes,
      elapsedMinutes,
      percentUsed,
    };
  }

  const elapsedMinutes = Math.max(0, Math.round((nowMs - startMs) / 60_000));
  const remainingMinutes = Math.round((dueMs - nowMs) / 60_000);
  const percentUsed = Math.round(((nowMs - startMs) / totalWindowMs) * 100);

  let state: SlaHealthState = "ON_TRACK";
  if (nowMs > dueMs) {
    state = "BREACHED";
  } else if (percentUsed >= thresholdPercent) {
    state = "AT_RISK";
  }

  return {
    state,
    dueAt: dueDate,
    targetMinutes,
    remainingMinutes,
    elapsedMinutes,
    percentUsed,
  };
}

/**
 * Strip HTML tags & common entities from rich text `issue`/`solution` strings for readable table/card previews.
 */
export function stripRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>?/gm, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Format signed remaining or overdue minutes into concise human duration text (e.g. "2h 15m" or "45m").
 */
export function formatCompactMinutes(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs}m`;
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins = abs % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Escape a single CSV cell safely, mitigating formula injection (`=`, `+`, `-`, `@`, tab, CR).
 */
export function formatSafeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const sanitized = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

/**
 * Compute logged seconds for a support ticket by reusing the shared time log engine.
 */
export function computeTicketLoggedSeconds(
  timeLogs: MinimalTimeLog[] | undefined,
  nowMs: number = Date.now()
): number {
  if (!timeLogs || timeLogs.length === 0) return 0;
  return computeTaskLoggedSeconds(timeLogs, nowMs);
}
