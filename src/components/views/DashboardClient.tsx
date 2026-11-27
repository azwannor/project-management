"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { format, startOfMonth } from "date-fns";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  Moon,
  Printer,
  Sun,
  Users,
} from "lucide-react";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import { ThemedDateRangePicker } from "@/components/ui/ThemedDateRangePicker";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/i18n";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useBoardroom } from "@/components/providers/BoardroomProvider";
import { formatDurationCompact, formatShortDate } from "@/lib/format";
import {
  type DashboardDataset,
  type DashboardPeriod,
  type ProjectHealth,
  type RoadmapProjectItem,
  type TeamMemberRow,
  computeBlockerRadar,
  computeEffortSplit,
  computeExecutiveKpis,
  computeMyActionQueue,
  computeProjectRoadmap,
  computeSupportVolumeSeries,
  computeTeamMatrix,
  filterDatasetByMember,
  getPeriodWindow,
  isDoneStatus,
  toDate,
} from "@/lib/kpi-engine";
import { exportExecutiveWorkbook } from "@/lib/export-executive";

interface DashboardClientProps {
  currentUser: {
    id: string;
    name: string;
    jobDesk?: string | null;
    role: string;
  };
  dataset: DashboardDataset;
  generatedAtIso: string;
}

const PERIOD_OPTIONS: DashboardPeriod[] = [
  "THIS_MONTH",
  "THIS_QUARTER",
  "THIS_YEAR",
  "ALL_TIME",
  "CUSTOM",
];

function computeTimelineElapsedPct(startIso: string, endIso: string, nowMs: number): number {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return 100;
  }
  const pct = Math.round(((nowMs - startMs) / (endMs - startMs)) * 100);
  return Math.min(100, Math.max(10, pct));
}

function formatShortDayMonth(value: string | Date, locale: "en" | "id"): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d
    .toLocaleDateString(locale === "id" ? "id-ID" : "en-GB", {
      day: "2-digit",
      month: "short",
    })
    .toUpperCase();
}

function getMonthColumns(startMs: number, endMs: number, locale: "en" | "id") {
  const cols: Array<{ key: string; label: string; leftPct: number }> = [];
  const total = Math.max(1, endMs - startMs);
  const start = new Date(startMs);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  if (cursor.getTime() < startMs) {
    cursor.setMonth(cursor.getMonth() + 1);
  }
  while (cursor.getTime() <= endMs && cols.length < 12) {
    const leftPct = ((cursor.getTime() - startMs) / total) * 100;
    cols.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: cursor
        .toLocaleDateString(locale === "id" ? "id-ID" : "en-US", { month: "short" })
        .toUpperCase(),
      leftPct: Math.max(0, Math.min(96, leftPct)),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  if (cols.length === 0) {
    cols.push({
      key: "curr",
      label: start
        .toLocaleDateString(locale === "id" ? "id-ID" : "en-US", { month: "short" })
        .toUpperCase(),
      leftPct: 8,
    });
  }
  return cols;
}

function getWorkItemBadge(
  wi: TeamMemberRow["workItems"][number],
  nowMs: number,
  labels: { breach: string; overdue: string; due: string; ongoing: string }
) {
  const endMs = new Date(wi.endDate).getTime();
  if (wi.isOverdue) {
    return {
      text: wi.kind === "TICKET" ? labels.breach : labels.overdue,
      cls: "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]",
      barCls: "bg-[var(--err)]",
    };
  }
  const daysLeft = Math.ceil((endMs - nowMs) / 86_400_000);
  if (daysLeft <= 2) {
    return {
      text: `${labels.due} ${Math.max(0, daysLeft)}D`,
      cls: "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]",
      barCls: "bg-[var(--warn)]",
    };
  }
  return {
    text: labels.ongoing,
    cls: "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]",
    barCls: "bg-[var(--brand)]",
  };
}

function AssetDonutRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="relative w-[108px] h-[108px] shrink-0 flex items-center justify-center">
      <svg viewBox="0 0 108 108" className="w-full h-full -rotate-90">
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke="var(--bg-subtle)"
          strokeWidth="10"
        />
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke="var(--ok)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading font-extrabold text-xl text-[var(--text-ink)] tnum">
          {Math.round(clamped)}%
        </span>
      </div>
    </div>
  );
}

