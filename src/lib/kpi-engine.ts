import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";

export type DashboardPeriod =
  | "THIS_MONTH"
  | "THIS_QUARTER"
  | "THIS_YEAR"
  | "ALL_TIME"
  | "CUSTOM";

export type ProjectHealth = "ON_TRACK" | "AT_RISK" | "DELAYED" | "COMPLETED";

export interface RawUser {
  id: string;
  name: string;
  role: string;
  jobDesk?: string | null;
  photo?: string | null;
  isActive?: boolean | null;
  canManageMaintenance?: boolean | null;
}

export interface RawProjectMember {
  userId: string;
}

export interface RawProject {
  id: string;
  name: string;
  description?: string | null;
  objective?: string | null;
  members?: string | null;
  status: string;
  startDate: string | Date;
  endDate: string | Date;
  actualEndDate?: string | Date | null;
  createdAt: string | Date;
  projectMembers?: RawProjectMember[];
}

export interface RawTask {
  id: string;
  projectId: string | null;
  parentId?: string | null;
  title: string;
  issue?: string | null;
  executor?: string | null;
  userId?: string | null;
  status: string;
  priority: string;
  startDate: string | Date;
  endDate: string | Date;
  actualEndDate?: string | Date | null;
  totalLoggedMinutes?: number | null;
  createdAt: string | Date;
  updatedAt?: string | Date | null;
  project?: { id: string; name: string } | null;
  taskExecutors?: Array<{ userId: string; user?: { id: string; name: string } | null }>;
}

export interface RawSupportTicket {
  id: string;
  ticketNumber?: string | null;
  userId: string;
  taskName?: string | null;
  issue?: string | null;
  supportType?: string | null;
  module?: string | null;
  priority: string;
  status: string;
  ticketType: string;
  startDate: string | Date;
  endDate?: string | Date | null;
  slaTargetMinutes?: number | null;
  slaDueAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt?: string | Date | null;
  user?: { id: string; name: string } | null;
  executors?: Array<{ id: string; name: string }>;
  supportModule?: { id: string; name: string } | null;
}

export interface RawTimeLog {
  id: string;
  userId: string;
  taskId?: string | null;
  supportTicketId?: string | null;
  startTime: string | Date;
  endTime?: string | Date | null;
  duration?: number | null;
  durationMinutes?: number | null;
  durationSeconds?: number | null;
}

export interface RawAsset {
  id: string;
  assetCode: string;
  assetName: string;
  status: string;
  location?: string | null;
  warrantyEndDate?: string | Date | null;
  qrPrintedAt?: string | Date | null;
  division?: { id: string; name: string } | null;
  locationRef?: { id: string; name: string } | null;
}

export interface RawMaintenanceSchedule {
  id: string;
  assetId: string;
  status: string;
  nextDueDate: string | Date;
  lastCompleted?: string | Date | null;
  scheduleType?: string | null;
  asset?: {
    id?: string;
    assetCode: string;
    assetName: string;
    location?: string | null;
    division?: { id: string; name: string } | null;
  } | null;
  template?: { templateName: string } | null;
  assignedExecutors?: Array<{ id: string; name: string }>;
}

export interface RawMaintenanceLog {
  id: string;
  assetId?: string;
  scheduleId?: string | null;
  executedById: string;
  executionDate: string | Date;
  overallCondition: string;
  findings?: string | null;
}

export interface DashboardDataset {
  users: RawUser[];
  projects: RawProject[];
  tasks: RawTask[];
  supportTickets: RawSupportTicket[];
  timeLogs: RawTimeLog[];
  assets: RawAsset[];
  maintenanceSchedules: RawMaintenanceSchedule[];
  maintenanceLogs: RawMaintenanceLog[];
}

export interface PeriodWindow {
  period: DashboardPeriod;
  start: Date | null;
  end: Date | null;
  prevStart: Date | null;
  prevEnd: Date | null;
  hasComparison: boolean;
}

export interface ExecutiveKpiResult {
  projectOnTimeRate: number;
  projectOnTimeDelta: number | null;
  projectCompletedCount: number;
  projectOnTimeCount: number;
  atRiskProjects: number;
  delayedProjects: number;

  supportSlaRate: number;
  supportSlaDelta: number | null;
  supportResolvedCount: number;
  supportSlaMetCount: number;
  mttrMinutes: number;
  openRequestsCount: number;
  breachedOpenRequestsCount: number;

  maintenanceComplianceRate: number;
  maintenanceDelta: number | null;
  overdueSchedulesCount: number;
  dueSoonSchedulesCount: number;
  assetHealthRate: number;
  activeAssetsCount: number;
  totalAssetsCount: number;
  inRepairAssetsCount: number;
  qrStickeredCount: number;
  healthyAssetRate: number;

  activeWorkloadTotal: number;
  openTasksCount: number;
  avgWorkloadPerMember: number;
  activeTeamCount: number;
  workloadDelta: number | null;
}

export interface RoadmapMainTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  startDate: string;
  endDate: string;
  actualEndDate: string | null;
  pics: string[];
  subTaskTotal: number;
  subTaskDone: number;
  isOverdue: boolean;
}

export interface RoadmapProjectItem {
  id: string;
  name: string;
  status: string;
  health: ProjectHealth;
  startDate: string;
  endDate: string;
  actualEndDate: string | null;
  progressPct: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  memberNames: string[];
  mainTasks: RoadmapMainTask[];
}

export interface ProjectRoadmapResult {
  windowStartMs: number;
  windowEndMs: number;
  todayPct: number;
  projects: RoadmapProjectItem[];
}

export interface TeamWorkItem {
  id: string;
  kind: "TASK" | "TICKET";
  title: string;
  contextName: string;
  status: string;
  priority: string;
  startDate: string;
  endDate: string;
  isOverdue: boolean;
}

