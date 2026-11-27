import * as XLSX from "xlsx";
import {
  type DashboardDataset,
  type DashboardPeriod,
  type ExecutiveKpiResult,
  type ProjectRoadmapResult,
  type TeamMemberRow,
  isDoneStatus,
  toDate,
  getSlaTargetMinutes,
} from "./kpi-engine";
import { formatDurationCompact, formatShortDate } from "./format";

export interface ExecutiveExportInput {
  period: DashboardPeriod;
  memberLabel: string;
  generatedAt: Date;
  kpis: ExecutiveKpiResult;
  roadmap: ProjectRoadmapResult;
  team: TeamMemberRow[];
  dataset: DashboardDataset;
}

const FORMULA_TRIGGER_RE = /^[\s]*[=+\-@\t\r]/;

/**
 * Neutralize potential spreadsheet formula injection (CWE-1236) on untrusted string cells.
 */
export function sanitizeSpreadsheetCell<T>(value: T): T | string {
  if (typeof value !== "string") return value;
  if (FORMULA_TRIGGER_RE.test(value)) {
    return `'${value}`;
  }
  return value;
}

function sanitizeRow<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = sanitizeSpreadsheetCell(v);
  }
  return out;
}

function buildSheetWithHeaders(
  rows: Record<string, unknown>[],
  headers: string[]
): XLSX.WorkSheet {
  const safeRows = rows.map(sanitizeRow);
  return XLSX.utils.json_to_sheet(safeRows, { header: headers });
}

/**
 * Generate and download a multi-sheet Executive Summary `.xlsx` workbook.
 */
