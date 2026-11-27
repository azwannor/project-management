import { evaluateTicketSla, type SlaPolicyInput } from "./support-helpers";

export type CronDueState = "APPROACHING" | "OVERDUE";

export const DEFAULT_TASK_APPROACHING_HOURS = 24;

function isClosedStatus(status: string | null | undefined): boolean {
  const norm = (status || "").trim().toLowerCase();
  return norm === "done" || norm === "completed" || norm === "suspended";
}

/**
 * Classify an active project task as approaching overdue (<= 24h) or overdue (< now).
 */
export function classifyTaskDueState(
  task: { status: string; endDate: Date | string },
  nowMs: number = Date.now(),
  approachingWindowHours: number = DEFAULT_TASK_APPROACHING_HOURS
): CronDueState | null {
  if (isClosedStatus(task.status)) {
    return null;
  }
  const endMs = new Date(task.endDate).getTime();
  if (Number.isNaN(endMs)) return null;

  if (endMs < nowMs) {
    return "OVERDUE";
  }
  const windowMs = approachingWindowHours * 60 * 60 * 1000;
  if (endMs <= nowMs + windowMs) {
    return "APPROACHING";
  }
  return null;
}

/**
 * Classify an active support REQUEST ticket as approaching SLA overdue (AT_RISK) or overdue (BREACHED).
 * Skips DAILY_ACTIVITY logs, Done/Completed/Suspended tickets, and ON_TRACK tickets.
 */
export function classifySupportTicketDueState(
  ticket: {
    ticketType?: string | null;
    status: string;
    priority: string;
    startDate: Date | string;
    endDate?: Date | string | null;
    slaDueAt?: Date | string | null;
    slaTargetMinutes?: number | null;
  },
  policies: SlaPolicyInput[],
  nowMs: number = Date.now()
): CronDueState | null {
  if (ticket.ticketType !== "REQUEST") {
    return null;
  }
  if (isClosedStatus(ticket.status)) {
    return null;
  }

  const sla = evaluateTicketSla(ticket, policies, nowMs);
  if (sla.state === "BREACHED") {
    return "OVERDUE";
  }
  if (sla.state === "AT_RISK") {
    return "APPROACHING";
  }
  if (sla.state === "NONE") {
    const startMs = new Date(ticket.startDate).getTime();
    if (!Number.isNaN(startMs) && startMs < nowMs - 2 * 60 * 60 * 1000) {
      return "OVERDUE";
    }
  }
  return null;
}