function MemberTimelineCard({
  member: m,
  isExpanded,
  onToggle,
  nowMs,
  locale,
  labels,
  compact = false,
}: {
  member: TeamMemberRow;
  isExpanded: boolean;
  onToggle: () => void;
  nowMs: number;
  locale: "en" | "id";
  labels: {
    breach: string;
    overdue: string;
    due: string;
    ongoing: string;
    activeTag: string;
    ticketsLabel: string;
    tasksLabel: string;
    mttrLabel: string;
  };
  compact?: boolean;
}) {
  if (!isExpanded || m.workItems.length === 0) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <span className="font-semibold text-xs text-[var(--text-ink)] truncate">{m.name}</span>
          <span className="font-mono-code text-[9.5px] font-bold uppercase px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-ink2)] shrink-0">
            {m.jobDesk}
          </span>
        </div>
        <div className="font-mono-code text-[10.5px] text-[var(--text-muted)] tnum">
          {m.workItems.length} {labels.activeTag} · {m.tasksDone} {labels.tasksLabel} ·{" "}
          {m.ticketsResolved} {labels.ticketsLabel} · {formatDurationCompact(m.avgMttrMinutes * 60)}{" "}
          {labels.mttrLabel}
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--bg-canvas)] border border-[var(--brand-stroke)] p-3.5 space-y-2.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)] text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
          <span className="font-heading font-bold text-[13px] text-[var(--text-ink)] truncate">
            {m.name}
          </span>
          <span className="font-mono-code text-[9.5px] font-bold uppercase px-2 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] shrink-0">
            {m.jobDesk}
          </span>
        </div>
        <span className="font-mono-code text-[10.5px] font-semibold text-[var(--text-ink2)] tnum">
          {m.workItems.length} {labels.activeTag} ·{" "}
          {m.ticketsResolved > m.tasksDone
            ? `${m.ticketsResolved} ${labels.ticketsLabel}`
            : `${m.tasksDone} ${labels.tasksLabel}`}{" "}
          · {formatDurationCompact(m.avgMttrMinutes * 60)} {labels.mttrLabel}
        </span>
      </button>

      <div className="space-y-1.5">
        {m.workItems.slice(0, compact ? 3 : 5).map((wi) => {
          const pct = wi.isOverdue
            ? 100
            : computeTimelineElapsedPct(wi.startDate, wi.endDate, nowMs);
          const badge = getWorkItemBadge(wi, nowMs, labels);
          return (
            <div
              key={wi.id}
              className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2 sm:gap-3 px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
            >
              <div className="sm:col-span-5 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-ink)] truncate">{wi.title}</p>
                <p className="font-mono-code text-[10px] text-[var(--text-muted)] truncate">
                  {wi.contextName} · {wi.priority.toUpperCase()}
                </p>
              </div>

              <div className="sm:col-span-4 space-y-1">
                <div className="flex items-center justify-between font-mono-code text-[10px] text-[var(--text-ink2)] tnum">
                  <span>
                    {formatShortDayMonth(wi.startDate, locale)} →{" "}
                    {formatShortDayMonth(wi.endDate, locale)}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full flex items-center pl-0.5 ${badge.barCls}`}
                    style={{ width: `${pct}%` }}
                  >
                    <span className="w-1 h-1 rounded-full bg-white/90 shrink-0" />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-3 flex items-center justify-between sm:justify-end gap-2">
                <span className="font-mono-code text-[11px] font-semibold text-[var(--text-ink)] tnum">
                  {formatDurationCompact(m.loggedSeconds > 0 ? m.loggedSeconds : m.avgMttrMinutes * 60)}
                </span>
                <span
                  className={`font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.cls}`}
                >
                  {badge.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoadmapCanvas({
  roadmapProjects,
  windowStartMs,
  windowEndMs,
  todayPct,
  expandedProjectIds,
  onToggleProject,
  locale,
  now,
  t,
}: {
  roadmapProjects: RoadmapProjectItem[];
  windowStartMs: number;
  windowEndMs: number;
  todayPct: number;
  expandedProjectIds: Record<string, boolean>;
  onToggleProject: (id: string) => void;
  locale: "en" | "id";
  now: Date;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const monthCols = useMemo(
    () => getMonthColumns(windowStartMs, windowEndMs, locale),
    [windowStartMs, windowEndMs, locale]
  );
  const totalSpan = Math.max(1, windowEndMs - windowStartMs);

  const healthMeta: Record<
    ProjectHealth,
    { label: string; bar: string; text: string; pill: string }
  > = {
    COMPLETED: {
      label: t.dashboard.completedLabel.toUpperCase(),
      bar: "bg-[var(--ok)]",
      text: "text-[var(--ok)]",
      pill: "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]",
    },
    ON_TRACK: {
      label: t.dashboard.onTrackLabel.toUpperCase(),
      bar: "bg-[var(--brand)]",
      text: "text-[var(--brand)]",
      pill: "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]",
    },
    AT_RISK: {
      label: t.dashboard.atRiskLabel.toUpperCase(),
      bar: "bg-[var(--warn)]",
      text: "text-[var(--warn)]",
      pill: "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]",
    },
    DELAYED: {
      label: t.dashboard.delayedLabel.toUpperCase(),
      bar: "bg-[var(--err)]",
      text: "text-[var(--err)]",
      pill: "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]",
    },
  };

  return (
    <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h2 className="font-heading font-bold text-base sm:text-[17px] text-[var(--text-ink)]">
            {t.dashboard.roadmapTitle}
          </h2>
          <span className="font-mono-code text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] tnum">
            {roadmapProjects.length} {t.dashboard.projectsTag}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono-code text-[10px] font-bold">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-stroke)] text-[var(--ok)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" />
            {t.dashboard.onTrackLabel.toUpperCase()}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--warn-bg)] border border-[var(--warn-stroke)] text-[var(--warn)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--warn)]" />
            {t.dashboard.atRiskLabel.toUpperCase()}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] tnum">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--err)]" />
            {t.dashboard.todayMarker} · {formatShortDayMonth(now, locale)}
          </span>
        </div>
      </div>

      {roadmapProjects.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-6 text-center">
          {t.dashboard.noProjectsMatch}
        </p>
      ) : (
        <>
          {/* Mobile Compact Project Progress Cards (< sm) */}
          <div className="sm:hidden space-y-2">
            {roadmapProjects.map((proj) => {
              const isExpanded = Boolean(expandedProjectIds[proj.id]);
              const meta = healthMeta[proj.health];
              return (
                <div
                  key={`mob-${proj.id}`}
                  className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-2"
                >
                  <button
                    type="button"
                    onClick={() => onToggleProject(proj.id)}
                    className="w-full text-left space-y-1.5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-[var(--text-ink)] truncate">
                        {proj.name}
                      </span>
                      <span
                        className={`font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full border shrink-0 tnum ${meta.pill}`}
                      >
                        {meta.label} · {proj.progressPct}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${meta.bar}`}
                        style={{ width: `${Math.max(8, proj.progressPct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between font-mono-code text-[10px] text-[var(--text-muted)] tnum">
                      <span>
                        {formatShortDayMonth(proj.startDate, locale)} →{" "}
                        {formatShortDayMonth(proj.endDate, locale)}
                      </span>
                      <span>
                        {proj.completedTasks}/{proj.totalTasks} {t.nav.tasks}
                      </span>
                    </div>
                  </button>
                  {isExpanded && proj.mainTasks.length > 0 && (
                    <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1">
                      {proj.mainTasks.slice(0, 5).map((mt) => (
                        <div
                          key={`mob-mt-${mt.id}`}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="text-[var(--text-ink2)] truncate">|-- {mt.title}</span>
                          <span
                            className={`font-mono-code text-[9.5px] font-bold shrink-0 tnum ${
                              mt.isOverdue ? "text-[var(--err)]" : "text-[var(--text-muted)]"
                            }`}
                          >
                            {isDoneStatus(mt.status)
                              ? "DONE"
                              : mt.isOverdue
                              ? t.dashboard.overdueTag
                              : mt.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tablet & Desktop Horizontal TimelineCanvas (>= sm) */}
          <div className="hidden sm:block bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl overflow-x-auto">
            <div className="min-w-[680px]">
            {/* Timeline Column Axis Header */}
            <div className="flex items-center border-b border-[var(--border-subtle)] h-8 px-3">
              <div className="w-[240px] shrink-0 font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t.dashboard.roadmapColumnLabel}
              </div>
              <div className="flex-1 relative h-full">
                {monthCols.map((m) => (
                  <div
                    key={m.key}
                    className="absolute top-0 bottom-0 flex items-center border-l border-[var(--border-subtle)] pl-1.5 font-mono-code text-[10px] font-semibold text-[var(--text-muted)]"
                    style={{ left: `${m.leftPct}%` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="w-[126px] shrink-0 text-right font-mono-code text-[10px] font-bold text-[var(--text-muted)]">
                {t.dashboard.statusCol.toUpperCase()}
              </div>
            </div>

            {/* Project + Inline Main Task Canvas */}
            <div className="relative divide-y divide-[var(--border-subtle)]">
              {/* Vertical Month Gridlines + Vertical Crimson TODAY Line spanning across tracks */}
              <div className="pointer-events-none absolute inset-y-0 left-[252px] right-[138px]">
                {monthCols.map((m) => (
                  <div
                    key={`line-${m.key}`}
                    className="absolute top-0 bottom-0 border-l border-[var(--border-subtle)]/70"
                    style={{ left: `${m.leftPct}%` }}
                  />
                ))}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[var(--err)]/85 z-10"
                  style={{ left: `${todayPct}%` }}
                />
              </div>

              {roadmapProjects.map((proj) => {
                const isExpanded = Boolean(expandedProjectIds[proj.id]);
                const meta = healthMeta[proj.health];
                const startMs = new Date(proj.startDate).getTime();
                const endMs = new Date(proj.endDate).getTime();
                const leftPct = Math.max(0, Math.min(92, ((startMs - windowStartMs) / totalSpan) * 100));
                const rawWidth =
                  ((Math.max(endMs, startMs + 5 * 86_400_000) - startMs) / totalSpan) * 100;
                const widthPct = Math.max(8, Math.min(100 - leftPct, rawWidth));

                return (
                  <div key={proj.id} className="relative">
                    <button
                      type="button"
                      onClick={() => onToggleProject(proj.id)}
                      className="w-full flex items-center px-3 py-2.5 hover:bg-[var(--bg-subtle)]/50 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-[240px] shrink-0 pr-3 flex items-center gap-1.5 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                        )}
                        <span className="font-semibold text-[12.5px] text-[var(--text-ink)] truncate">
                          {proj.name}
                        </span>
                      </div>

                      <div className="flex-1 relative h-6">
                        {/* Pill Gantt Bar with Start Anchor Dot */}
                        <div
                          className="absolute top-0 bottom-0 rounded-full bg-[var(--border-strong)]/40 overflow-hidden flex items-center"
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        >
                          <div
                            className={`h-full rounded-full ${meta.bar} flex items-center pl-1.5`}
                            style={{ width: `${Math.max(18, proj.progressPct)}%` }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white/95 shrink-0" />
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-[126px] shrink-0 text-right font-mono-code text-[10.5px] font-bold tnum ${meta.text}`}
                      >
                        {proj.health === "COMPLETED" && proj.actualEndDate
                          ? `${meta.label} · ${formatShortDayMonth(proj.actualEndDate, locale)}`
                          : `${meta.label} · ${proj.progressPct}%`}
                      </div>
                    </button>

                    {/* Indented Inline Main Tasks (FigCraft |-- Main Task Timeline Bars) */}
                    {isExpanded && proj.mainTasks.length > 0 && (
                      <div className="bg-[var(--bg-surface)]/55 border-t border-[var(--border-subtle)]/70 divide-y divide-[var(--border-subtle)]/50">
                        {proj.mainTasks.slice(0, 8).map((mt) => {
                          const mtStart = new Date(mt.startDate).getTime();
                          const mtEnd = new Date(mt.endDate).getTime();
                          const mtLeft = Math.max(
                            0,
                            Math.min(92, ((mtStart - windowStartMs) / totalSpan) * 100)
                          );
                          const mtWidth = Math.max(
                            6,
                            Math.min(
                              100 - mtLeft,
                              ((Math.max(mtEnd, mtStart + 3 * 86_400_000) - mtStart) / totalSpan) *
                                100
                            )
                          );
                          const done = isDoneStatus(mt.status);
                          const taskBarCls = done
                            ? "bg-[var(--lavender)]"
                            : mt.isOverdue
                            ? "bg-[var(--err)]"
                            : "bg-[var(--brand)]";

                          return (
                            <div key={mt.id} className="flex items-center px-3 py-1.5 text-[11.5px]">
                              <div className="w-[240px] shrink-0 pr-3 pl-4 flex items-center gap-1.5 min-w-0 text-[var(--text-ink2)]">
                                <span className="font-mono-code text-[var(--text-muted)] shrink-0">
                                  |--
                                </span>
                                <span className="truncate">{mt.title}</span>
                              </div>
                              <div className="flex-1 relative h-4">
                                <div
                                  className={`absolute top-0 bottom-0 rounded-full ${taskBarCls} opacity-90 flex items-center pl-1`}
                                  style={{ left: `${mtLeft}%`, width: `${mtWidth}%` }}
                                >
                                  <span className="w-1 h-1 rounded-full bg-white/95 shrink-0" />
                                </div>
                              </div>
                              <div
                                className={`w-[126px] shrink-0 text-right font-mono-code text-[10px] font-semibold tnum ${
                                  mt.isOverdue
                                    ? "text-[var(--err)]"
                                    : done
                                    ? "text-[var(--lavender)]"
                                    : "text-[var(--text-muted)]"
                                }`}
                              >
                                {done
                                  ? `DONE · ${formatShortDayMonth(mt.actualEndDate || mt.endDate, locale)}`
                                  : mt.isOverdue
                                  ? `${t.dashboard.overdueTag} · ${formatShortDayMonth(mt.endDate, locale)}`
                                  : `${mt.status.toUpperCase()}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </>
      )}
    </section>
  );
}

export default function DashboardClient({
  currentUser,
  dataset,
  generatedAtIso,
}: DashboardClientProps) {
  const { locale, setLocale, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { isBoardroom, setBoardroom, toggleBoardroom } = useBoardroom();

  const [period, setPeriod] = useState<DashboardPeriod>("ALL_TIME");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [memberId, setMemberId] = useState<string>("ALL");
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});
  const [teamViewMode, setTeamViewMode] = useState<"SUMMARY" | "TIMELINE">("TIMELINE");
  const [userExpandedOverrides, setUserExpandedOverrides] = useState<Record<string, boolean>>({});
  const [isExporting, setIsExporting] = useState(false);

  const now = useMemo(() => new Date(generatedAtIso), [generatedAtIso]);
  const nowMs = now.getTime();
  const currentQuarterLabel = `Q${Math.floor(now.getMonth() / 3) + 1} · ${now.getFullYear()}`;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isBoardroom) {
        setBoardroom(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isBoardroom, setBoardroom]);

  const activeUsers = useMemo(
    () => dataset.users.filter((u) => u.isActive !== false),
    [dataset.users]
  );

  const periodWindow = useMemo(
    () => getPeriodWindow(period, customStart, customEnd, now),
    [period, customStart, customEnd, now]
  );

  const kpis = useMemo(
    () => computeExecutiveKpis(dataset, periodWindow, memberId, now),
    [dataset, periodWindow, memberId, now]
  );

  const roadmap = useMemo(
    () => computeProjectRoadmap(dataset, memberId, now, periodWindow),
    [dataset, memberId, now, periodWindow]
  );

  const teamRows = useMemo(
    () => computeTeamMatrix(dataset, periodWindow, memberId, now),
    [dataset, periodWindow, memberId, now]
  );

  // Top 2 members with active work default expanded (matching FigCraft Mem/Dwi & Mem/Kevin)
  const defaultExpandedIds = useMemo(() => {
    const ids: Record<string, boolean> = {};
    let count = 0;
    for (const row of teamRows) {
      if (row.workItems.length > 0 && count < 2) {
        ids[row.userId] = true;
        count += 1;
      }
    }
    return ids;
  }, [teamRows]);

  const isMemberExpanded = (uid: string) =>
    userExpandedOverrides[uid] !== undefined
      ? userExpandedOverrides[uid]
      : Boolean(defaultExpandedIds[uid]);

  const toggleUserExpand = (uid: string) => {
    setUserExpandedOverrides((prev) => ({
      ...prev,
      [uid]: !isMemberExpanded(uid),
    }));
  };

  const effortSplit = useMemo(
    () => computeEffortSplit(dataset, periodWindow, memberId),
    [dataset, periodWindow, memberId]
  );

  const blockers = useMemo(
    () => computeBlockerRadar(dataset, memberId, now, periodWindow),
    [dataset, memberId, now, periodWindow]
  );

  const criticalBlockersCount = useMemo(
    () => blockers.filter((b) => b.severity === "CRITICAL").length,
    [blockers]
  );

  const supportVolume = useMemo(
    () => computeSupportVolumeSeries(dataset, periodWindow, memberId),
    [dataset, periodWindow, memberId]
  );

  const upcomingDeliverables = useMemo(() => {
    const scoped = filterDatasetByMember(dataset, memberId);
    const horizon = nowMs + 14 * 86_400_000;
    const list: Array<{ id: string; title: string; date: string; href: string }> = [];

    scoped.tasks
      .filter((t) => !isDoneStatus(t.status))
      .forEach((t) => {
        const end = toDate(t.endDate);
        if (end && end.getTime() >= nowMs && end.getTime() <= horizon) {
          list.push({
            id: `del-t-${t.id}`,
            title: t.title,
            date: end.toISOString(),
            href: t.projectId ? `/projects?projectId=${t.projectId}` : "/projects",
          });
        }
      });

    scoped.maintenanceSchedules
      .filter((ms) => !isDoneStatus(ms.status))
      .forEach((ms) => {
        const due = toDate(ms.nextDueDate);
        if (due && due.getTime() <= horizon) {
          list.push({
            id: `del-m-${ms.id}`,
            title: `${ms.asset?.assetName || "Asset"} · ${ms.template?.templateName || "Maint"}`,
            date: due.toISOString(),
            href: "/maintenance",
          });
        }
      });

    return list
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [dataset, memberId, nowMs]);

  const myQueue = useMemo(
    () => computeMyActionQueue(dataset, currentUser.id, now),
    [dataset, currentUser.id, now]
  );

  const toggleProjectExpand = (id: string) => {
    setExpandedProjectIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePeriodSelect = (next: DashboardPeriod) => {
    setPeriod(next);
    if (next === "CUSTOM" && (!customStart || !customEnd)) {
      setCustomStart(format(startOfMonth(now), "yyyy-MM-dd"));
      setCustomEnd(format(now, "yyyy-MM-dd"));
    }
  };

  const memberSelectOptions = useMemo(
    () => [
      { value: "ALL", label: t.dashboard.allMembers },
      ...activeUsers.map((u) => ({
        value: u.id,
        label: u.name,
        badge: u.jobDesk || u.role,
      })),
    ],
    [activeUsers, t.dashboard.allMembers]
  );

  const periodLabels: Record<DashboardPeriod, string> = {
    THIS_MONTH: t.dashboard.periodThisMonth,
    THIS_QUARTER: t.dashboard.periodThisQuarter,
    THIS_YEAR: t.dashboard.periodThisYear,
    ALL_TIME: t.dashboard.periodAllTime,
    CUSTOM: t.dashboard.periodCustom,
  };

  const periodSelectOptions = PERIOD_OPTIONS.map((opt) => ({
    value: opt,
    label: periodLabels[opt],
  }));

  const handleExport = () => {
    setIsExporting(true);
    try {
      const selectedUser = activeUsers.find((u) => u.id === memberId);
      exportExecutiveWorkbook({
        period,
        memberLabel: selectedUser ? selectedUser.name : t.dashboard.allMembers,
        generatedAt: now,
        kpis,
        roadmap,
        team: teamRows,
        dataset: filterDatasetByMember(dataset, memberId),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const projPct = effortSplit.segments.find((s) => s.key === "PROJECT")?.pct || 0;
  const supPct = effortSplit.segments.find((s) => s.key === "SUPPORT")?.pct || 0;
  const mntPct = effortSplit.segments.find((s) => s.key === "MAINTENANCE")?.pct || 0;
  const totalEffortHrs = Math.round(effortSplit.totalSeconds / 3600);

  const kpiStatusProj =
    kpis.delayedProjects > 0
      ? {
          text: t.dashboard.delayedLabel.toUpperCase(),
          cls: "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]",
        }
      : kpis.atRiskProjects > 0
      ? {
          text: t.dashboard.atRiskLabel.toUpperCase(),
          cls: "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]",
        }
      : {
          text: t.dashboard.onTrackLabel.toUpperCase(),
          cls: "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]",
        };

  const kpiStatusSla =
    kpis.breachedOpenRequestsCount > 0
      ? {
          text: t.dashboard.breachLabel,
          cls: "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]",
        }
      : {
          text: t.dashboard.slaMetBadge,
          cls: "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]",
        };

  const kpiStatusMaint =
    kpis.overdueSchedulesCount > 0
      ? {
          text: t.dashboard.overdueTag,
          cls: "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]",
        }
      : {
          text: t.dashboard.healthyBadge,
          cls: "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]",
        };

  const workItemLabels = {
    breach: t.dashboard.breachLabel,
    overdue: t.dashboard.overdueTag,
    due: t.dashboard.dueInPrefix,
    ongoing: t.dashboard.ongoingLabel,
    activeTag: t.dashboard.activeTag,
    ticketsLabel: t.dashboard.ticketsShort,
    tasksLabel: t.dashboard.tasksShort,
    mttrLabel: t.dashboard.mttrCol,
  };

  return (
    <div className={isBoardroom ? "min-h-screen bg-[var(--bg-canvas)] cad-grid-pattern" : ""}>
      {/* Boardroom Mode Architectural Sticky Header (02D) */}
      {isBoardroom && (
        <div className="no-print sticky top-0 z-40 nimbus-glass border-b border-[var(--border-subtle)] px-4 sm:px-8 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/brand/crown-rmp.png"
              alt="Royal Medica"
              width={26}
              height={20}
              className="w-7 h-5 object-contain shrink-0"
            />
            <span className="font-heading font-bold text-sm sm:text-base tracking-tight text-[var(--text-ink)] truncate">
              {t.dashboard.briefingTitle}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 font-mono-code text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-stroke)] text-[var(--ok)] tnum">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" />
              {currentQuarterLabel} · {t.dashboard.liveBadge}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="hidden md:inline-flex font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] hover:text-[var(--text-ink)] cursor-pointer"
            >
              {t.dashboard.printPdf.toUpperCase()}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="hidden sm:inline-flex font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] hover:text-[var(--text-ink)] cursor-pointer"
            >
              {t.common.exportXlsx.toUpperCase()}
            </button>

            <div className="hidden sm:flex items-center bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-full p-0.5">
              {(["en", "id"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLocale(lang)}
                  className={`font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    locale === lang
                      ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex items-center gap-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-full px-2.5 py-1 font-mono-code text-[10px] font-bold text-[var(--text-ink2)]"
            >
              {theme === "dark" ? (
                <Moon className="w-3.5 h-3.5 text-[var(--brand)]" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-[var(--warn)]" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleBoardroom}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] transition-colors cursor-pointer"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>{t.dashboard.boardroomOff}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Executive Canvas */}
      <div className="w-full px-3 sm:px-5 lg:px-6 py-4 space-y-4">
        {/* Print Header */}
        <div className="hidden print:flex items-center justify-between border-b border-slate-300 pb-3 mb-4">
          <div>
            <p className="font-mono-code text-[10px] uppercase tracking-widest text-slate-600">
              PT. ROYAL MEDICALINK PHARMALAB · INTERNAL IT DIVISION
            </p>
            <h1 className="font-heading font-bold text-xl text-slate-900">
              {t.nav.overview} ({periodLabels[period]})
            </h1>
          </div>
          <span className="font-mono-code text-xs text-slate-600 tnum">
            {formatShortDate(now, locale)}
          </span>
        </div>

        {/* Responsive Executive Action & Period Ribbon (Operational Mode) */}
        {!isBoardroom && (
          <section className="no-print">
            {/* MOBILE (< md): Crisp 2-col Dropdowns + Balanced Single Action Strip */}
            <div className="md:hidden bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <ThemedSelect
                  value={period}
                  onChange={(val) => handlePeriodSelect(val as DashboardPeriod)}
                  options={periodSelectOptions}
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  ariaLabel="Period filter"
                />
                <ThemedSelect
                  value={memberId}
                  onChange={setMemberId}
                  options={memberSelectOptions}
                  icon={<Users className="w-3.5 h-3.5" />}
                  ariaLabel={t.dashboard.allMembers}
                  menuAlign="right"
                />
              </div>

              {period === "CUSTOM" && (
                <ThemedDateRangePicker
                  startDate={customStart}
                  endDate={customEnd}
                  onChange={(s, e) => {
                    setCustomStart(s);
                    setCustomEnd(e);
                  }}
                  locale={locale}
                  anchorDate={now}
                  fullWidth
                />
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-1.5 min-w-0">
                  {blockers.length > 0 && (
                    <a
                      href="#blocker-radar"
                      className="inline-flex items-center gap-1 font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] whitespace-nowrap tnum"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--err)] shrink-0" />
                      {criticalBlockersCount > 0 ? criticalBlockersCount : blockers.length}{" "}
                      {t.dashboard.alertsLabel}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    aria-label={t.common.exportXlsx}
                    title={t.common.exportXlsx}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-[var(--text-ink)] cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    aria-label={t.dashboard.printPdf}
                    title={t.dashboard.printPdf}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-[var(--text-ink)] cursor-pointer shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={toggleBoardroom}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-[#212636] hover:bg-[#2A3145] dark:bg-[var(--brand)] dark:hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>{t.dashboard.boardroomOn}</span>
                </button>
              </div>
            </div>

            {/* TABLET (md .. < xl): Balanced 2-Row Card Container */}
            <div className="hidden md:flex xl:hidden flex-col gap-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={`tab-${opt}`}
                      type="button"
                      onClick={() => handlePeriodSelect(opt)}
                      className={`px-2.5 py-1 rounded-full font-mono-code text-[10.5px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        period === opt
                          ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                          : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                      }`}
                    >
                      {periodLabels[opt]}
                    </button>
                  ))}
                </div>

                <ThemedSelect
                  value={memberId}
                  onChange={setMemberId}
                  options={memberSelectOptions}
                  icon={<Users className="w-3.5 h-3.5" />}
                  ariaLabel={t.dashboard.allMembers}
                  className="w-[200px] shrink-0"
                  menuAlign="right"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  {period === "CUSTOM" && (
                    <ThemedDateRangePicker
                      startDate={customStart}
                      endDate={customEnd}
                      onChange={(s, e) => {
                        setCustomStart(s);
                        setCustomEnd(e);
                      }}
                      locale={locale}
                      anchorDate={now}
                    />
                  )}
                  {blockers.length > 0 && (
                    <a
                      href="#blocker-radar"
                      className="inline-flex items-center gap-1.5 font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] whitespace-nowrap tnum"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--err)] shrink-0" />
                      {criticalBlockersCount > 0 ? criticalBlockersCount : blockers.length}{" "}
                      {t.dashboard.alertsLabel}
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.common.exportXlsx}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{t.dashboard.printPdf}</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleBoardroom}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 bg-[#212636] hover:bg-[#2A3145] dark:bg-[var(--brand)] dark:hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>{t.dashboard.boardroomOn}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* DESKTOP (xl+): Single Clean Horizontal Executive Strip */}
            <div className="hidden xl:flex items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={`dt-${opt}`}
                      type="button"
                      onClick={() => handlePeriodSelect(opt)}
                      className={`px-3 py-1 rounded-full font-mono-code text-[10.5px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        period === opt
                          ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                          : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                      }`}
                    >
                      {periodLabels[opt]}
                    </button>
                  ))}
                </div>

                {period === "CUSTOM" && (
                  <ThemedDateRangePicker
                    startDate={customStart}
                    endDate={customEnd}
                    onChange={(s, e) => {
                      setCustomStart(s);
                      setCustomEnd(e);
                    }}
                    locale={locale}
                    anchorDate={now}
                  />
                )}

                <ThemedSelect
                  value={memberId}
                  onChange={setMemberId}
                  options={memberSelectOptions}
                  icon={<Users className="w-3.5 h-3.5" />}
                  ariaLabel={t.dashboard.allMembers}
                  className="min-w-[165px]"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {blockers.length > 0 && (
                  <a
                    href="#blocker-radar"
                    className="inline-flex items-center gap-1.5 font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] whitespace-nowrap tnum"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--err)]" />
                    {criticalBlockersCount > 0 ? criticalBlockersCount : blockers.length}{" "}
                    {t.dashboard.alertsLabel}
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.common.exportXlsx}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t.dashboard.printPdf}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleBoardroom}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 bg-[#212636] hover:bg-[#2A3145] dark:bg-[var(--brand)] dark:hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>{t.dashboard.boardroomOn}</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Row 1: KPI Cards — Mobile 2x2 Compact Grid (02C) & Desktop/Tablet 4-Card Row (02A/02D) */}
        <section className="grid sm:hidden grid-cols-2 gap-2.5">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 space-y-1">
            <span className="font-mono-code text-[10px] font-bold uppercase text-[var(--text-muted)] block">
              ON-TIME
            </span>
            <span className="font-heading font-extrabold text-2xl text-[var(--ok)] tnum block">
              {kpis.projectOnTimeRate}%
            </span>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 space-y-1">
            <span className="font-mono-code text-[10px] font-bold uppercase text-[var(--text-muted)] block">
              {t.dashboard.mttrCol}
            </span>
            <span className="font-heading font-extrabold text-2xl text-[var(--brand)] tnum block">
              {formatDurationCompact(kpis.mttrMinutes * 60)}
            </span>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 space-y-1">
            <span className="font-mono-code text-[10px] font-bold uppercase text-[var(--text-muted)] block">
              {t.nav.maintenance.toUpperCase()}
            </span>
            <span className="font-heading font-extrabold text-2xl text-[var(--ok)] tnum block">
              {kpis.assetHealthRate}%
            </span>
          </div>
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 space-y-1">
            <span className="font-mono-code text-[10px] font-bold uppercase text-[var(--text-muted)] block">
              EFFORT PROJ
            </span>
            <span className="font-heading font-extrabold text-2xl text-[var(--brand)] tnum block">
              {projPct}%
            </span>
          </div>
        </section>

        <section className="hidden sm:grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Project On-Time Rate */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-code text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t.dashboard.kpiOnTime.toUpperCase()}
              </span>
              <span
                className={`font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${kpiStatusProj.cls}`}
              >
                {kpiStatusProj.text}
              </span>
            </div>
            <div className="font-heading font-extrabold text-[30px] leading-tight text-[var(--text-ink)] tnum">
              {kpis.projectOnTimeRate}%
            </div>
            <div className="font-mono-code text-[11px] font-semibold text-[var(--ok)] tnum truncate">
              {kpis.projectOnTimeDelta !== null
                ? `${kpis.projectOnTimeDelta >= 0 ? "+" : ""}${kpis.projectOnTimeDelta}% ${t.dashboard.vsPrevPeriod}`
                : t.dashboard.noBaseline}{" "}
              · {kpis.projectOnTimeCount}/{kpis.projectCompletedCount} {t.nav.tasks}
            </div>
          </div>

          {/* Card 2: Support SLA & MTTR (Hero = MTTR) */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-code text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t.dashboard.kpiSla.toUpperCase()}
              </span>
              <span
                className={`font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${kpiStatusSla.cls}`}
              >
                {kpiStatusSla.text}
              </span>
            </div>
            <div className="font-heading font-extrabold text-[30px] leading-tight text-[var(--text-ink)] tnum">
              {formatDurationCompact(kpis.mttrMinutes * 60)}
            </div>
            <div className="font-mono-code text-[11px] font-semibold text-[var(--brand)] tnum truncate">
              {kpis.supportSlaRate}% SLA Met · {kpis.supportResolvedCount} Requests
            </div>
          </div>

          {/* Card 3: Maintenance Health */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-code text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t.dashboard.kpiMaint.toUpperCase()}
              </span>
              <span
                className={`font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${kpiStatusMaint.cls}`}
              >
                {kpiStatusMaint.text}
              </span>
            </div>
            <div className="font-heading font-extrabold text-[30px] leading-tight text-[var(--text-ink)] tnum">
              {kpis.assetHealthRate}%
            </div>
            <div className="font-mono-code text-[11px] font-semibold text-[var(--ok)] tnum truncate">
              {kpis.activeAssetsCount}/{kpis.totalAssetsCount} {t.dashboard.activeTag} ·{" "}
              {kpis.inRepairAssetsCount} {t.dashboard.inRepairTag}
            </div>
          </div>

          {/* Card 4: Effort Allocation + Stacked Multi-Color Split Bar */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-code text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t.dashboard.kpiEffort.toUpperCase()}
              </span>
              <span className="font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-ink2)] shrink-0 tnum">
                {effortSplit.mode === "HOURS"
                  ? `${totalEffortHrs}H LOG`
                  : `${effortSplit.totalOperations} OPS`}
              </span>
            </div>
            <div className="font-heading font-extrabold text-[28px] leading-tight text-[var(--text-ink)] tnum">
              {Math.round(projPct)}% / {Math.round(supPct)}%
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden flex">
              <div className="h-full bg-[var(--brand)]" style={{ width: `${projPct}%` }} />
              <div className="h-full bg-[var(--ok)]" style={{ width: `${supPct}%` }} />
              <div className="h-full bg-[var(--warn)]" style={{ width: `${mntPct}%` }} />
            </div>
            <div className="font-mono-code text-[10.5px] text-[var(--text-ink2)] tnum truncate">
              {Math.round(projPct)}% Proj · {Math.round(supPct)}% Sup · {Math.round(mntPct)}% Maint
            </div>
          </div>
        </section>

        {/* BOARDROOM MODE LAYOUT (02D): Exec Split (Roadmap 7 cols + Blocker/Asset Donut 5 cols) + 2-Col Team */}
        {isBoardroom ? (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7">
                <RoadmapCanvas
                  roadmapProjects={roadmap.projects}
                  windowStartMs={roadmap.windowStartMs}
                  windowEndMs={roadmap.windowEndMs}
                  todayPct={roadmap.todayPct}
                  expandedProjectIds={expandedProjectIds}
                  onToggleProject={toggleProjectExpand}
                  locale={locale}
                  now={now}
                  t={t}
                />
              </div>

              <div className="lg:col-span-5 flex flex-col gap-4">
                {/* Blocker Radar */}
                <div
                  id="blocker-radar"
                  className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-heading font-bold text-base text-[var(--text-ink)]">
                      {t.dashboard.blockerTitle}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 font-mono-code text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] tnum">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--err)]" />
                      {blockers.length} {t.dashboard.activeTag}
                    </span>
                  </div>

                  {blockers.length === 0 ? (
                    <p className="text-xs text-[var(--ok)] py-4 text-center">
                      {t.dashboard.noBlockers}
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {blockers.slice(0, 5).map((b) => (
                        <div
                          key={b.id}
                          className="rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] p-2.5 space-y-0.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[var(--text-ink)] truncate">
                              {b.title}
                            </span>
                            <span className="font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] shrink-0">
                              {b.code}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] truncate">
                            {b.owner} · {b.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Asset & Maintenance Health Donut Card (exact 02D Asset Dark parity) */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 flex items-center gap-5">
                  <AssetDonutRing percent={kpis.assetHealthRate} />
                  <div className="flex-1 min-w-0 space-y-2">
                    <h3 className="font-heading font-bold text-sm text-[var(--text-ink)] truncate">
                      {t.dashboard.assetMaintHealthTitle}
                    </h3>
                    <div className="space-y-1.5 font-mono-code text-[10.5px] tnum">
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                        <span className="text-[var(--text-ink2)]">
                          {t.dashboard.activeInRepairLabel}
                        </span>
                        <span className="font-bold text-[var(--ok)]">
                          {kpis.activeAssetsCount} / {kpis.inRepairAssetsCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                        <span className="text-[var(--text-ink2)]">
                          {t.dashboard.qrStickeredLabel}
                        </span>
                        <span className="font-bold text-[var(--brand)]">
                          {kpis.qrStickeredCount} / {kpis.totalAssetsCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                        <span className="text-[var(--text-ink2)]">
                          {t.dashboard.dueNext7DaysLabel}
                        </span>
                        <span className="font-bold text-[var(--warn)]">
                          {String(kpis.dueSoonSchedulesCount).padStart(2, "0")}{" "}
                          {t.nav.maintenance.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Boardroom 2-Column Per-Person Workload & Active Task Timelines */}
            <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading font-bold text-base sm:text-lg text-[var(--text-ink)]">
                  {t.dashboard.teamWorkloadHeading}
                </h2>
                <span className="font-mono-code text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] tnum">
                  {teamRows.length} {t.dashboard.membersBadge} · LIVE TIMELINE
                </span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {teamRows.map((m) => (
                  <MemberTimelineCard
                    key={m.userId}
                    member={m}
                    isExpanded={isMemberExpanded(m.userId)}
                    onToggle={() => toggleUserExpand(m.userId)}
                    nowMs={nowMs}
                    locale={locale}
                    labels={workItemLabels}
                    compact
                  />
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* OPERATIONAL MODE ROW 2: Master Project Roadmap */}
            <RoadmapCanvas
              roadmapProjects={roadmap.projects}
              windowStartMs={roadmap.windowStartMs}
              windowEndMs={roadmap.windowEndMs}
              todayPct={roadmap.todayPct}
              expandedProjectIds={expandedProjectIds}
              onToggleProject={toggleProjectExpand}
              locale={locale}
              now={now}
              t={t}
            />

            {/* OPERATIONAL MODE ROW 3: FigCraft 7/5 Asymmetric Split */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left Column (7 cols): Team Tasks & Timelines */}
              <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading font-bold text-base sm:text-[17px] text-[var(--text-ink)]">
                      {t.dashboard.teamMatrixTitle}
                    </h2>
                    <span className="font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-ink2)] tnum">
                      {teamRows.length} {t.dashboard.membersBadge}
                    </span>
                  </div>

                  <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-full p-0.5">
                    <button
                      type="button"
                      onClick={() => setTeamViewMode("SUMMARY")}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                        teamViewMode === "SUMMARY"
                          ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                          : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                      }`}
                    >
                      {t.dashboard.viewSummary}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeamViewMode("TIMELINE")}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                        teamViewMode === "TIMELINE"
                          ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                          : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                      }`}
                    >
                      {t.dashboard.viewTimeline}
                    </button>
                  </div>
                </div>

                {teamViewMode === "TIMELINE" ? (
                  <div className="space-y-2.5">
                    {teamRows.map((m) => (
                      <MemberTimelineCard
                        key={m.userId}
                        member={m}
                        isExpanded={isMemberExpanded(m.userId)}
                        onToggle={() => toggleUserExpand(m.userId)}
                        nowMs={nowMs}
                        locale={locale}
                        labels={workItemLabels}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] font-mono-code text-[10px] uppercase text-[var(--text-muted)]">
                          <th className="py-2.5 px-3">{t.dashboard.memberCol}</th>
                          <th className="py-2.5 px-3 text-right">{t.dashboard.tasksDoneCol}</th>
                          <th className="py-2.5 px-3 text-right">{t.dashboard.ticketsCol}</th>
                          <th className="py-2.5 px-3 text-right">{t.dashboard.mttrCol}</th>
                          <th className="py-2.5 px-3 text-right">{t.dashboard.maintCol}</th>
                          <th className="py-2.5 px-3 text-right">{t.dashboard.hoursCol}</th>
                          <th className="py-2.5 px-3 text-right">{t.dashboard.openWorkCol}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {teamRows.map((m) => (
                          <Fragment key={m.userId}>
                            <tr className="hover:bg-[var(--bg-subtle)]/50">
                              <td className="py-2.5 px-3">
                                <p className="font-semibold text-[var(--text-ink)]">{m.name}</p>
                                <p className="font-mono-code text-[10px] text-[var(--text-muted)]">
                                  {m.jobDesk}
                                </p>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code font-bold tnum">
                                {m.tasksDone}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code font-bold tnum">
                                {m.ticketsResolved}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code text-[var(--text-ink2)] tnum">
                                {formatDurationCompact(m.avgMttrMinutes * 60)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code text-[var(--text-ink2)] tnum">
                                {m.maintenanceCompleted}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code text-[var(--text-ink2)] tnum">
                                {formatDurationCompact(m.loggedSeconds)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code font-bold text-[var(--brand)] tnum">
                                {m.workItems.length}
                              </td>
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Right Column (5 cols): Stacked Blocker Radar + Support Volume + Asset Health Ring */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                {/* Blocker & Escalation Radar */}
                <div
                  id="blocker-radar"
                  className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-heading font-bold text-base text-[var(--text-ink)]">
                      {t.dashboard.blockerTitle}
                    </h2>
                    <span className="inline-flex items-center gap-1.5 font-mono-code text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] whitespace-nowrap shrink-0 tnum">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--err)] shrink-0" />
                      {criticalBlockersCount > 0 ? criticalBlockersCount : blockers.length} CRITICAL
                    </span>
                  </div>

                  {blockers.length === 0 ? (
                    <p className="text-xs text-[var(--ok)] py-4 text-center">
                      {t.dashboard.noBlockers}
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {blockers.slice(0, 6).map((b) => {
                        const badgeCls =
                          b.severity === "CRITICAL"
                            ? "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]"
                            : "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]";
                        return (
                          <Link
                            key={b.id}
                            href={b.href}
                            className="block rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] p-3 space-y-1 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-xs text-[var(--text-ink)] truncate">
                                {b.title}
                              </span>
                              <span
                                className={`font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeCls}`}
                              >
                                {b.code}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-ink2)] truncate">
                              {b.detail}
                            </p>
                            <p className="font-mono-code text-[10px] text-[var(--text-muted)] truncate">
                              PIC: {b.owner}
                              {b.daysOverdue > 0 ? ` · +${b.daysOverdue}d` : ""}
                            </p>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Support Volume by Module + Upcoming Deliverables (14D) */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-heading font-bold text-base text-[var(--text-ink)]">
                      {t.dashboard.supportVolTitle}
                    </h2>
                    <span className="font-mono-code text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)]">
                      {t.dashboard.reqVsLogBadge}
                    </span>
                  </div>

                  <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-2.5 h-52 w-full min-w-0">
                    {supportVolume.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
                        {t.dashboard.noSupportRecords}
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={supportVolume}
                          margin={{ top: 4, right: 6, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--border-subtle)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="category"
                            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                          />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: "var(--bg-surface)",
                              borderColor: "var(--border-subtle)",
                              borderRadius: "12px",
                              fontSize: "12px",
                              color: "var(--text-ink)",
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Bar
                            dataKey="requestCount"
                            name={t.dashboard.volRequest}
                            fill="var(--brand)"
                            radius={[5, 5, 0, 0]}
                          />
                          <Bar
                            dataKey="dailyCount"
                            name={t.dashboard.volDaily}
                            fill="var(--brand-stroke)"
                            radius={[5, 5, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                      {t.dashboard.upcomingDeliverables}
                    </span>
                    {upcomingDeliverables.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {t.dashboard.noSchedules7d}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {upcomingDeliverables.map((del) => (
                          <Link
                            key={del.id}
                            href={del.href}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] text-xs transition-colors"
                          >
                            <span className="font-medium text-[var(--text-ink)] truncate">
                              {del.title}
                            </span>
                            <span className="font-mono-code text-[10px] font-bold text-[var(--brand)] shrink-0 tnum">
                              {formatShortDayMonth(del.date, locale)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Asset & Maintenance Health Donut Card */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 flex items-center gap-4">
                  <AssetDonutRing percent={kpis.assetHealthRate} />
                  <div className="flex-1 min-w-0 space-y-2">
                    <h3 className="font-heading font-bold text-sm text-[var(--text-ink)] truncate">
                      {t.dashboard.assetMaintHealthTitle}
                    </h3>
                    <div className="space-y-1.5 font-mono-code text-[10px] tnum">
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                        <span className="text-[var(--text-ink2)]">
                          {t.dashboard.activeInRepairLabel}
                        </span>
                        <span className="font-bold text-[var(--ok)]">
                          {kpis.activeAssetsCount} / {kpis.inRepairAssetsCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                        <span className="text-[var(--text-ink2)]">
                          {t.dashboard.qrStickeredLabel}
                        </span>
                        <span className="font-bold text-[var(--brand)]">
                          {kpis.qrStickeredCount} / {kpis.totalAssetsCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                        <span className="text-[var(--text-ink2)]">
                          {t.dashboard.dueNext7DaysLabel}
                        </span>
                        <span className="font-bold text-[var(--warn)]">
                          {String(kpis.dueSoonSchedulesCount).padStart(2, "0")}{" "}
                          {t.nav.maintenance.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Compact Personal Action Queue (Operational Mode only) */}
            {myQueue.length > 0 && (
              <section className="no-print bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
                  <h2 className="font-heading font-bold text-sm text-[var(--text-ink)]">
                    {t.dashboard.actionQueueTitle}
                  </h2>
                  <span className="font-mono-code text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] tnum">
                    {myQueue.length} {t.dashboard.pendingTag}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {myQueue.slice(0, 4).map((q) => (
                    <Link
                      key={q.id}
                      href={q.href}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono-code text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-ink2)] shrink-0">
                          {q.code}
                        </span>
                        <span className="font-medium text-[var(--text-ink)] truncate">
                          {q.title}
                        </span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