export function exportExecutiveWorkbook(input: ExecutiveExportInput): void {
  const { period, memberLabel, generatedAt, kpis, roadmap, team, dataset } = input;
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary
  const summaryRows = [
    { Metric: "Organization", Value: "PT. Royal Medicalink Pharmalab — IT Department" },
    { Metric: "Generated At", Value: generatedAt.toISOString() },
    { Metric: "Period Filter", Value: period },
    { Metric: "Member Scope", Value: memberLabel },
    { Metric: "Project On-Time Rate (%)", Value: kpis.projectOnTimeRate },
    { Metric: "Projects At Risk / Delayed", Value: `${kpis.atRiskProjects} At Risk / ${kpis.delayedProjects} Delayed` },
    { Metric: "Support SLA Compliance (%)", Value: kpis.supportSlaRate },
    { Metric: "Support Avg Resolution (MTTR)", Value: formatDurationCompact(kpis.mttrMinutes * 60) },
    { Metric: "Open Support Requests / SLA Breached", Value: `${kpis.openRequestsCount} / ${kpis.breachedOpenRequestsCount}` },
    { Metric: "Maintenance Schedule Compliance (%)", Value: kpis.maintenanceComplianceRate },
    { Metric: "Active Asset Ratio (%)", Value: `${kpis.assetHealthRate}% (${kpis.activeAssetsCount}/${kpis.totalAssetsCount})` },
    { Metric: "Active Open Workload", Value: `${kpis.activeWorkloadTotal} (${kpis.avgWorkloadPerMember} avg/member)` },
  ];
  const wsSummary = buildSheetWithHeaders(summaryRows, ["Metric", "Value"]);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

  // Sheet 2: Project Roadmap
  const roadmapHeaders = [
    "Project",
    "Status",
    "Health",
    "Progress (%)",
    "Completed Tasks",
    "Total Tasks",
    "Overdue Tasks",
    "Start Date",
    "Target End",
    "Actual End",
    "Members",
  ];
  const roadmapRows = roadmap.projects.map((p) => ({
    Project: p.name,
    Status: p.status,
    Health: p.health,
    "Progress (%)": p.progressPct,
    "Completed Tasks": p.completedTasks,
    "Total Tasks": p.totalTasks,
    "Overdue Tasks": p.overdueTasks,
    "Start Date": formatShortDate(p.startDate),
    "Target End": formatShortDate(p.endDate),
    "Actual End": formatShortDate(p.actualEndDate),
    Members: p.memberNames.join(", ") || "-",
  }));
  XLSX.utils.book_append_sheet(
    wb,
    buildSheetWithHeaders(roadmapRows, roadmapHeaders),
    "Project Roadmap"
  );

  // Sheet 3: Team KPI
  const teamHeaders = [
    "Name",
    "Role",
    "Job Desk",
    "Tasks Done",
    "Active Tasks",
    "Tickets Resolved (REQUEST)",
    "Daily Activity Logs",
    "Avg MTTR",
    "Maintenance Completed",
    "Logged Time",
  ];
  const teamRows = team.map((m) => ({
    Name: m.name,
    Role: m.role,
    "Job Desk": m.jobDesk,
    "Tasks Done": m.tasksDone,
    "Active Tasks": m.activeTasks,
    "Tickets Resolved (REQUEST)": m.ticketsResolved,
    "Daily Activity Logs": m.dailyLogsCount,
    "Avg MTTR": formatDurationCompact(m.avgMttrMinutes * 60),
    "Maintenance Completed": m.maintenanceCompleted,
    "Logged Time": formatDurationCompact(m.loggedSeconds),
  }));
  XLSX.utils.book_append_sheet(wb, buildSheetWithHeaders(teamRows, teamHeaders), "Team KPI");

  // Sheet 4: Support SLA
  const supportHeaders = [
    "Ticket #",
    "Title",
    "Category",
    "Priority",
    "Status",
    "SLA Target (min)",
    "SLA Status",
    "Start Date",
    "Resolved Date",
    "Executors",
  ];
  const supportRows = dataset.supportTickets
    .filter((t) => t.ticketType === "REQUEST")
    .map((t) => {
      const start = toDate(t.startDate) || toDate(t.createdAt);
      const end = toDate(t.endDate);
      const slaMins = getSlaTargetMinutes(t.priority, t.slaTargetMinutes);
      const slaDue =
        toDate(t.slaDueAt) || (start ? new Date(start.getTime() + slaMins * 60_000) : null);
      const resolved = isDoneStatus(t.status);
      const slaMet = resolved
        ? !end || !slaDue || end.getTime() <= slaDue.getTime()
          ? "MET"
          : "BREACHED"
        : slaDue && generatedAt.getTime() > slaDue.getTime()
        ? "OVERDUE"
        : "ACTIVE";
      return {
        "Ticket #": t.ticketNumber || t.id,
        Title: t.taskName || t.issue || "-",
        Category: t.supportModule?.name || t.module || t.supportType || "-",
        Priority: t.priority,
        Status: t.status,
        "SLA Target (min)": slaMins,
        "SLA Status": slaMet,
        "Start Date": formatShortDate(t.startDate),
        "Resolved Date": formatShortDate(t.endDate),
        Executors: t.executors?.map((e) => e.name).join(", ") || t.user?.name || "-",
      };
    });
  XLSX.utils.book_append_sheet(
    wb,
    buildSheetWithHeaders(supportRows, supportHeaders),
    "Support SLA"
  );

  // Sheet 5: Asset & Maintenance
  const assetHeaders = [
    "Asset Code",
    "Asset Name",
    "Status",
    "Location",
    "Division",
    "Warranty End",
  ];
  const assetRows = dataset.assets.map((a) => ({
    "Asset Code": a.assetCode,
    "Asset Name": a.assetName,
    Status: a.status,
    Location: a.locationRef?.name || a.location || "-",
    Division: a.division?.name || "-",
    "Warranty End": formatShortDate(a.warrantyEndDate),
  }));
  XLSX.utils.book_append_sheet(
    wb,
    buildSheetWithHeaders(assetRows, assetHeaders),
    "Asset & Maintenance"
  );

  const stamp = generatedAt.toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Royal_Medica_IT_Executive_${stamp}.xlsx`);
}