export interface TeamMemberRow {
  userId: string;
  name: string;
  role: string;
  jobDesk: string;
  tasksDone: number;
  activeTasks: number;
  ticketsResolved: number;
  dailyLogsCount: number;
  avgMttrMinutes: number;
  maintenanceCompleted: number;
  loggedSeconds: number;
  workItems: TeamWorkItem[];
}

export interface EffortSegment {
  key: "PROJECT" | "SUPPORT" | "MAINTENANCE";
  seconds: number;
  operations: number;
  pct: number;
}

export interface EffortSplitResult {
  mode: "HOURS" | "OPERATIONS";
  totalSeconds: number;
  totalOperations: number;
  segments: EffortSegment[];
}

export interface BlockerItem {
  id: string;
  kind: "PROJECT" | "TASK" | "TICKET" | "MAINTENANCE";
  severity: "CRITICAL" | "HIGH" | "WARN";
  code: string;
  title: string;
  owner: string;
  detail: string;
  daysOverdue: number;
  href: string;
}

export interface SupportVolumePoint {
  category: string;
  requestCount: number;
  dailyCount: number;
  total: number;
}

export interface ActionQueueItem {
  id: string;
  kind: "TASK" | "TICKET" | "MAINTENANCE";
  code: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  isOverdue: boolean;
  href: string;
}

export function normalizeStatus(status?: string | null): string {
  return (status || "").trim().toUpperCase().replace(/\s+/g, "_");
}

export function isDoneStatus(status?: string | null): boolean {
  const s = normalizeStatus(status);
  return s === "DONE" || s === "COMPLETED";
}

export function isOngoingStatus(status?: string | null): boolean {
  return normalizeStatus(status) === "ONGOING";
}

export function isSuspendedStatus(status?: string | null): boolean {
  const s = normalizeStatus(status);
  return s === "SUSPENDED" || s === "ON_HOLD";
}

export function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getSlaTargetMinutes(priority?: string | null, explicit?: number | null): number {
  if (explicit && explicit > 0) return explicit;
  const p = (priority || "").trim().toUpperCase();
  if (p === "URGENT" || p === "BUTUH CEPAT") return 120;
  if (p === "HIGH") return 240;
  if (p === "LOW") return 2880;
  return 1440;
}

export function getPeriodWindow(
  period: DashboardPeriod,
  customStart?: string | null,
  customEnd?: string | null,
  now: Date = new Date()
): PeriodWindow {
  if (period === "ALL_TIME") {
    return { period, start: null, end: null, prevStart: null, prevEnd: null, hasComparison: false };
  }

  if (period === "THIS_MONTH") {
    const start = startOfMonth(now);
    const end = endOfDay(now);
    const prev = subMonths(now, 1);
    return {
      period,
      start,
      end,
      prevStart: startOfMonth(prev),
      prevEnd: endOfMonth(prev),
      hasComparison: true,
    };
  }

  if (period === "THIS_QUARTER") {
    const start = startOfQuarter(now);
    const end = endOfDay(now);
    const prev = subQuarters(now, 1);
    return {
      period,
      start,
      end,
      prevStart: startOfQuarter(prev),
      prevEnd: endOfQuarter(prev),
      hasComparison: true,
    };
  }

  if (period === "THIS_YEAR") {
    const start = startOfYear(now);
    const end = endOfDay(now);
    const prev = subYears(now, 1);
    return {
      period,
      start,
      end,
      prevStart: startOfYear(prev),
      prevEnd: endOfYear(prev),
      hasComparison: true,
    };
  }

  // CUSTOM
  const parsedStart = toDate(customStart);
  const parsedEnd = toDate(customEnd);
  if (parsedStart && parsedEnd && parsedStart <= parsedEnd) {
    const start = startOfDay(parsedStart);
    const end = endOfDay(parsedEnd);
    const spanMs = end.getTime() - start.getTime() + 1;
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - spanMs + 1);
    return { period, start, end, prevStart, prevEnd, hasComparison: true };
  }

  // Safe fallback if custom dates incomplete
  const start = startOfMonth(now);
  const end = endOfDay(now);
  const prev = subMonths(now, 1);
  return {
    period,
    start,
    end,
    prevStart: startOfMonth(prev),
    prevEnd: endOfMonth(prev),
    hasComparison: true,
  };
}

