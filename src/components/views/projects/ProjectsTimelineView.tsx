"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Crosshair,
  FolderKanban,
  Plus,
  Search,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { formatShortDate } from "@/lib/format";
import { buildProjectGroupedTaskTrees } from "@/lib/project-helpers";
import { useUiPref } from "@/lib/ui-prefs";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import {
  TASK_STATUSES,
  type ProjectRecord,
  type TaskRecord,
  getStatusPillClass,
  getTaskExecutorNames,
} from "./types";

interface ProjectsTimelineViewProps {
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onSelectTask: (t: TaskRecord) => void;
  onCreateTaskInProject?: (projectId: string) => void;
  nowMs: number;
}

type TimelineScale = "week" | "month" | "quarter";

const PROJECT_ACCENT_BORDERS = [
  "border-l-[#0F62FE] dark:border-l-[#60A5FA]",
  "border-l-[#0D9488] dark:border-l-[#2DD4BF]",
  "border-l-[#7C3AED] dark:border-l-[#A78BFA]",
  "border-l-[#D97706] dark:border-l-[#FBBF24]",
  "border-l-[#DC2626] dark:border-l-[#F87171]",
];

const PROJECT_BAR_ACCENTS = [
  "bg-[#0F62FE]/20 border-[#0F62FE]/50 text-[#0F62FE] dark:bg-[#60A5FA]/20 dark:border-[#60A5FA]/50 dark:text-[#93C5FD]",
  "bg-[#0D9488]/20 border-[#0D9488]/50 text-[#0F766E] dark:bg-[#2DD4BF]/20 dark:border-[#2DD4BF]/50 dark:text-[#5EEAD4]",
  "bg-[#7C3AED]/20 border-[#7C3AED]/50 text-[#6D28D9] dark:bg-[#A78BFA]/20 dark:border-[#A78BFA]/50 dark:text-[#C4B5FD]",
  "bg-[#D97706]/20 border-[#D97706]/50 text-[#B45309] dark:bg-[#FBBF24]/20 dark:border-[#FBBF24]/50 dark:text-[#FCD34D]",
  "bg-[#DC2626]/20 border-[#DC2626]/50 text-[#B91C1C] dark:bg-[#F87171]/20 dark:border-[#F87171]/50 dark:text-[#FCA5A5]",
];

