"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderKanban,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { useI18n } from "@/i18n";
import { formatDurationCompact, formatShortDate } from "@/lib/format";
import { buildProjectGroupedTaskTrees } from "@/lib/project-helpers";
import { useUiPref } from "@/lib/ui-prefs";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import {
  TASK_STATUSES,
  type ProjectRecord,
  type TaskRecord,
  type UserRecord,
  getPriorityPillClass,
  getStatusPillClass,
  getTaskExecutorNames,
  getTotalTaskSeconds,
} from "./types";

interface ProjectsCalendarViewProps {
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  users: UserRecord[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onSelectTask: (t: TaskRecord) => void;
  onCreateTaskAtDate?: (isoDate: string) => void;
  nowMs: number;
}

type CalendarMode = "day" | "week" | "month";

const GRID_START_HOUR = 8;
const GRID_END_HOUR = 18;
const HOUR_HEIGHT_PX = 82;
const TOTAL_GRID_HOURS = GRID_END_HOUR - GRID_START_HOUR;

const HOURS_LIST = Array.from(
  { length: TOTAL_GRID_HOURS },
  (_, i) => GRID_START_HOUR + i
);

const PROJECT_DOTS = [
  "bg-[#0F62FE] dark:bg-[#60A5FA]",
  "bg-[#0D9488] dark:bg-[#2DD4BF]",
  "bg-[#7C3AED] dark:bg-[#A78BFA]",
  "bg-[#D97706] dark:bg-[#FBBF24]",
  "bg-[#DC2626] dark:bg-[#F87171]",
];

const PROJECT_BORDERS = [
  "border-l-[#0F62FE] dark:border-l-[#60A5FA]",
  "border-l-[#0D9488] dark:border-l-[#2DD4BF]",
  "border-l-[#7C3AED] dark:border-l-[#A78BFA]",
  "border-l-[#D97706] dark:border-l-[#FBBF24]",
  "border-l-[#DC2626] dark:border-l-[#F87171]",
];

const AVATAR_TONES = [
  "bg-[#DBEAFE] text-[#1D4ED8] dark:bg-[#1E3A8A] dark:text-[#93C5FD]",
  "bg-[#D1FAE5] text-[#047857] dark:bg-[#064E3B] dark:text-[#6EE7B7]",
  "bg-[#EDE9FE] text-[#6D28D9] dark:bg-[#4C1D95] dark:text-[#DDD6FE]",
  "bg-[#FEF3C7] text-[#B45309] dark:bg-[#78350F] dark:text-[#FDE68A]",
];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function formatHourLabel(hour24: number): string {
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h12} ${suffix}`;
}

interface PositionedCard {
  task: TaskRecord;
  startMin: number;
  endMin: number;
  lane: number;
  laneCount: number;
}

/**
 * Pick representative tasks for the visual time grid, favoring tasks with logged sessions
 * on that day and balancing across distinct projects so cards stay diverse across days.
 */
function pickDiverseDayTasks(day: Date, dayTasks: TaskRecord[], limit: number): TaskRecord[] {
  if (dayTasks.length <= limit) return dayTasks;
  const dayKey = format(day, "yyyy-MM-dd");

  const withLog: TaskRecord[] = [];
  const buckets = new Map<string, TaskRecord[]>();

  for (const tk of dayTasks) {
    const hasLog = tk.timeLogs?.some((tl) => {
      const d = new Date(tl.startTime);
      return !Number.isNaN(d.getTime()) && format(d, "yyyy-MM-dd") === dayKey;
    });
    if (hasLog) {
      withLog.push(tk);
      continue;
    }
    const key = tk.projectId || "__none__";
    const arr = buckets.get(key) || [];
    arr.push(tk);
    buckets.set(key, arr);
  }

  const result: TaskRecord[] = [...withLog];
  const bucketList = [...buckets.values()];
  if (bucketList.length === 0) return result.slice(0, limit);

  // Rotate starting pointer gently by day-of-week so Mon-Sun aren't identical clones
  const startProjOffset = day.getDay() % bucketList.length;
  let round = Math.floor(day.getDate() / 7);
  let emptyPasses = 0;

  while (result.length < limit && emptyPasses < bucketList.length) {
    emptyPasses = 0;
    for (let i = 0; i < bucketList.length && result.length < limit; i++) {
      const arr = bucketList[(i + startProjOffset) % bucketList.length];
      if (round < arr.length) {
        result.push(arr[round]);
      } else {
        emptyPasses++;
      }
    }
    round++;
  }

  return result.slice(0, limit);
}

/**
 * Pack day tasks into a strict non-overlapping (row x lane) matrix across working hours (08:00-18:00).
 * Every occupied (rowIdx, laneIdx) holds at most 1 card so cards can never stack on top of each other.
 */
function buildDayPositionedCards(
  day: Date,
  dayTasks: TaskRecord[],
  options: { maxCols: number; maxRows?: number }
): PositionedCard[] {
  const maxRows = options.maxRows ?? 5;
  const maxCols = Math.max(1, options.maxCols);
  const slotDurationMin = Math.floor((TOTAL_GRID_HOURS * 60) / maxRows); // 120m for 5 rows
  const capacity = maxRows * maxCols;

  const selected = pickDiverseDayTasks(day, dayTasks, capacity);
  const dayKey = format(day, "yyyy-MM-dd");

  // Grid occupancy: [row][col] -> boolean
  const occupied: boolean[][] = Array.from({ length: maxRows }, () =>
    Array.from({ length: maxCols }, () => false)
  );

  const placements: Array<{ task: TaskRecord; row: number; lane: number }> = [];
  const deferred: TaskRecord[] = [];

  // Pass 1: Place tasks that have exact TimeLog timestamps into their preferred hour slot if free
  for (const tk of selected) {
    const matchingLog = tk.timeLogs?.find((tl) => {
      const d = new Date(tl.startTime);
      return !Number.isNaN(d.getTime()) && format(d, "yyyy-MM-dd") === dayKey;
    });
    if (!matchingLog) {
      deferred.push(tk);
      continue;
    }
    const s = new Date(matchingLog.startTime);
    const minFromStart = Math.max(0, (s.getHours() - GRID_START_HOUR) * 60 + s.getMinutes());
    const preferredRow = Math.min(maxRows - 1, Math.floor(minFromStart / slotDurationMin));
    const freeLane = occupied[preferredRow].findIndex((used) => !used);
    if (freeLane !== -1) {
      occupied[preferredRow][freeLane] = true;
      placements.push({ task: tk, row: preferredRow, lane: freeLane });
    } else {
      deferred.push(tk);
    }
  }

  // Pass 2: Assign remaining tasks evenly down open rows/lanes so zero overlap is guaranteed
  for (const tk of deferred) {
    let placed = false;
    for (let r = 0; r < maxRows && !placed; r++) {
      for (let c = 0; c < maxCols && !placed; c++) {
        if (!occupied[r][c]) {
          occupied[r][c] = true;
          placements.push({ task: tk, row: r, lane: c });
          placed = true;
        }
      }
    }
  }

  const maxUsedLane = placements.reduce((m, p) => Math.max(m, p.lane), 0);
  const laneCount = Math.max(1, Math.min(maxCols, maxUsedLane + 1));

  return placements.map((p) => ({
    task: p.task,
    startMin: GRID_START_HOUR * 60 + p.row * slotDurationMin,
    endMin: GRID_START_HOUR * 60 + (p.row + 1) * slotDurationMin,
    lane: p.lane,
    laneCount,
  }));
}

export default function ProjectsCalendarView({
  projects,
  tasks,
  users,
  selectedProjectId,
  onSelectProject,
  onSelectTask,
  onCreateTaskAtDate,
  nowMs,
}: ProjectsCalendarViewProps) {
  const { locale, t } = useI18n();
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date(nowMs));
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date(nowMs));
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [modePref, setModePref] = useUiPref("projects_calendar_mode", "week");
  const [dateModePref, setDateModePref] = useUiPref("projects_calendar_datemode", "span");
  const [subtaskPref, setSubtaskPref] = useUiPref("projects_calendar_subtasks", "all");

  const mode: CalendarMode =
    modePref === "day" || modePref === "month" ? modePref : "week";
  const deadlinesOnly = dateModePref === "due";
  const mainTasksOnly = subtaskPref === "main";

  const dfLocale = locale === "id" ? idLocale : enUS;
  const weekDayNamesShort =
    locale === "id"
      ? ["SEN", "SEL", "RAB", "KAM", "JUM", "SAB", "MIN"]
      : ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  const todayDate = useMemo(() => new Date(nowMs), [nowMs]);

  const gmtLabel = useMemo(() => {
    const offsetMin = -new Date(nowMs).getTimezoneOffset();
    const hrs = Math.round(offsetMin / 60);
    return `GMT ${hrs >= 0 ? `+${hrs}` : hrs}`;
  }, [nowMs]);

  const projectIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p, idx) => map.set(p.id, idx));
    return map;
  }, [projects]);

  const usersByNameLower = useMemo(() => {
    const map = new Map<string, UserRecord>();
    for (const u of users) map.set(u.name.trim().toLowerCase(), u);
    return map;
  }, [users]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const allIds = new Set(tasks.map((tk) => tk.id));
    return tasks.filter((tk) => {
      if (selectedProjectId !== "all" && tk.projectId !== selectedProjectId) return false;
      if (statusFilter !== "ALL" && tk.status !== statusFilter) return false;
      if (mainTasksOnly && tk.parentId && allIds.has(tk.parentId)) return false;
      if (!q) return true;
      const exec = getTaskExecutorNames(tk).join(" ").toLowerCase();
      return (
        tk.title.toLowerCase().includes(q) ||
        exec.includes(q) ||
        (tk.project?.name || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, selectedProjectId, statusFilter, mainTasksOnly, searchQuery]);

  // Visible dates for Week or Month modes
  const weekDays = useMemo(() => {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchorDate]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(anchorDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [anchorDate]);

  // Fast map of YYYY-MM-DD -> TaskRecord[] across visible range
  const tasksByDayKey = useMemo(() => {
    const rangeDays = mode === "day" ? [anchorDate] : mode === "week" ? weekDays : monthDays;
    const map = new Map<string, TaskRecord[]>();
    if (rangeDays.length === 0) return map;

    const first = rangeDays[0];
    const last = rangeDays[rangeDays.length - 1];
    const gridStartMs = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 0, 0, 0).getTime();
    const gridEndMs = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59).getTime();

    for (const tk of filteredTasks) {
      if (deadlinesOnly) {
        const key = format(new Date(tk.endDate), "yyyy-MM-dd");
        const arr = map.get(key) || [];
        arr.push(tk);
        map.set(key, arr);
        continue;
      }

      const sMs = Math.max(gridStartMs, new Date(tk.startDate).getTime());
      const eMs = Math.min(gridEndMs, new Date(tk.endDate).getTime());
      if (eMs < sMs) continue;

      const cur = new Date(sMs);
      cur.setHours(0, 0, 0, 0);
      const endDay = new Date(eMs);
      endDay.setHours(23, 59, 59, 999);

      while (cur.getTime() <= endDay.getTime()) {
        const key = format(cur, "yyyy-MM-dd");
        const arr = map.get(key) || [];
        arr.push(tk);
        map.set(key, arr);
        cur.setDate(cur.getDate() + 1);
      }
    }

    return map;
  }, [filteredTasks, mode, anchorDate, weekDays, monthDays, deadlinesOnly]);

  // Royal Medica semantic card palette matching screenshot's soft pastel elegance (opaque in Light & Dark)
  const getTaskSurfaceTone = (tk: TaskRecord) => {
    const done = tk.status === "Completed" || tk.status === "Done";
    const overdue = !done && new Date(tk.endDate).getTime() < nowMs;

    if (done) {
      return {
        card: "bg-[#ECFDF5] dark:bg-[#152C26] border-[#A7F3D0] dark:border-[#10B981]/45",
        dot: "bg-[var(--ok)]",
        chip: "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]",
      };
    }
    if (overdue) {
      return {
        card: "bg-[#FEF2F2] dark:bg-[#311B20] border-[#FECACA] dark:border-[#EF4444]/45",
        dot: "bg-[var(--err)]",
        chip: "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]",
      };
    }
    if (tk.status === "Suspended") {
      return {
        card: "bg-[#FFFBEB] dark:bg-[#2F2416] border-[#FDE68A] dark:border-[#F59E0B]/45",
        dot: "bg-[var(--warn)]",
        chip: "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]",
      };
    }
    if (tk.status === "Ongoing") {
      return {
        card: "bg-[#EFF6FF] dark:bg-[#1B273D] border-[#BFDBFE] dark:border-[#3B82F6]/45",
        dot: "bg-[var(--brand)]",
        chip: "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]",
      };
    }
    return {
      card: "bg-[var(--bg-surface)] border-[var(--border-subtle)]",
      dot: "bg-[var(--text-muted)]",
      chip: "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-ink2)]",
    };
  };

  const resolveProfiles = (tk: TaskRecord) => {
    if (tk.executors && tk.executors.length > 0) {
      return tk.executors.map((ex) => ({
        id: ex.userId,
        name: ex.user?.name || "User",
        photo: ex.user?.photo,
      }));
    }
    return getTaskExecutorNames(tk).map((name, idx) => {
      const matched = usersByNameLower.get(name.trim().toLowerCase());
      return {
        id: matched?.id || `${tk.id}-cal-ex-${idx}`,
        name: matched?.name || name,
        photo: matched?.photo || null,
      };
    });
  };

  // Current live time indicator position on Day/Week ruler
  const currentTimeIndicator = useMemo(() => {
    const dt = new Date(nowMs);
    const totalMin = dt.getHours() * 60 + dt.getMinutes();
    const clampedMin = Math.max(GRID_START_HOUR * 60, Math.min(GRID_END_HOUR * 60, totalMin));
    const topPx = ((clampedMin - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX;
    const label = format(dt, "hh:mm a");
    const inWorkingWindow = totalMin >= GRID_START_HOUR * 60 && totalMin <= GRID_END_HOUR * 60;
    return { topPx, label, inWorkingWindow };
  }, [nowMs]);

  const navigatePrev = () => {
    if (mode === "day") {
      const next = subDays(anchorDate, 1);
      setAnchorDate(next);
      setSelectedDay(next);
    } else if (mode === "week") {
      setAnchorDate((p) => subWeeks(p, 1));
    } else {
      setAnchorDate((p) => subMonths(p, 1));
    }
  };

  const navigateNext = () => {
    if (mode === "day") {
      const next = addDays(anchorDate, 1);
      setAnchorDate(next);
      setSelectedDay(next);
    } else if (mode === "week") {
      setAnchorDate((p) => addWeeks(p, 1));
    } else {
      setAnchorDate((p) => addMonths(p, 1));
    }
  };

  const navigateToday = () => {
    const now = new Date(nowMs);
    setAnchorDate(now);
    setSelectedDay(now);
  };

  const openDayViewForDate = (day: Date) => {
    setAnchorDate(day);
    setSelectedDay(day);
    setModePref("day");
  };

  const headerTitle = useMemo(() => {
    if (mode === "day") {
      return format(anchorDate, "EEEE, d MMMM yyyy", { locale: dfLocale });
    }
    if (mode === "week") {
      const start = weekDays[0];
      const end = weekDays[weekDays.length - 1];
      return `${format(start, "d MMM", { locale: dfLocale })} – ${format(end, "d MMM yyyy", {
        locale: dfLocale,
      })}`;
    }
    return format(anchorDate, "MMMM yyyy", { locale: dfLocale });
  }, [mode, anchorDate, weekDays, dfLocale]);

  const activeDayKey = format(anchorDate, "yyyy-MM-dd");
  const activeDayTasks = useMemo(
    () => tasksByDayKey.get(activeDayKey) || [],
    [tasksByDayKey, activeDayKey]
  );
  const activeDayPositioned = useMemo(
    () =>
      mode === "day"
        ? buildDayPositionedCards(anchorDate, activeDayTasks, { maxCols: 3, maxRows: 5 })
        : [],
    [mode, anchorDate, activeDayTasks]
  );
  const activeDayProjectGroups = useMemo(
    () => buildProjectGroupedTaskTrees(projects, activeDayTasks),
    [projects, activeDayTasks]
  );

  // Selected day agenda for Month & Mobile views
  const selectedDayKey = format(selectedDay, "yyyy-MM-dd");
  const selectedDayTasks = useMemo(
    () => tasksByDayKey.get(selectedDayKey) || [],
    [tasksByDayKey, selectedDayKey]
  );
  const selectedDayProjectGroups = useMemo(
    () => buildProjectGroupedTaskTrees(projects, selectedDayTasks),
    [projects, selectedDayTasks]
  );

  const projectOptions = [
    { value: "all", label: t.projects.allProjects },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const statusOptions = [
    { value: "ALL", label: t.projects.allStatuses },
    ...TASK_STATUSES.map((s) => ({ value: s, label: s })),
  ];

  const renderScheduleCard = (tk: TaskRecord, compact = false) => {
    const tone = getTaskSurfaceTone(tk);
    const profiles = resolveProfiles(tk);
    const pIdx = tk.projectId ? (projectIndexMap.get(tk.projectId) ?? 0) : 0;
    const projDot = PROJECT_DOTS[pIdx % PROJECT_DOTS.length];
    const contextDesc = tk.issue || tk.solution || tk.documentation || tk.status;
    const secs = getTotalTaskSeconds(tk, nowMs);

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelectTask(tk);
        }}
        className={`h-full rounded-2xl border p-2.5 flex flex-col justify-between gap-1.5 overflow-hidden cursor-pointer transition-all hover:shadow-md ${tone.card}`}
      >
        <div className="min-h-0 flex-1 overflow-hidden flex flex-col gap-1">
          {/* Top Tag Pill + 3-dots indicator */}
          <div className="flex items-center justify-between gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[9.5px] font-semibold text-[var(--text-ink)] truncate max-w-[145px]">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${projDot}`} />
              <span className="truncate">{tk.project?.name || "Task"}</span>
            </span>
            <MoreHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          </div>

          <h4
            className={`font-heading font-bold text-[var(--text-ink)] leading-snug shrink-0 ${
              compact ? "text-[11px] line-clamp-1" : "text-[12px] line-clamp-2"
            }`}
          >
            {tk.title}
          </h4>

          {!compact && contextDesc && (
            <p className="text-[10.5px] text-[var(--text-ink2)] line-clamp-1 leading-snug">
              {contextDesc}
            </p>
          )}
        </div>

        {/* Footer: Team label + Time + Overlapping Avatar Circles (never overlaps top block) */}
        <div className="pt-1.5 border-t border-black/5 dark:border-white/10 shrink-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono-code text-[9.5px] text-[var(--text-ink2)] tnum min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} />
            <span className="truncate">
              {secs > 0 ? formatDurationCompact(secs) : t.projects.calTeam}
            </span>
          </div>

          {profiles.length > 0 && (
            <div className="flex items-center -space-x-1.5 shrink-0">
              {profiles.slice(0, 3).map((prof, idx) => (
                <div
                  key={prof.id}
                  title={prof.name}
                  className={`w-5 h-5 rounded-full ring-2 ring-[var(--bg-surface)] flex items-center justify-center overflow-hidden font-mono-code text-[8px] font-bold ${
                    AVATAR_TONES[idx % AVATAR_TONES.length]
                  }`}
                >
                  {prof.photo ? (
                    <Image
                      src={prof.photo}
                      alt={prof.name}
                      width={20}
                      height={20}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(prof.name)
                  )}
                </div>
              ))}
              {profiles.length > 3 && (
                <div className="w-5 h-5 rounded-full ring-2 ring-[var(--bg-surface)] bg-[var(--bg-surface)] text-[var(--text-ink2)] flex items-center justify-center font-mono-code text-[8px] font-bold">
                  +{profiles.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3.5 w-full">
      {/* Top Reference-Inspired Bar: [Day | Week | Month] + Date Nav + Search + Filters + Add New */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3 space-y-2.5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5">
          {/* Left: [ Day | Week | Month ] Segmented Switcher + Date Nav */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className="inline-flex items-center bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5"
              role="tablist"
              aria-label="Calendar granularity"
            >
              {(
                [
                  { id: "day", label: t.projects.calDay },
                  { id: "week", label: t.projects.calWeek },
                  { id: "month", label: t.projects.calMonth },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === item.id}
                  onClick={() => setModePref(item.id)}
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                    mode === item.id
                      ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                      : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={navigatePrev}
                aria-label="Previous"
                className="p-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] hover:text-[var(--text-ink)] cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={navigateToday}
                className="px-2.5 py-1 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] font-mono-code text-[10px] font-bold text-[var(--text-ink2)] hover:text-[var(--brand)] cursor-pointer"
              >
                {t.projects.jumpToToday}
              </button>
              <button
                type="button"
                onClick={navigateNext}
                aria-label="Next"
                className="p-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] hover:text-[var(--text-ink)] cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <h3 className="font-heading font-bold text-sm sm:text-base text-[var(--text-ink)]">
              {headerTitle}
            </h3>
          </div>

          {/* Right: Search + Project/Status Filters + Date Span/Due */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px] sm:flex-none sm:w-48">
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
              className="min-w-[148px]"
            />

            <ThemedSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              className="min-w-[124px]"
            />

            <div className="inline-flex items-center bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setDateModePref("span")}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition-colors cursor-pointer ${
                  !deadlinesOnly
                    ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                    : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                }`}
              >
                {t.projects.calendarSpan}
              </button>
              <button
                type="button"
                onClick={() => setDateModePref("due")}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition-colors cursor-pointer ${
                  deadlinesOnly
                    ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                    : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                }`}
              >
                {t.projects.calendarDeadlines}
              </button>
            </div>

            <div className="hidden 2xl:inline-flex items-center bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setSubtaskPref("all")}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition-colors cursor-pointer ${
                  !mainTasksOnly
                    ? "bg-[var(--brand)] text-white dark:text-[#161A26]"
                    : "text-[var(--text-ink2)]"
                }`}
              >
                {t.projects.allTasksMode}
              </button>
              <button
                type="button"
                onClick={() => setSubtaskPref("main")}
                className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold transition-colors cursor-pointer ${
                  mainTasksOnly
                    ? "bg-[var(--brand)] text-white dark:text-[#161A26]"
                    : "text-[var(--text-ink2)]"
                }`}
              >
                {t.projects.mainTasksOnly}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ 1. DAY VIEW (Hourly Time-Grid + Daily Project Schedule) ═══════════════ */}
      {mode === "day" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Desktop / Tablet Hourly Time-Grid */}
          <div className="hidden md:block xl:col-span-8 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
            <div className="flex items-center h-12 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70">
              <div className="w-20 shrink-0 px-3 font-mono-code text-[10.5px] font-semibold text-[var(--text-muted)] border-r border-[var(--border-subtle)] h-full flex items-center justify-center">
                {gmtLabel}
              </div>
              <div className="flex-1 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-sm text-[var(--text-ink)]">
                    {format(anchorDate, "EEEE", { locale: dfLocale })}
                  </span>
                  <span
                    className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-mono-code text-xs font-bold tnum ${
                      isSameDay(anchorDate, todayDate)
                        ? "bg-[var(--text-ink)] text-[var(--bg-surface)]"
                        : "bg-[var(--bg-subtle)] text-[var(--text-ink)]"
                    }`}
                  >
                    {format(anchorDate, "d")}
                  </span>
                </div>
                <span className="font-mono-code text-[10.5px] text-[var(--text-muted)] tnum">
                  {activeDayTasks.length} {t.nav.tasks}
                </span>
              </div>
            </div>

            <div className="flex relative" style={{ height: `${TOTAL_GRID_HOURS * HOUR_HEIGHT_PX}px` }}>
              {/* Left Hour Labels */}
              <div className="w-20 shrink-0 border-r border-[var(--border-subtle)] relative bg-[var(--bg-surface)]">
                {HOURS_LIST.map((hr, idx) => (
                  <div
                    key={hr}
                    style={{ top: `${idx * HOUR_HEIGHT_PX}px`, height: `${HOUR_HEIGHT_PX}px` }}
                    className="absolute inset-x-0 px-2 pt-2 text-right font-mono-code text-[10.5px] text-[var(--text-muted)]"
                  >
                    {formatHourLabel(hr)}
                  </div>
                ))}

                {/* Current Time Pill on Day Ruler */}
                {isSameDay(anchorDate, todayDate) && currentTimeIndicator.inWorkingWindow && (
                  <div
                    style={{ top: `${currentTimeIndicator.topPx}px` }}
                    className="absolute right-1 -translate-y-1/2 z-30 px-2 py-0.5 rounded-full bg-[var(--text-ink)] text-[var(--bg-surface)] font-mono-code text-[9.5px] font-bold whitespace-nowrap shadow-xs tnum"
                  >
                    {currentTimeIndicator.label}
                  </div>
                )}
              </div>

              {/* Day Column Gridlines + Cards */}
              <div
                className="flex-1 relative cursor-pointer"
                onClick={() =>
                  onCreateTaskAtDate && onCreateTaskAtDate(format(anchorDate, "yyyy-MM-dd"))
                }
              >
                {HOURS_LIST.map((hr, idx) => (
                  <div
                    key={`grid-day-${hr}`}
                    style={{ top: `${idx * HOUR_HEIGHT_PX}px`, height: `${HOUR_HEIGHT_PX}px` }}
                    className="absolute inset-x-0 border-b border-[var(--border-subtle)]/70 hover:bg-[var(--bg-subtle)]/20 transition-colors"
                  />
                ))}

                {/* Current Time Horizontal Line */}
                {isSameDay(anchorDate, todayDate) && currentTimeIndicator.inWorkingWindow && (
                  <div
                    style={{ top: `${currentTimeIndicator.topPx}px` }}
                    className="pointer-events-none absolute inset-x-0 h-[1.5px] bg-[var(--text-ink)]/80 z-20"
                  />
                )}

                {activeDayPositioned.map((item) => {
                  const topPx = ((item.startMin - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX + 5;
                  const heightPx = Math.max(
                    118,
                    ((item.endMin - item.startMin) / 60) * HOUR_HEIGHT_PX - 10
                  );
                  const colW = 100 / Math.max(1, item.laneCount);
                  const leftPct = item.lane * colW;
                  return (
                    <div
                      key={`day-card-${item.task.id}`}
                      style={{
                        top: `${topPx}px`,
                        height: `${heightPx}px`,
                        left: `calc(${leftPct}% + 6px)`,
                        width: `calc(${colW}% - 12px)`,
                      }}
                      className="absolute z-10"
                    >
                      {renderScheduleCard(item.task)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Full Daily Schedule & Tasks List (Grouped cleanly by Project, always complete) */}
          <aside className="xl:col-span-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <div className="min-w-0">
                <p className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--brand)]">
                  {t.projects.calActiveSchedule}
                </p>
                <h4 className="font-heading font-bold text-sm text-[var(--text-ink)] truncate">
                  {formatShortDate(anchorDate, locale)} ({activeDayTasks.length})
                </h4>
              </div>
              {onCreateTaskAtDate && (
                <button
                  type="button"
                  onClick={() => onCreateTaskAtDate(format(anchorDate, "yyyy-MM-dd"))}
                  className="p-1.5 rounded-full bg-[var(--brand-tint)] text-[var(--brand)] border border-[var(--brand-stroke)] cursor-pointer"
                  aria-label={t.projects.newTask}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeDayProjectGroups.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-8">
                {t.projects.noTasksOnDate}
              </p>
            ) : (
              <div className="space-y-3 xl:max-h-[680px] xl:overflow-y-auto pr-0.5">
                {activeDayProjectGroups.map((group) => {
                  const groupName = group.project?.name || t.projects.unassignedProject;
                  const pIdx = group.project ? (projectIndexMap.get(group.project.id) ?? 0) : 0;
                  const borderCls = PROJECT_BORDERS[pIdx % PROJECT_BORDERS.length];
                  return (
                    <div key={`day-grp-${group.projectKey}`} className="space-y-1.5">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] border-l-4 ${borderCls} flex items-center justify-between`}
                      >
                        <span className="font-heading font-bold text-xs text-[var(--text-ink)] truncate">
                          {groupName}
                        </span>
                        <span className="font-mono-code text-[10px] text-[var(--text-muted)] tnum">
                          {group.completedCount}/{group.totalCount}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {group.rows.map(({ task, depth }) => (
                          <div
                            key={`day-list-${task.id}`}
                            style={{ marginLeft: `${Math.min(depth, 2) * 10}px` }}
                          >
                            {renderScheduleCard(task, true)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ═══════════════ 2. WEEK VIEW (GMT+7 Hourly Time-Grid Across 7 Days, Reference Screenshot Match) ═══════════════ */}
      {mode === "week" && (
        <>
          {/* Desktop / Tablet 7-Day Hourly Grid */}
          <div className="hidden md:block bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[920px]">
                {/* Header Strip: GMT+7 + Day Headers */}
                <div className="flex items-stretch border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/60">
                  <div className="w-[72px] shrink-0 px-2 py-3 font-mono-code text-[10px] font-semibold text-[var(--text-muted)] border-r border-[var(--border-subtle)] flex items-center justify-center">
                    {gmtLabel}
                  </div>
                  <div className="flex-1 grid grid-cols-7 divide-x divide-[var(--border-subtle)]">
                    {weekDays.map((day) => {
                      const key = format(day, "yyyy-MM-dd");
                      const dayCount = (tasksByDayKey.get(key) || []).length;
                      const isToday = isSameDay(day, todayDate);
                      return (
                        <button
                          key={`wk-hdr-${key}`}
                          type="button"
                          onClick={() => openDayViewForDate(day)}
                          className={`py-2.5 px-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                            isToday
                              ? "bg-[var(--bg-surface)]"
                              : "hover:bg-[var(--bg-subtle)]/50"
                          }`}
                          title="Open day schedule"
                        >
                          <span
                            className={`text-xs font-semibold ${
                              isToday ? "text-[var(--text-ink)]" : "text-[var(--text-ink2)]"
                            }`}
                          >
                            {format(day, "EEE", { locale: dfLocale })}
                          </span>
                          <span
                            className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-mono-code text-[11px] font-bold tnum ${
                              isToday
                                ? "bg-[var(--text-ink)] text-[var(--bg-surface)]"
                                : "text-[var(--text-ink)]"
                            }`}
                          >
                            {format(day, "d")}
                          </span>
                          {dayCount > 0 && (
                            <span className="font-mono-code text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] tnum">
                              {dayCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Top Header Overflow Sub-row (never collides with cards or hides below fold) */}
                {weekDays.some((d) => (tasksByDayKey.get(format(d, "yyyy-MM-dd")) || []).length > 5) && (
                  <div className="flex items-stretch border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/35">
                    <div className="w-[72px] shrink-0 px-2 py-1 font-mono-code text-[9px] text-[var(--text-muted)] border-r border-[var(--border-subtle)] flex items-center justify-center uppercase">
                      More
                    </div>
                    <div className="flex-1 grid grid-cols-7 divide-x divide-[var(--border-subtle)]">
                      {weekDays.map((day) => {
                        const key = format(day, "yyyy-MM-dd");
                        const dayTasks = tasksByDayKey.get(key) || [];
                        const extra = dayTasks.length - 5;
                        return (
                          <div key={`wk-extra-${key}`} className="px-1.5 py-1 flex items-center justify-center">
                            {extra > 0 ? (
                              <button
                                type="button"
                                onClick={() => openDayViewForDate(day)}
                                className="w-full py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] font-mono-code text-[9px] font-bold text-[var(--brand)] hover:opacity-85 cursor-pointer text-center tnum"
                              >
                                +{extra} · {t.projects.calDay}
                              </button>
                            ) : (
                              <span className="text-[9px] text-[var(--text-muted)]/50">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Time Ruler + 7 Columns */}
                <div
                  className="flex relative"
                  style={{ height: `${TOTAL_GRID_HOURS * HOUR_HEIGHT_PX}px` }}
                >
                  {/* Left Hourly Axis */}
                  <div className="w-[72px] shrink-0 border-r border-[var(--border-subtle)] relative bg-[var(--bg-surface)]">
                    {HOURS_LIST.map((hr, idx) => (
                      <div
                        key={`wk-hr-${hr}`}
                        style={{ top: `${idx * HOUR_HEIGHT_PX}px`, height: `${HOUR_HEIGHT_PX}px` }}
                        className="absolute inset-x-0 px-2 pt-2 text-right font-mono-code text-[10px] text-[var(--text-muted)]"
                      >
                        {formatHourLabel(hr)}
                      </div>
                    ))}

                    {currentTimeIndicator.inWorkingWindow && (
                      <div
                        style={{ top: `${currentTimeIndicator.topPx}px` }}
                        className="absolute right-1 -translate-y-1/2 z-30 px-1.5 py-0.5 rounded-full bg-[var(--text-ink)] text-[var(--bg-surface)] font-mono-code text-[9px] font-bold whitespace-nowrap shadow-xs tnum"
                      >
                        {currentTimeIndicator.label}
                      </div>
                    )}
                  </div>

                  {/* 7 Day Columns */}
                  <div className="flex-1 grid grid-cols-7 divide-x divide-[var(--border-subtle)] relative">
                    {/* Global Horizontal Current-Time Line */}
                    {currentTimeIndicator.inWorkingWindow && (
                      <div
                        style={{ top: `${currentTimeIndicator.topPx}px` }}
                        className="pointer-events-none absolute inset-x-0 h-[1.5px] bg-[var(--text-ink)]/75 z-20"
                      />
                    )}

                    {weekDays.map((day) => {
                      const key = format(day, "yyyy-MM-dd");
                      const dayTasks = tasksByDayKey.get(key) || [];
                      const positioned = buildDayPositionedCards(day, dayTasks, {
                        maxCols: 1,
                        maxRows: 5,
                      });
                      const isToday = isSameDay(day, todayDate);

                      return (
                        <div
                          key={`wk-col-${key}`}
                          onClick={() =>
                            onCreateTaskAtDate && onCreateTaskAtDate(key)
                          }
                          className={`relative h-full cursor-pointer ${
                            isToday ? "bg-[var(--brand-tint)]/15" : ""
                          }`}
                        >
                          {HOURS_LIST.map((hr, idx) => (
                            <div
                              key={`wk-cell-${key}-${hr}`}
                              style={{
                                top: `${idx * HOUR_HEIGHT_PX}px`,
                                height: `${HOUR_HEIGHT_PX}px`,
                              }}
                              className="absolute inset-x-0 border-b border-[var(--border-subtle)]/65 hover:bg-[var(--bg-subtle)]/20"
                            />
                          ))}

                          {positioned.map((item) => {
                            const topPx =
                              ((item.startMin - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX + 5;
                            const heightPx = Math.max(
                              128,
                              ((item.endMin - item.startMin) / 60) * HOUR_HEIGHT_PX - 10
                            );
                            return (
                              <div
                                key={`wk-card-${key}-${item.task.id}`}
                                style={{
                                  top: `${topPx}px`,
                                  height: `${heightPx}px`,
                                  left: "5px",
                                  right: "5px",
                                }}
                                className="absolute z-10"
                              >
                                {renderScheduleCard(item.task)}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Week Switcher (< md) */}
          <div className="md:hidden space-y-3">
            <div className="grid grid-cols-7 gap-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-2">
              {weekDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const isSel = isSameDay(day, selectedDay);
                const count = (tasksByDayKey.get(key) || []).length;
                return (
                  <button
                    key={`mob-wk-${key}`}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`py-2 rounded-xl flex flex-col items-center gap-0.5 text-center transition-colors ${
                      isSel
                        ? "bg-[var(--brand)] text-white dark:text-[#161A26]"
                        : "text-[var(--text-ink2)]"
                    }`}
                  >
                    <span className="font-mono-code text-[9px] uppercase">
                      {format(day, "EEE", { locale: dfLocale })}
                    </span>
                    <span className="font-mono-code text-xs font-bold tnum">
                      {format(day, "d")}
                    </span>
                    {count > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              {selectedDayTasks.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-8 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
                  {t.projects.noTasksOnDate}
                </p>
              ) : (
                selectedDayTasks.map((tk) => (
                  <div key={`mob-wk-card-${tk.id}`}>{renderScheduleCard(tk)}</div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════ 3. MONTH VIEW (Full Calendar Dates — Zero Hourly Sidebar!) ═══════════════ */}
      {mode === "month" && (
        <div className="space-y-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3 sm:p-4 space-y-2">
            <div className="grid grid-cols-7 gap-1.5 text-center font-mono-code text-[10px] font-bold text-[var(--text-muted)]">
              {weekDayNamesShort.map((d) => (
                <div key={d} className="py-1.5">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {monthDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayTasks = tasksByDayKey.get(key) || [];
                const inMonth = isSameMonth(day, anchorDate);
                const isSelected = isSameDay(day, selectedDay);
                const isToday = isSameDay(day, todayDate);

                return (
                  <div
                    key={`mo-${key}`}
                    role="button"
                    tabIndex={0}
                    data-calendar-day={key}
                    onClick={() => setSelectedDay(day)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedDay(day);
                      }
                    }}
                    className={`min-h-[76px] sm:min-h-[118px] p-1.5 rounded-xl border text-left transition-colors flex flex-col gap-1 cursor-pointer ${
                      isSelected
                        ? "bg-[var(--brand-tint)]/55 border-[var(--brand)] ring-1 ring-[var(--brand)]/25"
                        : inMonth
                          ? "bg-[var(--bg-canvas)] border-[var(--border-subtle)] hover:border-[var(--brand-stroke)]"
                          : "bg-[var(--bg-canvas)]/40 border-[var(--border-subtle)]/50 opacity-55"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`font-mono-code text-[10.5px] font-bold tnum w-5 h-5 rounded-full inline-flex items-center justify-center ${
                          isToday
                            ? "bg-[var(--text-ink)] text-[var(--bg-surface)]"
                            : isSelected
                              ? "text-[var(--brand)]"
                              : "text-[var(--text-ink)]"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      {dayTasks.length > 0 && (
                        <span className="hidden sm:inline font-mono-code text-[9px] text-[var(--text-muted)] tnum">
                          {dayTasks.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 w-full overflow-hidden">
                      {dayTasks.slice(0, 3).map((tk) => {
                        const tone = getTaskSurfaceTone(tk);
                        return (
                          <button
                            key={`mo-tk-${tk.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTask(tk);
                            }}
                            title={`${tk.project?.name ? `[${tk.project.name}] ` : ""}${tk.title}`}
                            className={`hidden sm:flex items-center gap-1.5 w-full text-left px-1.5 py-0.5 rounded-md border text-[9.5px] font-medium truncate cursor-pointer hover:opacity-85 ${tone.card}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} />
                            <span className="truncate text-[var(--text-ink)]">{tk.title}</span>
                          </button>
                        );
                      })}

                      {dayTasks.length > 0 && (
                        <div className="flex items-center gap-0.5 sm:hidden pt-0.5">
                          {dayTasks.slice(0, 3).map((tk) => (
                            <span
                              key={`mo-dot-${tk.id}`}
                              className={`w-1.5 h-1.5 rounded-full ${getTaskSurfaceTone(tk).dot}`}
                            />
                          ))}
                          {dayTasks.length > 3 && (
                            <span className="font-mono-code text-[8px] font-bold text-[var(--brand)] ml-0.5">
                              +{dayTasks.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {dayTasks.length > 3 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDayViewForDate(day);
                          }}
                          className="hidden sm:block font-mono-code text-[9px] font-bold text-[var(--brand)] hover:underline pl-1 cursor-pointer tnum"
                        >
                          +{dayTasks.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Project-Grouped Agenda Footer */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <span className="font-mono-code text-[10.5px] font-bold uppercase text-[var(--brand)] tnum">
                  {t.projects.selectedDateTitle}: {formatShortDate(selectedDay, locale).toUpperCase()} ({selectedDayTasks.length} {t.nav.tasks})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openDayViewForDate(selectedDay)}
                  className="px-2.5 py-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[10.5px] font-semibold text-[var(--text-ink2)] hover:text-[var(--brand)] cursor-pointer inline-flex items-center gap-1"
                >
                  <Clock className="w-3 h-3" />
                  <span>{t.projects.calDay}</span>
                </button>
                {onCreateTaskAtDate && (
                  <button
                    type="button"
                    onClick={() => onCreateTaskAtDate(format(selectedDay, "yyyy-MM-dd"))}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-[10.5px] font-semibold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t.projects.newTask}</span>
                  </button>
                )}
              </div>
            </div>

            {selectedDayProjectGroups.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-6">
                {t.projects.noTasksOnDate}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {selectedDayProjectGroups.map((group) => {
                  const groupName = group.project?.name || t.projects.unassignedProject;
                  const pIdx = group.project ? (projectIndexMap.get(group.project.id) ?? 0) : 0;
                  const borderCls = PROJECT_BORDERS[pIdx % PROJECT_BORDERS.length];
                  return (
                    <div
                      key={`mo-foot-${group.projectKey}`}
                      className={`p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] border-l-4 ${borderCls} space-y-2`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-heading font-bold text-xs text-[var(--text-ink)] truncate">
                          {groupName}
                        </span>
                        <span className="font-mono-code text-[9.5px] text-[var(--text-muted)] tnum">
                          {group.completedCount}/{group.totalCount}
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                        {group.rows.map(({ task, depth }) => (
                          <div
                            key={`mo-foot-item-${task.id}`}
                            onClick={() => onSelectTask(task)}
                            style={{ marginLeft: `${Math.min(depth, 2) * 8}px` }}
                            className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] cursor-pointer flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="truncate font-medium text-[var(--text-ink)]">
                              {depth > 0 ? "↳ " : ""}
                              {task.title}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`font-mono-code text-[8.5px] font-bold px-1.5 py-0.5 rounded-full border ${getStatusPillClass(
                                  task.status
                                )}`}
                              >
                                {task.status}
                              </span>
                              <span
                                className={`font-mono-code text-[8.5px] font-bold px-1.5 py-0.5 rounded-full border ${getPriorityPillClass(
                                  task.priority
                                )}`}
                              >
                                {task.priority}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
