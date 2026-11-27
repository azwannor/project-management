import { computeTaskLoggedSeconds, type MinimalTimeLog } from "@/lib/project-helpers";

export interface UserRecord {
  id: string;
  name: string;
  role: string;
  jobDesk?: string | null;
  photo?: string | null;
}

export interface ProjectMemberRecord {
  projectId: string;
  userId: string;
  user?: UserRecord;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description?: string | null;
  objective?: string | null;
  members?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  actualEndDate?: string | Date | null;
  status: string;
  projectMembers?: ProjectMemberRecord[];
  tasks?: Array<{ id: string; status: string; parentId?: string | null }>;
}

export interface TimeLogRecord extends MinimalTimeLog {
  id: string;
  taskId?: string | null;
  supportTicketId?: string | null;
  userId: string;
  source: "AUTO" | "MANUAL" | "ADJUSTED";
  note?: string | null;
  user?: { id: string; name: string; photo?: string | null };
}

export interface TaskExecutorRecord {
  taskId: string;
  userId: string;
  user?: UserRecord;
}

export interface TaskRecord {
  id: string;
  parentId?: string | null;
  projectId?: string | null;
  userId: string;
  title: string;
  startDate: string | Date;
  endDate: string | Date;
  startedAt?: string | Date | null;
  actualEndDate?: string | Date | null;
  priority: string;
  issue?: string | null;
  solution?: string | null;
  documentation?: string | null;
  executor?: string | null;
  status: string;
  attachment?: string | null;
  attachmentKey?: string | null;
  sortOrder?: number;
  project?: { id: string; name: string; status?: string } | null;
  user?: { id: string; name: string; photo?: string | null } | null;
  executors?: TaskExecutorRecord[];
  timeLogs?: TimeLogRecord[];
  comments?: Array<{ id: string; createdAt: string | Date }>;
  commentReadStatuses?: Array<{ lastReadAt: string | Date }>;
}

export const TASK_STATUSES = ["Not Started", "Ongoing", "Suspended", "Completed"] as const;
export const TASK_PRIORITIES = ["Urgent", "High", "Normal", "Low"] as const;
export const PROJECT_STATUSES = ["Not Started", "Ongoing", "On Hold", "Completed"] as const;

export function getStatusPillClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s === "completed" || s === "done") {
    return "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]";
  }
  if (s === "ongoing") {
    return "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]";
  }
  if (s === "suspended" || s === "on hold") {
    return "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]";
  }
  return "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-ink2)]";
}

export function getPriorityPillClass(priority: string): string {
  const p = priority.trim().toLowerCase();
  if (p === "urgent" || p === "butuh cepat") {
    return "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]";
  }
  if (p === "high") {
    return "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]";
  }
  if (p === "normal") {
    return "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]";
  }
  return "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]";
}

export function hasUnreadTaskComments(task: TaskRecord): boolean {
  const latest = task.comments?.[0];
  if (!latest) return false;
  const read = task.commentReadStatuses?.[0];
  if (!read) return true;
  return new Date(latest.createdAt).getTime() > new Date(read.lastReadAt).getTime();
}

export function getTaskExecutorIds(task: TaskRecord, allUsers: UserRecord[]): string[] {
  if (task.executors && task.executors.length > 0) {
    return task.executors.map((e) => e.userId);
  }
  if (!task.executor) return [];
  const names = task.executor
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allUsers.filter((u) => names.includes(u.name.toLowerCase())).map((u) => u.id);
}

export function getTaskExecutorNames(task: TaskRecord): string[] {
  if (task.executors && task.executors.length > 0) {
    return task.executors.map((e) => e.user?.name).filter((n): n is string => Boolean(n));
  }
  if (!task.executor) return [];
  return task.executor
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getActiveOpenTimeLog(task: TaskRecord): TimeLogRecord | null {
  return task.timeLogs?.find((tl) => !tl.endTime) || null;
}

export function getTotalTaskSeconds(task: TaskRecord, nowMs: number): number {
  return computeTaskLoggedSeconds(task.timeLogs || [], nowMs);
}