export default function ProjectsTimelineView({
  projects,
  tasks,
  selectedProjectId,
  onSelectProject,
  onSelectTask,
  onCreateTaskInProject,
  nowMs,
}: ProjectsTimelineViewProps) {
  const { locale, t } = useI18n();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [scalePref, setScalePref] = useUiPref("projects_timeline_scale", "month");

  const scale: TimelineScale =
    scalePref === "week" || scalePref === "quarter" ? scalePref : "month";

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((item) => {
      if (selectedProjectId !== "all" && item.projectId !== selectedProjectId) return false;
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!q) return true;
      const exec = getTaskExecutorNames(item).join(" ").toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        exec.includes(q) ||
        (item.project?.name || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, selectedProjectId, statusFilter, searchQuery]);

  const projectGroups = useMemo(
    () => buildProjectGroupedTaskTrees(projects, filteredTasks),
    [projects, filteredTasks]
  );

  const projectIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p, idx) => map.set(p.id, idx));
    return map;
  }, [projects]);

  const isProjectExpanded = (key: string) => expandedProjects[key] !== false;
  const isParentExpanded = (id: string) => expandedParents[id] !== false;

  const allProjectsExpanded =
    projectGroups.length > 0 && projectGroups.every((g) => isProjectExpanded(g.projectKey));

  const toggleAllProjects = () => {
    const target = !allProjectsExpanded;
    const next: Record<string, boolean> = {};
    for (const g of projectGroups) next[g.projectKey] = target;
    setExpandedProjects(next);
  };

  // Compute timeline window across visible groups and tasks
  const { minMs, maxMs, todayPct, monthTicks, subTicks, trackMinWidthPx } = useMemo(() => {
    const timestamps: number[] = [];
    for (const g of projectGroups) {
      if (g.project) {
        const ps = new Date(g.project.startDate).getTime();
        const pe = new Date(g.project.endDate).getTime();
        if (!Number.isNaN(ps)) timestamps.push(ps);
        if (!Number.isNaN(pe)) timestamps.push(pe);
      }
      for (const { task } of g.rows) {
        const ts = new Date(task.startDate).getTime();
        const te = new Date(task.endDate).getTime();
        if (!Number.isNaN(ts)) timestamps.push(ts);
        if (!Number.isNaN(te)) timestamps.push(te);
        if (task.actualEndDate) {
          const ta = new Date(task.actualEndDate).getTime();
          if (!Number.isNaN(ta)) timestamps.push(ta);
        }
      }
    }

    let min = nowMs - 21 * 86_400_000;
    let max = nowMs + 21 * 86_400_000;
    if (timestamps.length > 0) {
      min = Math.min(...timestamps);
      max = Math.max(nowMs, ...timestamps);
    }

    const padMs = 5 * 86_400_000;
    const winMin = min - padMs;
    const winMax = max + padMs;
    const totalSpan = Math.max(14 * 86_400_000, winMax - winMin);
    const totalDays = Math.ceil(totalSpan / 86_400_000);

    const tPct = Math.max(0, Math.min(100, ((nowMs - winMin) / totalSpan) * 100));

    // Month header blocks
    const mTicks: Array<{ key: string; label: string; leftPct: number; widthPct: number }> = [];
    const startDt = new Date(winMin);
    const mCursor = new Date(startDt.getFullYear(), startDt.getMonth(), 1);
    while (mCursor.getTime() <= winMax && mTicks.length < 36) {
      const mStart = Math.max(winMin, mCursor.getTime());
      const nextMonth = new Date(mCursor.getFullYear(), mCursor.getMonth() + 1, 1);
      const mEnd = Math.min(winMax, nextMonth.getTime());
      if (mEnd > mStart) {
        mTicks.push({
          key: `${mCursor.getFullYear()}-${mCursor.getMonth()}`,
          label: mCursor
            .toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
              month: "short",
              year: "2-digit",
            })
            .toUpperCase(),
          leftPct: ((mStart - winMin) / totalSpan) * 100,
          widthPct: ((mEnd - mStart) / totalSpan) * 100,
        });
      }
      mCursor.setMonth(mCursor.getMonth() + 1);
    }

    // Sub-ticks: every 7 days in Week/Month view
    const sTicks: Array<{ key: string; label: string; leftPct: number }> = [];
    if (scale === "week" || scale === "month") {
      const stepDays = scale === "week" ? 7 : 14;
      let cursorMs = winMin;
      while (cursorMs < winMax && sTicks.length < 120) {
        const dt = new Date(cursorMs);
        sTicks.push({
          key: String(cursorMs),
          label: dt.toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
            day: "2-digit",
            month: "short",
          }),
          leftPct: ((cursorMs - winMin) / totalSpan) * 100,
        });
        cursorMs += stepDays * 86_400_000;
      }
    }

    const pxPerDay = scale === "week" ? 26 : scale === "month" ? 11 : 4;
    const minTrackPx = scale === "quarter" ? 720 : Math.max(840, Math.round(totalDays * pxPerDay));

    return {
      minMs: winMin,
      maxMs: winMin + totalSpan,
      todayPct: tPct,
      monthTicks: mTicks,
      subTicks: sTicks,
      trackMinWidthPx: minTrackPx,
    };
  }, [projectGroups, nowMs, locale, scale]);

  const totalSpanMs = Math.max(1, maxMs - minMs);

  const jumpToToday = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const labelColPx = 310;
    const scrollableTrack = Math.max(0, el.scrollWidth - labelColPx);
    const targetLeft = Math.max(
      0,
      labelColPx + (todayPct / 100) * scrollableTrack - el.clientWidth * 0.55
    );
    el.scrollTo({ left: targetLeft, behavior: "smooth" });
  };

  const projectOptions = [
    { value: "all", label: t.projects.allProjects },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const statusOptions = [
    { value: "ALL", label: t.projects.allStatuses },
    ...TASK_STATUSES.map((s) => ({ value: s, label: s })),
  ];

  return (
    <div className="space-y-3.5 w-full">
      {/* Focused Timeline Toolbar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] sm:flex-none sm:w-64">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.projects.searchTasksPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
            />
          </div>

          <ThemedSelect
            value={selectedProjectId}
            onChange={onSelectProject}
            options={projectOptions}
            icon={<FolderKanban className="w-3.5 h-3.5" />}
            className="min-w-[175px]"
          />

          <ThemedSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            className="min-w-[140px]"
          />

          {projectGroups.length > 1 && (
            <button
              type="button"
              onClick={toggleAllProjects}
              className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] text-[11px] font-medium text-[var(--text-ink2)] hover:text-[var(--text-ink)] transition-colors cursor-pointer"
            >
              {allProjectsExpanded ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>{t.projects.collapseAllProjects}</span>
                </>
              ) : (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{t.projects.expandAllProjects}</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scale Granularity Switch */}
          <div className="hidden md:inline-flex items-center bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5">
            {(
              [
                { id: "week", label: t.projects.scaleWeek },
                { id: "month", label: t.projects.scaleMonth },
                { id: "quarter", label: t.projects.scaleQuarter },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScalePref(opt.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                  scale === opt.id
                    ? "bg-[var(--brand)] text-white dark:text-[#161A26]"
                    : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={jumpToToday}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] font-mono-code text-[10px] font-bold hover:opacity-90 cursor-pointer tnum"
          >
            <Crosshair className="w-3 h-3" />
            <span>
              {t.projects.jumpToToday} · {formatShortDate(new Date(nowMs), locale)}
            </span>
          </button>

          {/* Compact Color Legend */}
          <div className="hidden 2xl:flex items-center gap-2.5 pl-2 border-l border-[var(--border-subtle)] font-mono-code text-[9.5px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--ok)]" />
              Completed
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
              Ongoing
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--warn)]" />
              Suspended
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--err)]" />
              {t.projects.overdueLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop / Tablet Full-Width Hierarchical Gantt Chart */}
      <div className="hidden md:block w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
        <div ref={scrollContainerRef} className="overflow-x-auto w-full">
          <div
            style={{ minWidth: `${310 + trackMinWidthPx}px` }}
            className="w-full flex flex-col"
          >
            {/* Gantt Sticky Header */}
            <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] sticky top-0 z-20">
              <div className="w-[235px] lg:w-[310px] shrink-0 sticky left-0 z-30 bg-[var(--bg-canvas)] border-r border-[var(--border-subtle)] px-3.5 py-2 flex items-center justify-between">
                <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Project / Task Hierarchy
                </span>
                <span className="font-mono-code text-[9.5px] text-[var(--text-muted)] tnum">
                  {filteredTasks.length} {t.nav.tasks}
                </span>
              </div>

              <div className="flex-1 flex flex-col relative">
                {/* Month Tier */}
                <div className="relative h-6 border-b border-[var(--border-subtle)]">
                  {monthTicks.map((m) => (
                    <div
                      key={m.key}
                      style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                      className="absolute inset-y-0 border-l border-[var(--border-subtle)] px-2 flex items-center font-mono-code text-[10px] font-bold text-[var(--text-ink2)] truncate"
                    >
                      {m.label}
                    </div>
                  ))}
                </div>

                {/* Week / Date Sub-ticks Tier */}
                {subTicks.length > 0 && (
                  <div className="relative h-5">
                    {subTicks.map((st) => (
                      <div
                        key={st.key}
                        style={{ left: `${st.leftPct}%` }}
                        className="absolute inset-y-0 border-l border-[var(--border-subtle)]/60 pl-1 flex items-center font-mono-code text-[9px] text-[var(--text-muted)] whitespace-nowrap"
                      >
                        {st.label}
                      </div>
                    ))}
                  </div>
                )}

                {/* Today Marker Header Tag */}
                <div
                  style={{ left: `${todayPct}%` }}
                  className="pointer-events-none absolute bottom-0 -translate-x-1/2 px-1.5 py-0.5 rounded-t bg-[var(--err)] text-white dark:text-[#161A26] font-mono-code text-[8.5px] font-bold z-20"
                >
                  TODAY
                </div>
              </div>
            </div>

            {/* Gantt Body Rows */}
            <div className="relative divide-y divide-[var(--border-subtle)]">
              {projectGroups.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                  No tasks match your current filters.
                </div>
              ) : (
                projectGroups.map((group) => {
                  const expanded = isProjectExpanded(group.projectKey);
                  const groupName = group.project?.name || t.projects.unassignedProject;
                  const pIdx = group.project ? (projectIndexMap.get(group.project.id) ?? 0) : 0;
                  const borderCls = PROJECT_ACCENT_BORDERS[pIdx % PROJECT_ACCENT_BORDERS.length];
                  const barAccentCls = PROJECT_BAR_ACCENTS[pIdx % PROJECT_BAR_ACCENTS.length];
                  const pct =
                    group.totalCount > 0
                      ? Math.round((group.completedCount / group.totalCount) * 100)
                      : 0;

                  // Project summary date span
                  const projStartMs = group.project
                    ? new Date(group.project.startDate).getTime()
                    : Math.min(...group.rows.map((r) => new Date(r.task.startDate).getTime()));
                  const projEndMs = group.project
                    ? new Date(group.project.endDate).getTime()
                    : Math.max(...group.rows.map((r) => new Date(r.task.endDate).getTime()));
                  const pLeftPct = Math.max(0, Math.min(96, ((projStartMs - minMs) / totalSpanMs) * 100));
                  const pWidthPct = Math.max(
                    2.5,
                    Math.min(100 - pLeftPct, ((Math.max(projEndMs, projStartMs + 86_400_000) - projStartMs) / totalSpanMs) * 100)
                  );

                  return (
                    <Fragment key={`tl-group-${group.projectKey}`}>
                      {/* Level 0: Project Summary Row */}
                      <div className="flex items-stretch bg-[var(--bg-subtle)]/55 hover:bg-[var(--bg-subtle)]/80 transition-colors">
                        <div
                          className={`w-[235px] lg:w-[310px] shrink-0 sticky left-0 z-10 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] border-l-4 ${borderCls} px-2.5 py-2 flex items-center justify-between gap-2`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedProjects((prev) => ({
                                  ...prev,
                                  [group.projectKey]: !expanded,
                                }))
                              }
                              aria-label={`Toggle timeline ${groupName}`}
                              className="p-0.5 rounded text-[var(--text-ink2)] hover:text-[var(--brand)] cursor-pointer shrink-0"
                            >
                              {expanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedProjects((prev) => ({
                                    ...prev,
                                    [group.projectKey]: !expanded,
                                  }))
                                }
                                className="font-heading font-bold text-xs text-[var(--text-ink)] hover:text-[var(--brand)] truncate block text-left max-w-[180px] cursor-pointer"
                              >
                                {groupName}
                              </button>
                              <p className="font-mono-code text-[9.5px] text-[var(--text-muted)] tnum">
                                {group.completedCount}/{group.totalCount} Tasks · {pct}%
                              </p>
                            </div>
                          </div>

                          {group.project && onCreateTaskInProject && (
                            <button
                              type="button"
                              onClick={() => onCreateTaskInProject(group.project!.id)}
                              title={t.projects.newTask}
                              className="p-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-[var(--brand)] cursor-pointer shrink-0"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Project Summary Span Bar */}
                        <div className="flex-1 relative min-h-[44px] flex items-center">
                          {/* Today Vertical Line */}
                          <div
                            style={{ left: `${todayPct}%` }}
                            className="pointer-events-none absolute inset-y-0 w-[1.5px] bg-[var(--err)]/70 z-10"
                          />

                          <div
                            style={{ left: `${pLeftPct}%`, width: `${pWidthPct}%` }}
                            title={`${groupName} (${formatShortDate(new Date(projStartMs), locale)} → ${formatShortDate(new Date(projEndMs), locale)})`}
                            className={`absolute h-6 rounded-lg border px-2 flex items-center justify-between gap-2 overflow-hidden ${barAccentCls}`}
                          >
                            <span className="font-heading font-bold text-[10.5px] truncate">
                              {groupName}
                            </span>
                            <span className="font-mono-code text-[9px] font-bold whitespace-nowrap tnum shrink-0">
                              {pct}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Level 1 & Level 2: Main Tasks and Subtasks */}
                      {expanded &&
                        group.rows.map(({ task, depth, childCount }) => {
                          if (depth > 0 && task.parentId && !isParentExpanded(task.parentId)) {
                            return null;
                          }

                          const ts = new Date(task.startDate).getTime();
                          const te = new Date(task.endDate).getTime();
                          const done = task.status === "Completed" || task.status === "Done";
                          const overdue = !done && te < nowMs;

                          const leftPct = Math.max(
                            0,
                            Math.min(97, ((ts - minMs) / totalSpanMs) * 100)
                          );
                          const widthPct = Math.max(
                            1.8,
                            Math.min(
                              100 - leftPct,
                              ((Math.max(te, ts + 86_400_000) - ts) / totalSpanMs) * 100
                            )
                          );

                          const barColorCls = done
                            ? "bg-[var(--ok)] text-white dark:text-[#161A26]"
                            : overdue
                              ? "bg-[var(--err)] text-white dark:text-[#161A26]"
                              : task.status === "Suspended"
                                ? "bg-[var(--warn)] text-white dark:text-[#161A26]"
                                : "bg-[var(--brand)] text-white dark:text-[#161A26]";

                          const dotColorCls = done
                            ? "bg-[var(--ok)]"
                            : overdue
                              ? "bg-[var(--err)]"
                              : task.status === "Suspended"
                                ? "bg-[var(--warn)]"
                                : "bg-[var(--brand)]";

                          // Schedule variance label for completed tasks with actualEndDate
                          let varianceTag: string | null = null;
                          if (done && task.actualEndDate) {
                            const actMs = new Date(task.actualEndDate).getTime();
                            const diffD = Math.round((te - actMs) / 86_400_000);
                            if (diffD > 0) varianceTag = `-${diffD}d`;
                            else if (diffD < 0) varianceTag = `+${Math.abs(diffD)}d`;
                          }

                          const execNames = getTaskExecutorNames(task);

                          return (
                            <div
                              key={`tl-row-${task.id}`}
                              data-timeline-task={task.id}
                              onClick={() => onSelectTask(task)}
                              className={`flex items-stretch cursor-pointer transition-colors hover:bg-[var(--bg-subtle)]/40 ${
                                depth > 0 ? "bg-[var(--bg-canvas)]/60" : ""
                              }`}
                            >
                              {/* Pinned Task Title Column */}
                              <div className="w-[235px] lg:w-[310px] shrink-0 sticky left-0 z-10 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] px-2.5 py-2 flex items-center justify-between gap-2">
                                <div
                                  className="flex items-center gap-1.5 min-w-0"
                                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                                >
                                  {depth > 0 ? (
                                    <CornerDownRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                                  ) : childCount > 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedParents((prev) => ({
                                          ...prev,
                                          [task.id]: !isParentExpanded(task.id),
                                        }));
                                      }}
                                      className="p-0.5 text-[var(--text-muted)] hover:text-[var(--brand)] cursor-pointer shrink-0"
                                      aria-label={`Toggle ${task.title}`}
                                    >
                                      {isParentExpanded(task.id) ? (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColorCls}`} />
                                  )}

                                  <div className="min-w-0">
                                    <p
                                      className={`text-xs truncate ${
                                        depth === 0
                                          ? "font-semibold text-[var(--text-ink)]"
                                          : "font-normal text-[var(--text-ink2)]"
                                      }`}
                                      title={task.title}
                                    >
                                      {task.title}
                                    </p>
                                    <p className="font-mono-code text-[9.5px] text-[var(--text-muted)] truncate tnum">
                                      {formatShortDate(task.startDate, locale)} →{" "}
                                      {formatShortDate(task.endDate, locale)}
                                      {execNames[0] ? ` · ${execNames[0]}` : ""}
                                    </p>
                                  </div>
                                </div>

                                <span
                                  className={`font-mono-code text-[8.5px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${getStatusPillClass(
                                    task.status
                                  )}`}
                                >
                                  {overdue ? "LATE" : task.status === "Not Started" ? "TODO" : task.status.slice(0, 4).toUpperCase()}
                                </span>
                              </div>

                              {/* Gantt Task Bar Track */}
                              <div className="flex-1 relative min-h-[42px] flex items-center">
                                {subTicks.map((st) => (
                                  <div
                                    key={`grid-${task.id}-${st.key}`}
                                    style={{ left: `${st.leftPct}%` }}
                                    className="pointer-events-none absolute inset-y-0 border-l border-[var(--border-subtle)]/35"
                                  />
                                ))}

                                {/* Today Vertical Marker */}
                                <div
                                  style={{ left: `${todayPct}%` }}
                                  className="pointer-events-none absolute inset-y-0 w-[1.5px] bg-[var(--err)]/70 z-10"
                                />

                                <div
                                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                  title={`${task.title} · ${task.status} (${formatShortDate(
                                    task.startDate,
                                    locale
                                  )} → ${formatShortDate(task.endDate, locale)})${
                                    execNames.length ? ` · ${execNames.join(", ")}` : ""
                                  }`}
                                  className={`absolute ${
                                    depth === 0 ? "h-5 rounded-full" : "h-3.5 rounded-full opacity-85"
                                  } ${barColorCls} px-2 flex items-center gap-1.5 shadow-2xs overflow-hidden`}
                                >
                                  <span className="font-semibold text-[9.5px] truncate">
                                    {task.title}
                                  </span>
                                  {varianceTag && (
                                    <span className="font-mono-code text-[8.5px] font-bold bg-black/20 px-1 rounded shrink-0 tnum">
                                      {varianceTag}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </Fragment>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Responsive Timeline Cards (< md, Grouped cleanly by Project) */}
      <div className="md:hidden space-y-3">
        {projectGroups.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl py-8 text-center text-xs text-[var(--text-muted)]">
            No tasks match your current filters.
          </div>
        ) : (
          projectGroups.map((group) => {
            const groupName = group.project?.name || t.projects.unassignedProject;
            const pIdx = group.project ? (projectIndexMap.get(group.project.id) ?? 0) : 0;
            const borderCls = PROJECT_ACCENT_BORDERS[pIdx % PROJECT_ACCENT_BORDERS.length];
            const pct =
              group.totalCount > 0
                ? Math.round((group.completedCount / group.totalCount) * 100)
                : 0;

            return (
              <div key={`mob-tl-${group.projectKey}`} className="space-y-2">
                <div
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] border-l-4 ${borderCls}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderKanban className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
                    <span className="font-heading font-bold text-xs text-[var(--text-ink)] truncate">
                      {groupName}
                    </span>
                  </div>
                  <span className="font-mono-code text-[10px] font-bold text-[var(--brand)] tnum shrink-0">
                    {group.completedCount}/{group.totalCount} · {pct}%
                  </span>
                </div>

                <div className="space-y-2">
                  {group.rows.map(({ task, depth }) => {
                    const te = new Date(task.endDate).getTime();
                    const done = task.status === "Completed" || task.status === "Done";
                    const overdue = !done && te < nowMs;
                    const barColorCls = done
                      ? "bg-[var(--ok)]"
                      : overdue
                        ? "bg-[var(--err)]"
                        : task.status === "Suspended"
                          ? "bg-[var(--warn)]"
                          : "bg-[var(--brand)]";

                    return (
                      <div
                        key={`mob-tl-task-${task.id}`}
                        onClick={() => onSelectTask(task)}
                        style={{ marginLeft: `${Math.min(depth + 1, 3) * 10}px` }}
                        className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-2 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-xs text-[var(--text-ink)]">
                            {depth > 0 ? "↳ " : ""}
                            {task.title}
                          </span>
                          <span
                            className={`font-mono-code text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getStatusPillClass(
                              task.status
                            )}`}
                          >
                            {overdue ? t.projects.overdueLabel : task.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono-code text-[10px] text-[var(--text-muted)] tnum">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>
                            {formatShortDate(task.startDate, locale)} →{" "}
                            {formatShortDate(task.endDate, locale)}
                          </span>
                        </div>

                        <div className="h-1.5 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColorCls}`}
                            style={{ width: done ? "100%" : task.status === "Ongoing" ? "55%" : "18%" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