function inRange(dateValue: string | Date | null | undefined, start: Date | null, end: Date | null): boolean {
  if (!start || !end) return true;
  const d = toDate(dateValue);
  if (!d) return false;
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

function resolveTaskUserIds(task: RawTask, usersByName: Map<string, string>): Set<string> {
  const ids = new Set<string>();
  if (task.taskExecutors && task.taskExecutors.length > 0) {
    task.taskExecutors.forEach((te) => {
      if (te.userId) ids.add(te.userId);
    });
  }
  if (task.executor) {
    task.executor
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .forEach((nameKey) => {
        const uid = usersByName.get(nameKey);
        if (uid) ids.add(uid);
      });
  }
  if (ids.size === 0 && task.userId) {
    ids.add(task.userId);
  }
  return ids;
}

function resolveTaskNames(task: RawTask): string[] {
  if (task.taskExecutors && task.taskExecutors.length > 0) {
    const names = task.taskExecutors
      .map((te) => te.user?.name)
      .filter((n): n is string => Boolean(n));
    if (names.length > 0) return Array.from(new Set(names));
  }
  if (task.executor) {
    return task.executor
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function resolveTicketUserIds(ticket: RawSupportTicket): Set<string> {
  const ids = new Set<string>();
  if (ticket.executors && ticket.executors.length > 0) {
    ticket.executors.forEach((e) => ids.add(e.id));
  } else if (ticket.userId) {
    ids.add(ticket.userId);
  }
  return ids;
}

export function filterDatasetByMember(
  dataset: DashboardDataset,
  memberId: string
): DashboardDataset {
  if (!memberId || memberId === "ALL") return dataset;

  const usersByName = new Map<string, string>();
  dataset.users.forEach((u) => usersByName.set(u.name.trim().toLowerCase(), u.id));

  const tasks = dataset.tasks.filter((t) => resolveTaskUserIds(t, usersByName).has(memberId));
  const taskProjectIds = new Set(
    tasks.map((t) => t.projectId).filter((pid): pid is string => Boolean(pid))
  );

  const projects = dataset.projects.filter((p) => {
    if (p.projectMembers?.some((pm) => pm.userId === memberId)) return true;
    return taskProjectIds.has(p.id);
  });

  const supportTickets = dataset.supportTickets.filter((tk) =>
    resolveTicketUserIds(tk).has(memberId)
  );

  const timeLogs = dataset.timeLogs.filter((tl) => tl.userId === memberId);

  const maintenanceSchedules = dataset.maintenanceSchedules.filter((ms) =>
    ms.assignedExecutors?.some((ex) => ex.id === memberId)
  );

  const maintenanceLogs = dataset.maintenanceLogs.filter(
    (ml) => ml.executedById === memberId
  );

  return {
    users: dataset.users,
    projects,
    tasks,
    supportTickets,
    timeLogs,
    assets: dataset.assets,
    maintenanceSchedules,
    maintenanceLogs,
  };
}

function roundOneDecimal(val: number): number {
  return Math.round(val * 10) / 10;
}

function computeTaskOnTimeMetrics(tasks: RawTask[]) {
  const completed = tasks.filter((t) => isDoneStatus(t.status));
  if (completed.length === 0) {
    return { total: 0, onTime: 0, rate: 0 };
  }
  let onTime = 0;
  for (const t of completed) {
    const plannedEnd = toDate(t.endDate);
    const actualEnd = toDate(t.actualEndDate) || toDate(t.updatedAt) || toDate(t.createdAt);
    if (!plannedEnd || !actualEnd || actualEnd.getTime() <= plannedEnd.getTime()) {
      onTime += 1;
    }
  }
  return {
    total: completed.length,
    onTime,
    rate: roundOneDecimal((onTime / completed.length) * 100),
  };
}

function computeTicketSlaMetrics(tickets: RawSupportTicket[]) {
  const resolvedRequests = tickets.filter(
    (tk) => tk.ticketType === "REQUEST" && isDoneStatus(tk.status)
  );
  if (resolvedRequests.length === 0) {
    return { total: 0, met: 0, rate: 0, mttrMinutes: 0 };
  }
  let met = 0;
  let totalMinutes = 0;
  let durationSamples = 0;

  for (const tk of resolvedRequests) {
    const start = toDate(tk.startDate) || toDate(tk.createdAt);
    const end = toDate(tk.endDate) || toDate(tk.updatedAt);
    const targetMins = getSlaTargetMinutes(tk.priority, tk.slaTargetMinutes);
    const slaDue =
      toDate(tk.slaDueAt) ||
      (start ? new Date(start.getTime() + targetMins * 60_000) : null);

    if (end && slaDue) {
      if (end.getTime() <= slaDue.getTime()) {
        met += 1;
      }
    } else {
      met += 1;
    }

    if (start && end) {
      const diffMins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
      totalMinutes += diffMins;
      durationSamples += 1;
    }
  }

  return {
    total: resolvedRequests.length,
    met,
    rate: roundOneDecimal((met / resolvedRequests.length) * 100),
    mttrMinutes: durationSamples > 0 ? Math.round(totalMinutes / durationSamples) : 0,
  };
}

export function classifyProjectHealth(
  project: RawProject,
  projectTasks: RawTask[],
  now: Date
): { health: ProjectHealth; progressPct: number; overdueTasks: number; completedTasks: number } {
  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter((t) => isDoneStatus(t.status)).length;
  const overdueTasks = projectTasks.filter((t) => {
    if (isDoneStatus(t.status)) return false;
    const end = toDate(t.endDate);
    return Boolean(end && end.getTime() < now.getTime());
  }).length;

  if (isDoneStatus(project.status)) {
    return { health: "COMPLETED", progressPct: 100, overdueTasks: 0, completedTasks };
  }

  const progressPct =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const start = toDate(project.startDate);
  const end = toDate(project.endDate);

  if (end && now.getTime() > end.getTime()) {
    return { health: "DELAYED", progressPct, overdueTasks, completedTasks };
  }

  if (start && end && end.getTime() > start.getTime()) {
    const elapsedPct = ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100;
    if ((elapsedPct > 70 && progressPct < elapsedPct - 20) || overdueTasks > 0) {
      return { health: "AT_RISK", progressPct, overdueTasks, completedTasks };
    }
  } else if (overdueTasks > 0) {
    return { health: "AT_RISK", progressPct, overdueTasks, completedTasks };
  }

  return { health: "ON_TRACK", progressPct, overdueTasks, completedTasks };
}

export function computeExecutiveKpis(
  dataset: DashboardDataset,
  window: PeriodWindow,
  memberId: string = "ALL",
  now: Date = new Date()
): ExecutiveKpiResult {
  const scoped = filterDatasetByMember(dataset, memberId);

  // 1. Project On-Time Rate
  const tasksInPeriod = scoped.tasks.filter((t) =>
    inRange(t.actualEndDate || t.endDate || t.createdAt, window.start, window.end)
  );
  const currentOnTime = computeTaskOnTimeMetrics(tasksInPeriod);

  let projectOnTimeDelta: number | null = null;
  if (window.hasComparison && window.prevStart && window.prevEnd) {
    const prevTasks = scoped.tasks.filter((t) =>
      inRange(t.actualEndDate || t.endDate || t.createdAt, window.prevStart, window.prevEnd)
    );
    const prevOnTime = computeTaskOnTimeMetrics(prevTasks);
    if (prevOnTime.total > 0 && currentOnTime.total > 0) {
      projectOnTimeDelta = roundOneDecimal(currentOnTime.rate - prevOnTime.rate);
    }
  }

  let atRiskProjects = 0;
  let delayedProjects = 0;
  const tasksByProject = new Map<string, RawTask[]>();
  scoped.tasks.forEach((t) => {
    if (!t.projectId) return;
    const arr = tasksByProject.get(t.projectId) || [];
    arr.push(t);
    tasksByProject.set(t.projectId, arr);
  });
  scoped.projects.forEach((p) => {
    const pTasks = tasksByProject.get(p.id) || [];
    if (!projectMatchesWindow(p, pTasks, window.start, window.end, now)) {
      return;
    }
    const { health } = classifyProjectHealth(p, pTasks, now);
    if (health === "AT_RISK") atRiskProjects += 1;
    if (health === "DELAYED") delayedProjects += 1;
  });

  // 2. Support SLA & MTTR (strictly REQUEST)
  const ticketsInPeriod = scoped.supportTickets.filter((tk) =>
    inRange(tk.endDate || tk.startDate || tk.createdAt, window.start, window.end)
  );
  const currentSla = computeTicketSlaMetrics(ticketsInPeriod);

  let supportSlaDelta: number | null = null;
  if (window.hasComparison && window.prevStart && window.prevEnd) {
    const prevTickets = scoped.supportTickets.filter((tk) =>
      inRange(tk.endDate || tk.startDate || tk.createdAt, window.prevStart, window.prevEnd)
    );
    const prevSla = computeTicketSlaMetrics(prevTickets);
    if (prevSla.total > 0 && currentSla.total > 0) {
      supportSlaDelta = roundOneDecimal(currentSla.rate - prevSla.rate);
    }
  }

  const openRequests = scoped.supportTickets.filter(
    (tk) => tk.ticketType === "REQUEST" && !isDoneStatus(tk.status)
  );
  const breachedOpenRequestsCount = openRequests.filter((tk) => {
    const start = toDate(tk.startDate) || toDate(tk.createdAt);
    const targetMins = getSlaTargetMinutes(tk.priority, tk.slaTargetMinutes);
    const slaDue =
      toDate(tk.slaDueAt) ||
      (start ? new Date(start.getTime() + targetMins * 60_000) : null);
    return Boolean(slaDue && now.getTime() > slaDue.getTime());
  }).length;

  // 3. Maintenance Compliance & Asset Health
  const schedules = scoped.maintenanceSchedules;
  const overdueSchedulesCount = schedules.filter(
    (ms) => normalizeStatus(ms.status) === "OVERDUE"
  ).length;
  const sevenDaysLater = new Date(now.getTime() + 7 * 86_400_000);
  const dueSoonSchedulesCount = schedules.filter((ms) => {
    if (isDoneStatus(ms.status)) return false;
    const due = toDate(ms.nextDueDate);
    return Boolean(due && due.getTime() <= sevenDaysLater.getTime());
  }).length;

  const logsInPeriod = scoped.maintenanceLogs.filter((ml) =>
    inRange(ml.executionDate, window.start, window.end)
  );
  const maintenanceComplianceRate =
    schedules.length > 0
      ? roundOneDecimal(((schedules.length - overdueSchedulesCount) / schedules.length) * 100)
      : logsInPeriod.length > 0
      ? 100
      : 100;

  let maintenanceDelta: number | null = null;
  if (window.hasComparison && window.prevStart && window.prevEnd) {
    const prevLogs = scoped.maintenanceLogs.filter((ml) =>
      inRange(ml.executionDate, window.prevStart, window.prevEnd)
    );
    if (prevLogs.length > 0 && logsInPeriod.length > 0) {
      const curGood = logsInPeriod.filter((l) => l.overallCondition === "BAIK").length / logsInPeriod.length;
      const prevGood = prevLogs.filter((l) => l.overallCondition === "BAIK").length / prevLogs.length;
      maintenanceDelta = roundOneDecimal((curGood - prevGood) * 100);
    }
  }

  const totalAssetsCount = scoped.assets.length;
  const activeAssetsCount = scoped.assets.filter(
    (a) => normalizeStatus(a.status) === "ACTIVE"
  ).length;
  const inRepairAssetsCount = scoped.assets.filter(
    (a) => normalizeStatus(a.status) === "IN_REPAIR"
  ).length;
  const qrStickeredCount = scoped.assets.filter((a) => Boolean(a.qrPrintedAt)).length;
  const assetHealthRate =
    totalAssetsCount > 0 ? roundOneDecimal((activeAssetsCount / totalAssetsCount) * 100) : 0;

  const goodConditionAssets =
    logsInPeriod.length > 0
      ? roundOneDecimal(
          (logsInPeriod.filter((l) => l.overallCondition === "BAIK").length /
            logsInPeriod.length) *
            100
        )
      : assetHealthRate;

  // 4. Active Workload
  const openTasksCount = scoped.tasks.filter((t) => !isDoneStatus(t.status)).length;
  const activeWorkloadTotal = openTasksCount + openRequests.length;
  const activeUsers = dataset.users.filter((u) => u.isActive !== false);
  const activeTeamCount = memberId !== "ALL" ? 1 : Math.max(1, activeUsers.length);
  const avgWorkloadPerMember = roundOneDecimal(activeWorkloadTotal / activeTeamCount);

  let workloadDelta: number | null = null;
  if (window.hasComparison && window.start && window.end && window.prevStart && window.prevEnd) {
    const curNew =
      scoped.tasks.filter((t) => inRange(t.createdAt, window.start, window.end)).length +
      scoped.supportTickets.filter(
        (tk) => tk.ticketType === "REQUEST" && inRange(tk.createdAt, window.start, window.end)
      ).length;
    const prevNew =
      scoped.tasks.filter((t) => inRange(t.createdAt, window.prevStart, window.prevEnd)).length +
      scoped.supportTickets.filter(
        (tk) => tk.ticketType === "REQUEST" && inRange(tk.createdAt, window.prevStart, window.prevEnd)
      ).length;
    if (prevNew > 0) {
      workloadDelta = roundOneDecimal(((curNew - prevNew) / prevNew) * 100);
    }
  }

  return {
    projectOnTimeRate: currentOnTime.rate,
    projectOnTimeDelta,
    projectCompletedCount: currentOnTime.total,
    projectOnTimeCount: currentOnTime.onTime,
    atRiskProjects,
    delayedProjects,

    supportSlaRate: currentSla.rate,
    supportSlaDelta,
    supportResolvedCount: currentSla.total,
    supportSlaMetCount: currentSla.met,
    mttrMinutes: currentSla.mttrMinutes,
    openRequestsCount: openRequests.length,
    breachedOpenRequestsCount,

    maintenanceComplianceRate,
    maintenanceDelta,
    overdueSchedulesCount,
    dueSoonSchedulesCount,
    assetHealthRate,
    activeAssetsCount,
    totalAssetsCount,
    inRepairAssetsCount,
    qrStickeredCount,
    healthyAssetRate: goodConditionAssets,

    activeWorkloadTotal,
    openTasksCount,
    avgWorkloadPerMember,
    activeTeamCount,
    workloadDelta,
  };
}

function projectMatchesWindow(
  p: RawProject,
  pTasks: RawTask[],
  winStart: Date | null,
  winEnd: Date | null,
  now: Date
): boolean {
  if (!winStart || !winEnd) return true;
  const pStart = toDate(p.startDate);
  if (pStart && pStart.getTime() > winEnd.getTime()) return false;
  if (overlapsWindow(p.startDate, p.actualEndDate || p.endDate, winStart, winEnd)) {
    return true;
  }
  if (
    !isDoneStatus(p.status) &&
    now.getTime() >= winStart.getTime() &&
    winEnd.getTime() >= (pStart?.getTime() || 0)
  ) {
    return true;
  }
  return pTasks.some((t) =>
    overlapsWindow(t.startDate, t.actualEndDate || t.endDate, winStart, winEnd)
  );
}

function overlapsWindow(
  itemStart: string | Date | null | undefined,
  itemEnd: string | Date | null | undefined,
  winStart: Date | null,
  winEnd: Date | null
): boolean {
  if (!winStart || !winEnd) return true;
  const s = toDate(itemStart) || toDate(itemEnd);
  const e = toDate(itemEnd) || s;
  if (!s || !e) return false;
  return s.getTime() <= winEnd.getTime() && e.getTime() >= winStart.getTime();
}

export function computeProjectRoadmap(
  dataset: DashboardDataset,
  memberId: string = "ALL",
  now: Date = new Date(),
  window?: PeriodWindow
): ProjectRoadmapResult {
  const scoped = filterDatasetByMember(dataset, memberId);
  const userMap = new Map(dataset.users.map((u) => [u.id, u.name]));

  const tasksByProject = new Map<string, RawTask[]>();
  scoped.tasks.forEach((t) => {
    if (!t.projectId) return;
    const arr = tasksByProject.get(t.projectId) || [];
    arr.push(t);
    tasksByProject.set(t.projectId, arr);
  });

  const filteredProjects =
    window?.start && window?.end
      ? scoped.projects.filter((p) =>
          projectMatchesWindow(p, tasksByProject.get(p.id) || [], window.start, window.end, now)
        )
      : scoped.projects;

  const projects: RoadmapProjectItem[] = filteredProjects
    .map((p) => {
      const pTasks = tasksByProject.get(p.id) || [];
      const { health, progressPct, overdueTasks, completedTasks } = classifyProjectHealth(
        p,
        pTasks,
        now
      );

      const childrenByParent = new Map<string, RawTask[]>();
      pTasks.forEach((t) => {
        if (t.parentId) {
          const list = childrenByParent.get(t.parentId) || [];
          list.push(t);
          childrenByParent.set(t.parentId, list);
        }
      });

      const rootTasks = pTasks
        .filter((t) => !t.parentId)
        .sort((a, b) => (toDate(a.startDate)?.getTime() || 0) - (toDate(b.startDate)?.getTime() || 0));

      const mainTasks: RoadmapMainTask[] = rootTasks.map((rt) => {
        const subs = childrenByParent.get(rt.id) || [];
        const subDone = subs.filter((s) => isDoneStatus(s.status)).length;
        const end = toDate(rt.endDate);
        const start = toDate(rt.startDate);
        const actual = toDate(rt.actualEndDate);
        return {
          id: rt.id,
          title: rt.title,
          status: rt.status,
          priority: rt.priority,
          startDate: (start || now).toISOString(),
          endDate: (end || now).toISOString(),
          actualEndDate: actual ? actual.toISOString() : null,
          pics: resolveTaskNames(rt),
          subTaskTotal: subs.length,
          subTaskDone: subDone,
          isOverdue: !isDoneStatus(rt.status) && Boolean(end && end.getTime() < now.getTime()),
        };
      });

      const memberNames =
        p.projectMembers && p.projectMembers.length > 0
          ? p.projectMembers
              .map((pm) => userMap.get(pm.userId))
              .filter((n): n is string => Boolean(n))
          : (p.members || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        health,
        startDate: (toDate(p.startDate) || now).toISOString(),
        endDate: (toDate(p.endDate) || now).toISOString(),
        actualEndDate: toDate(p.actualEndDate)?.toISOString() || null,
        progressPct,
        totalTasks: pTasks.length,
        completedTasks,
        overdueTasks,
        memberNames: Array.from(new Set(memberNames)),
        mainTasks,
      };
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  let minMs = now.getTime() - 30 * 86_400_000;
  let maxMs = now.getTime() + 14 * 86_400_000;

  if (projects.length > 0) {
    minMs = Math.min(...projects.map((p) => new Date(p.startDate).getTime()));
    maxMs = Math.max(now.getTime(), ...projects.map((p) => new Date(p.endDate).getTime()));
  }

  const paddingMs = Math.max(7 * 86_400_000, Math.round((maxMs - minMs) * 0.04));
  const windowStartMs = minMs - paddingMs;
  const windowEndMs = maxMs + paddingMs;
  const totalSpan = Math.max(1, windowEndMs - windowStartMs);
  const todayPct = Math.min(100, Math.max(0, ((now.getTime() - windowStartMs) / totalSpan) * 100));

  return { windowStartMs, windowEndMs, todayPct, projects };
}

export function computeTeamMatrix(
  dataset: DashboardDataset,
  window: PeriodWindow,
  memberId: string = "ALL",
  now: Date = new Date()
): TeamMemberRow[] {
  const usersByName = new Map<string, string>();
  dataset.users.forEach((u) => usersByName.set(u.name.trim().toLowerCase(), u.id));
  const projectMap = new Map(dataset.projects.map((p) => [p.id, p.name]));

  const targetUsers = dataset.users.filter((u) =>
    memberId !== "ALL" ? u.id === memberId : u.isActive !== false
  );

  return targetUsers
    .map((u) => {
      const myTasks = dataset.tasks.filter((t) => resolveTaskUserIds(t, usersByName).has(u.id));
      const tasksDone = myTasks.filter(
        (t) =>
          isDoneStatus(t.status) &&
          inRange(t.actualEndDate || t.endDate || t.createdAt, window.start, window.end)
      ).length;
      const openTasks = myTasks.filter((t) => !isDoneStatus(t.status));

      const myTickets = dataset.supportTickets.filter((tk) => resolveTicketUserIds(tk).has(u.id));
      const resolvedReqs = myTickets.filter(
        (tk) =>
          tk.ticketType === "REQUEST" &&
          isDoneStatus(tk.status) &&
          inRange(tk.endDate || tk.startDate || tk.createdAt, window.start, window.end)
      );
      const dailyLogsCount = myTickets.filter(
        (tk) =>
          tk.ticketType === "DAILY_ACTIVITY" &&
          inRange(tk.startDate || tk.createdAt, window.start, window.end)
      ).length;

      let mttrTotal = 0;
      let mttrCount = 0;
      resolvedReqs.forEach((tk) => {
        const s = toDate(tk.startDate) || toDate(tk.createdAt);
        const e = toDate(tk.endDate) || toDate(tk.updatedAt);
        if (s && e) {
          mttrTotal += Math.max(0, Math.round((e.getTime() - s.getTime()) / 60_000));
          mttrCount += 1;
        }
      });

      const maintenanceCompleted = dataset.maintenanceLogs.filter(
        (ml) => ml.executedById === u.id && inRange(ml.executionDate, window.start, window.end)
      ).length;

      const timeLogSeconds = dataset.timeLogs
        .filter((tl) => tl.userId === u.id && inRange(tl.startTime, window.start, window.end))
        .reduce((acc, tl) => {
          if (tl.durationSeconds && tl.durationSeconds > 0) return acc + tl.durationSeconds;
          if (tl.duration && tl.duration > 0) return acc + tl.duration;
          if (tl.durationMinutes && tl.durationMinutes > 0) return acc + tl.durationMinutes * 60;
          return acc;
        }, 0);

      const fallbackTaskMinutes =
        timeLogSeconds === 0
          ? myTasks.reduce((acc, t) => acc + (t.totalLoggedMinutes || 0), 0) * 60
          : 0;

      const scopedOpenTasks =
        window.start && window.end
          ? openTasks.filter((t) => overlapsWindow(t.startDate, t.endDate, window.start, window.end))
          : openTasks;

      const openReqs = myTickets.filter((tk) => {
        if (tk.ticketType !== "REQUEST" || isDoneStatus(tk.status)) return false;
        if (!window.start || !window.end) return true;
        const s = toDate(tk.startDate) || toDate(tk.createdAt);
        const due = toDate(tk.slaDueAt) || s;
        return overlapsWindow(s, due, window.start, window.end);
      });

      const workItems: TeamWorkItem[] = [
        ...scopedOpenTasks.map((t) => {
          const end = toDate(t.endDate) || now;
          const start = toDate(t.startDate) || end;
          return {
            id: t.id,
            kind: "TASK" as const,
            title: t.title,
            contextName:
              t.project?.name || (t.projectId ? projectMap.get(t.projectId) : null) || "Task",
            status: t.status,
            priority: t.priority,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            isOverdue: end.getTime() < now.getTime(),
          };
        }),
        ...openReqs.map((tk) => {
          const start = toDate(tk.startDate) || toDate(tk.createdAt) || now;
          const due =
            toDate(tk.slaDueAt) ||
            new Date(start.getTime() + getSlaTargetMinutes(tk.priority, tk.slaTargetMinutes) * 60_000);
          return {
            id: tk.id,
            kind: "TICKET" as const,
            title: tk.taskName || tk.issue || tk.ticketNumber || "Support Request",
            contextName: tk.ticketNumber || tk.supportModule?.name || tk.supportType || "Support",
            status: tk.status,
            priority: tk.priority,
            startDate: start.toISOString(),
            endDate: due.toISOString(),
            isOverdue: due.getTime() < now.getTime(),
          };
        }),
      ].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        jobDesk: u.jobDesk || u.role,
        tasksDone,
        activeTasks: openTasks.length,
        ticketsResolved: resolvedReqs.length,
        dailyLogsCount,
        avgMttrMinutes: mttrCount > 0 ? Math.round(mttrTotal / mttrCount) : 0,
        maintenanceCompleted,
        loggedSeconds: timeLogSeconds + fallbackTaskMinutes,
        workItems,
      };
    })
    .sort((a, b) => b.tasksDone + b.ticketsResolved - (a.tasksDone + a.ticketsResolved));
}

export function computeEffortSplit(
  dataset: DashboardDataset,
  window: PeriodWindow,
  memberId: string = "ALL"
): EffortSplitResult {
  const scoped = filterDatasetByMember(dataset, memberId);
  const logsInPeriod = scoped.timeLogs.filter((tl) => inRange(tl.startTime, window.start, window.end));

  let projSec = 0;
  let supSec = 0;
  logsInPeriod.forEach((tl) => {
    const sec =
      tl.durationSeconds && tl.durationSeconds > 0
        ? tl.durationSeconds
        : tl.duration && tl.duration > 0
        ? tl.duration
        : (tl.durationMinutes || 0) * 60;
    if (tl.supportTicketId) supSec += sec;
    else projSec += sec;
  });

  if (projSec === 0) {
    projSec =
      scoped.tasks
        .filter((t) => inRange(t.updatedAt || t.createdAt, window.start, window.end))
        .reduce((acc, t) => acc + (t.totalLoggedMinutes || 0), 0) * 60;
  }

  const projOps = scoped.tasks.filter((t) =>
    inRange(t.updatedAt || t.createdAt, window.start, window.end)
  ).length;
  const supOps = scoped.supportTickets.filter((tk) =>
    inRange(tk.startDate || tk.createdAt, window.start, window.end)
  ).length;
  const maintOps = scoped.maintenanceLogs.filter((ml) =>
    inRange(ml.executionDate, window.start, window.end)
  ).length;

  const totalSeconds = projSec + supSec;
  const totalOperations = projOps + supOps + maintOps;
  const mode: "HOURS" | "OPERATIONS" = totalSeconds > 0 ? "HOURS" : "OPERATIONS";

  const pct = (val: number, total: number) =>
    total > 0 ? roundOneDecimal((val / total) * 100) : 0;

  return {
    mode,
    totalSeconds,
    totalOperations,
    segments: [
      {
        key: "PROJECT",
        seconds: projSec,
        operations: projOps,
        pct: mode === "HOURS" ? pct(projSec, totalSeconds) : pct(projOps, totalOperations),
      },
      {
        key: "SUPPORT",
        seconds: supSec,
        operations: supOps,
        pct: mode === "HOURS" ? pct(supSec, totalSeconds) : pct(supOps, totalOperations),
      },
      {
        key: "MAINTENANCE",
        seconds: 0,
        operations: maintOps,
        pct: mode === "HOURS" ? 0 : pct(maintOps, totalOperations),
      },
    ],
  };
}

export function computeBlockerRadar(
  dataset: DashboardDataset,
  memberId: string = "ALL",
  now: Date = new Date(),
  window?: PeriodWindow
): BlockerItem[] {
  const scoped = filterDatasetByMember(dataset, memberId);
  const items: BlockerItem[] = [];
  const wStart = window?.start || null;
  const wEnd = window?.end || null;

  const tasksByProject = new Map<string, RawTask[]>();
  scoped.tasks.forEach((t) => {
    if (!t.projectId) return;
    const arr = tasksByProject.get(t.projectId) || [];
    arr.push(t);
    tasksByProject.set(t.projectId, arr);
  });

  scoped.projects.forEach((p) => {
    const pTasks = tasksByProject.get(p.id) || [];
    if (!projectMatchesWindow(p, pTasks, wStart, wEnd, now)) {
      return;
    }
    const { health, progressPct, overdueTasks } = classifyProjectHealth(
      p,
      pTasks,
      now
    );
    const end = toDate(p.endDate);
    if (health === "DELAYED" && end) {
      const days = Math.max(1, Math.ceil((now.getTime() - end.getTime()) / 86_400_000));
      items.push({
        id: `proj-${p.id}`,
        kind: "PROJECT",
        severity: "CRITICAL",
        code: "PROJECT DELAYED",
        title: p.name,
        owner: `${progressPct}% done`,
        detail: `${overdueTasks} overdue tasks · Target passed`,
        daysOverdue: days,
        href: `/projects?projectId=${p.id}`,
      });
    } else if (health === "AT_RISK") {
      items.push({
        id: `proj-${p.id}`,
        kind: "PROJECT",
        severity: "WARN",
        code: "AT RISK",
        title: p.name,
        owner: `${progressPct}% done`,
        detail: `${overdueTasks} overdue tasks`,
        daysOverdue: 0,
        href: `/projects?projectId=${p.id}`,
      });
    }
  });

  scoped.supportTickets
    .filter((tk) => tk.ticketType === "REQUEST" && !isDoneStatus(tk.status))
    .forEach((tk) => {
      const start = toDate(tk.startDate) || toDate(tk.createdAt) || now;
      const slaDue =
        toDate(tk.slaDueAt) ||
        new Date(start.getTime() + getSlaTargetMinutes(tk.priority, tk.slaTargetMinutes) * 60_000);
      if (wStart && wEnd && !overlapsWindow(start, slaDue, wStart, wEnd)) {
        return;
      }
      const isBreach = now.getTime() > slaDue.getTime();
      const isUrgent = tk.priority.toUpperCase() === "URGENT";
      if (isBreach || isUrgent) {
        const days = isBreach
          ? Math.max(1, Math.ceil((now.getTime() - slaDue.getTime()) / 86_400_000))
          : 0;
        items.push({
          id: `tkt-${tk.id}`,
          kind: "TICKET",
          severity: isBreach ? "CRITICAL" : "HIGH",
          code: tk.ticketNumber || (isBreach ? "SLA BREACH" : "URGENT"),
          title: tk.taskName || tk.issue || "Support Request",
          owner: tk.executors?.map((e) => e.name).join(", ") || tk.user?.name || "Unassigned",
          detail: isBreach ? "SLA Breach" : `Priority ${tk.priority}`,
          daysOverdue: days,
          href: `/support`,
        });
      }
    });

  scoped.tasks
    .filter((t) => !isDoneStatus(t.status))
    .forEach((t) => {
      if (wStart && wEnd && !overlapsWindow(t.startDate, t.endDate, wStart, wEnd)) {
        return;
      }
      const end = toDate(t.endDate);
      const isOverdue = Boolean(end && end.getTime() < now.getTime());
      const suspended = isSuspendedStatus(t.status);
      if (isOverdue || suspended) {
        const days = end && isOverdue
          ? Math.max(1, Math.ceil((now.getTime() - end.getTime()) / 86_400_000))
          : 0;
        items.push({
          id: `task-${t.id}`,
          kind: "TASK",
          severity: suspended ? "HIGH" : days > 14 ? "HIGH" : "WARN",
          code: t.project?.name || "TASK",
          title: t.title,
          owner: resolveTaskNames(t).join(", ") || "Unassigned",
          detail: t.issue || (suspended ? "Suspended" : `${days}d overdue`),
          daysOverdue: days,
          href: t.projectId ? `/projects?projectId=${t.projectId}` : "/projects",
        });
      }
    });

  scoped.maintenanceSchedules
    .filter((ms) => normalizeStatus(ms.status) === "OVERDUE")
    .forEach((ms) => {
      const due = toDate(ms.nextDueDate) || now;
      const days = Math.max(1, Math.ceil((now.getTime() - due.getTime()) / 86_400_000));
      items.push({
        id: `maint-${ms.id}`,
        kind: "MAINTENANCE",
        severity: "CRITICAL",
        code: ms.asset?.assetCode || "MAINT",
        title: `${ms.asset?.assetName || "Asset"} · ${ms.template?.templateName || "Check"}`,
        owner: ms.assignedExecutors?.map((e) => e.name).join(", ") || "Unassigned",
        detail: `${days}d overdue`,
        daysOverdue: days,
        href: `/maintenance`,
      });
    });

  const weight = { CRITICAL: 3, HIGH: 2, WARN: 1 };
  return items.sort(
    (a, b) => weight[b.severity] - weight[a.severity] || b.daysOverdue - a.daysOverdue
  );
}

export function computeSupportVolumeSeries(
  dataset: DashboardDataset,
  window: PeriodWindow,
  memberId: string = "ALL"
): SupportVolumePoint[] {
  const scoped = filterDatasetByMember(dataset, memberId);
  const byCategory = new Map<string, { req: number; daily: number }>();

  scoped.supportTickets
    .filter((tk) => inRange(tk.startDate || tk.createdAt, window.start, window.end))
    .forEach((tk) => {
      const cat = tk.supportModule?.name || tk.module || tk.supportType || "General";
      const cur = byCategory.get(cat) || { req: 0, daily: 0 };
      if (tk.ticketType === "REQUEST") cur.req += 1;
      else cur.daily += 1;
      byCategory.set(cat, cur);
    });

  return Array.from(byCategory.entries())
    .map(([category, counts]) => ({
      category,
      requestCount: counts.req,
      dailyCount: counts.daily,
      total: counts.req + counts.daily,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

export function computeMyActionQueue(
  dataset: DashboardDataset,
  currentUserId: string,
  now: Date = new Date()
): ActionQueueItem[] {
  const myData = filterDatasetByMember(dataset, currentUserId);
  const queue: ActionQueueItem[] = [];

  myData.tasks
    .filter((t) => !isDoneStatus(t.status))
    .forEach((t) => {
      const due = toDate(t.endDate);
      queue.push({
        id: `q-task-${t.id}`,
        kind: "TASK",
        code: t.project?.name || "TASK",
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: due ? due.toISOString() : null,
        isOverdue: Boolean(due && due.getTime() < now.getTime()),
        href: t.projectId ? `/projects?projectId=${t.projectId}` : "/projects",
      });
    });

  myData.supportTickets
    .filter((tk) => tk.ticketType === "REQUEST" && !isDoneStatus(tk.status))
    .forEach((tk) => {
      const start = toDate(tk.startDate) || toDate(tk.createdAt) || now;
      const due =
        toDate(tk.slaDueAt) ||
        new Date(start.getTime() + getSlaTargetMinutes(tk.priority, tk.slaTargetMinutes) * 60_000);
      queue.push({
        id: `q-tkt-${tk.id}`,
        kind: "TICKET",
        code: tk.ticketNumber || "SUPPORT",
        title: tk.taskName || tk.issue || "Support Ticket",
        status: tk.status,
        priority: tk.priority,
        dueDate: due.toISOString(),
        isOverdue: due.getTime() < now.getTime(),
        href: `/support`,
      });
    });

  myData.maintenanceSchedules
    .filter((ms) => !isDoneStatus(ms.status))
    .forEach((ms) => {
      const due = toDate(ms.nextDueDate);
      queue.push({
        id: `q-maint-${ms.id}`,
        kind: "MAINTENANCE",
        code: ms.asset?.assetCode || "ASSET",
        title: `${ms.asset?.assetName || "Asset"} — ${ms.template?.templateName || "Checklist"}`,
        status: ms.status,
        priority: normalizeStatus(ms.status) === "OVERDUE" ? "Urgent" : "Normal",
        dueDate: due ? due.toISOString() : null,
        isOverdue:
          normalizeStatus(ms.status) === "OVERDUE" ||
          Boolean(due && due.getTime() < now.getTime()),
        href: `/maintenance`,
      });
    });

  return queue.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return da - db;
  });
}
