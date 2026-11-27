import {
  type DashboardDataset,
  classifyProjectHealth,
  computeBlockerRadar,
  computeEffortSplit,
  computeExecutiveKpis,
  computeMyActionQueue,
  computeProjectRoadmap,
  computeTeamMatrix,
  getPeriodWindow,
} from "../src/lib/kpi-engine";
import { sanitizeSpreadsheetCell } from "../src/lib/export-executive";

const NOW = new Date("2026-11-25T09:00:00Z");

const baseDataset: DashboardDataset = {
  users: [
    { id: "u1", name: "Angel", role: "Staff", jobDesk: "Frontend Dev", isActive: true },
    { id: "u2", name: "Ruslan", role: "Staff", jobDesk: "IT Support", isActive: true },
    { id: "u3", name: "Inactive User", role: "Staff", jobDesk: "Former", isActive: false },
  ],
  projects: [
    {
      id: "p1",
      name: "Factory ERP",
      status: "Ongoing",
      startDate: "2026-11-01T00:00:00Z",
      endDate: "2026-12-20T00:00:00Z",
      createdAt: "2026-11-01T00:00:00Z",
      projectMembers: [{ userId: "u1" }],
    },
    {
      id: "p2",
      name: "Legacy Migration",
      status: "Ongoing",
      startDate: "2026-09-01T00:00:00Z",
      endDate: "2026-10-15T00:00:00Z",
      createdAt: "2026-09-01T00:00:00Z",
      projectMembers: [{ userId: "u1" }, { userId: "u2" }],
    },
  ],
  tasks: [
    {
      id: "t1",
      projectId: "p1",
      parentId: null,
      title: "Build Executive KPI",
      status: "Completed",
      priority: "High",
      startDate: "2026-11-02T00:00:00Z",
      endDate: "2026-11-15T00:00:00Z",
      actualEndDate: "2026-11-12T00:00:00Z",
      totalLoggedMinutes: 120,
      createdAt: "2026-11-02T00:00:00Z",
      taskExecutors: [{ userId: "u1", user: { id: "u1", name: "Angel" } }],
      project: { id: "p1", name: "Factory ERP" },
    },
    {
      id: "t2",
      projectId: "p1",
      parentId: "t1",
      title: "Unit test SLA",
      status: "Ongoing",
      priority: "Normal",
      startDate: "2026-11-10T00:00:00Z",
      endDate: "2026-12-01T00:00:00Z",
      createdAt: "2026-11-10T00:00:00Z",
      executor: "Angel",
      project: { id: "p1", name: "Factory ERP" },
    },
    {
      id: "t3",
      projectId: "p2",
      parentId: null,
      title: "Late DB Cutover",
      status: "Completed",
      priority: "Urgent",
      startDate: "2026-10-01T00:00:00Z",
      endDate: "2026-10-10T00:00:00Z",
      actualEndDate: "2026-10-14T00:00:00Z",
      createdAt: "2026-10-01T00:00:00Z",
      executor: "Angel, Ruslan",
      project: { id: "p2", name: "Legacy Migration" },
    },
  ],
  supportTickets: [
    {
      id: "s1",
      ticketNumber: "SUP-2026-0001",
      userId: "u2",
      taskName: "Printer Network Jam",
      priority: "URGENT",
      status: "Done",
      ticketType: "REQUEST",
      startDate: "2026-11-20T08:00:00Z",
      endDate: "2026-11-20T09:00:00Z",
      slaTargetMinutes: 120,
      slaDueAt: "2026-11-20T10:00:00Z",
      createdAt: "2026-11-20T08:00:00Z",
      executors: [{ id: "u2", name: "Ruslan" }],
    },
    {
      id: "s2",
      ticketNumber: "SUP-2026-0002",
      userId: "u2",
      taskName: "ERP Login Error",
      priority: "HIGH",
      status: "Ongoing",
      ticketType: "REQUEST",
      startDate: "2026-11-24T01:00:00Z",
      slaTargetMinutes: 240,
      slaDueAt: "2026-11-24T05:00:00Z",
      createdAt: "2026-11-24T01:00:00Z",
      executors: [{ id: "u2", name: "Ruslan" }],
    },
    {
      id: "s3",
      ticketNumber: "SUP-2026-0003",
      userId: "u2",
      taskName: "Daily Server Backup Check",
      priority: "NORMAL",
      status: "Done",
      ticketType: "DAILY_ACTIVITY",
      startDate: "2026-11-24T07:00:00Z",
      endDate: "2026-11-24T07:30:00Z",
      createdAt: "2026-11-24T07:00:00Z",
      executors: [{ id: "u2", name: "Ruslan" }],
    },
  ],
  timeLogs: [
    {
      id: "tl1",
      userId: "u1",
      taskId: "t1",
      startTime: "2026-11-11T02:00:00Z",
      durationSeconds: 7200,
    },
    {
      id: "tl2",
      userId: "u2",
      supportTicketId: "s1",
      startTime: "2026-11-20T08:00:00Z",
      durationSeconds: 3600,
    },
  ],
  assets: [
    { id: "a1", assetCode: "RMP-JKT-001", assetName: "Core Switch", status: "ACTIVE" },
    { id: "a2", assetCode: "RMP-JKT-002", assetName: "Old Printer", status: "RETIRED" },
  ],
  maintenanceSchedules: [
    {
      id: "ms1",
      assetId: "a1",
      status: "UPCOMING",
      nextDueDate: "2026-11-28T00:00:00Z",
      asset: { assetCode: "RMP-JKT-001", assetName: "Core Switch" },
      template: { templateName: "Server & Network Check" },
      assignedExecutors: [{ id: "u2", name: "Ruslan" }],
    },
  ],
  maintenanceLogs: [
    {
      id: "ml1",
      assetId: "a1",
      scheduleId: "ms1",
      executedById: "u2",
      executionDate: "2026-11-05T00:00:00Z",
      overallCondition: "BAIK",
    },
  ],
};

describe("Executive KPI Engine", () => {
  test("computes On-Time rate, REQUEST-only SLA compliance, MTTR, and period comparison deltas", () => {
    const monthWindow = getPeriodWindow("THIS_MONTH", null, null, NOW);
    const kpis = computeExecutiveKpis(baseDataset, monthWindow, "ALL", NOW);

    // THIS_MONTH completed task: t1 (actual Nov 12 <= Nov 15 -> 100%) vs prev month t3 (late -> 0%) => delta +100
    expect(kpis.projectOnTimeRate).toBe(100);
    expect(kpis.projectOnTimeDelta).toBe(100);
    expect(kpis.delayedProjects).toBe(1); // p2 endDate passed

    // Support SLA includes only s1 (REQUEST Done in 60 mins <= 120 SLA), ignores s3 (DAILY_ACTIVITY)
    expect(kpis.supportSlaRate).toBe(100);
    expect(kpis.mttrMinutes).toBe(60);
    expect(kpis.openRequestsCount).toBe(1);
    expect(kpis.breachedOpenRequestsCount).toBe(1); // s2 slaDueAt Nov 24 < NOW Nov 25

    // Assets & Workload
    expect(kpis.activeAssetsCount).toBe(1);
    expect(kpis.totalAssetsCount).toBe(2);
    expect(kpis.assetHealthRate).toBe(50);
    expect(kpis.activeTeamCount).toBe(2); // inactive u3 excluded
    expect(kpis.activeWorkloadTotal).toBe(2); // t2 + s2
  });

  test("classifies project health and builds roadmap timeline with TODAY marker", () => {
    const p1Health = classifyProjectHealth(
      baseDataset.projects[0],
      baseDataset.tasks.filter((t) => t.projectId === "p1"),
      NOW
    );
    const p2Health = classifyProjectHealth(
      baseDataset.projects[1],
      baseDataset.tasks.filter((t) => t.projectId === "p2"),
      NOW
    );

    expect(p1Health.health).toBe("ON_TRACK");
    expect(p1Health.progressPct).toBe(50);
    expect(p2Health.health).toBe("DELAYED");

    const roadmap = computeProjectRoadmap(baseDataset, "ALL", NOW);
    expect(roadmap.projects).toHaveLength(2);
    expect(roadmap.todayPct).toBeGreaterThan(0);
    expect(roadmap.todayPct).toBeLessThanOrEqual(100);
  });

  test("computes team performance matrix, effort split, blockers, and action queue accurately", () => {
    const allWindow = getPeriodWindow("ALL_TIME", null, null, NOW);
    const team = computeTeamMatrix(baseDataset, allWindow, "ALL", NOW);

    expect(team).toHaveLength(2); // Only active users
    const ruslan = team.find((m) => m.userId === "u2")!;
    expect(ruslan.ticketsResolved).toBe(1);
    expect(ruslan.dailyLogsCount).toBe(1);
    expect(ruslan.avgMttrMinutes).toBe(60);
    expect(ruslan.maintenanceCompleted).toBe(1);
    expect(ruslan.loggedSeconds).toBe(3600);

    const effort = computeEffortSplit(baseDataset, allWindow, "ALL");
    expect(effort.mode).toBe("HOURS");
    expect(effort.totalSeconds).toBe(10800);

    const blockers = computeBlockerRadar(baseDataset, "ALL", NOW);
    expect(blockers.some((b) => b.kind === "PROJECT" && b.severity === "CRITICAL")).toBe(true);
    expect(blockers.some((b) => b.kind === "TICKET" && b.detail === "SLA Breach")).toBe(true);

    const queue = computeMyActionQueue(baseDataset, "u2", NOW);
    expect(queue.some((q) => q.kind === "TICKET" && q.isOverdue)).toBe(true);
    expect(queue.some((q) => q.kind === "MAINTENANCE")).toBe(true);
  });

  test("scopes roadmap and blockers dynamically by period window", () => {
    const datasetWithDone: DashboardDataset = {
      ...baseDataset,
      projects: [
        ...baseDataset.projects,
        {
          id: "p3",
          name: "Completed Aug Project",
          status: "Completed",
          startDate: "2026-08-01T00:00:00Z",
          endDate: "2026-08-25T00:00:00Z",
          actualEndDate: "2026-08-20T00:00:00Z",
          createdAt: "2026-08-01T00:00:00Z",
        },
      ],
    };

    const novWindow = getPeriodWindow("THIS_MONTH", null, null, NOW);
    const roadmapNov = computeProjectRoadmap(datasetWithDone, "ALL", NOW, novWindow);
    // Completed p3 (Aug) excluded in Nov; active/delayed p1 & p2 remain visible
    expect(roadmapNov.projects.map((p) => p.id)).toEqual(["p2", "p1"]);

    const customAug = getPeriodWindow("CUSTOM", "2026-08-01", "2026-08-31", NOW);
    const roadmapAug = computeProjectRoadmap(datasetWithDone, "ALL", NOW, customAug);
    expect(roadmapAug.projects.map((p) => p.id)).toEqual(["p3"]);

    const blockersAug = computeBlockerRadar(datasetWithDone, "ALL", NOW, customAug);
    expect(blockersAug.some((b) => b.id === "proj-p2")).toBe(false);
  });

  test("neutralizes spreadsheet formula injection triggers (CWE-1236)", () => {
    expect(sanitizeSpreadsheetCell("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
    expect(sanitizeSpreadsheetCell(" +SUM(A1:A2)")).toBe("' +SUM(A1:A2)");
    expect(sanitizeSpreadsheetCell("-100+1")).toBe("'-100+1");
    expect(sanitizeSpreadsheetCell("@import")).toBe("'@import");
    expect(sanitizeSpreadsheetCell("\tmalicious")).toBe("'\tmalicious");
    expect(sanitizeSpreadsheetCell("Factory ERP")).toBe("Factory ERP");
    expect(sanitizeSpreadsheetCell(89.6)).toBe(89.6);
  });
});
