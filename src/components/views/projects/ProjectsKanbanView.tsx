"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderKanban,
  GripVertical,
  Layers,
  LayoutGrid,
  MessageSquare,
  Plus,
  Search,
  User,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { formatDurationCompact, formatShortDate } from "@/lib/format";
import {
  buildKanbanProjectLanes,
  computeSubtaskStatsByParent,
} from "@/lib/project-helpers";
import { useUiPref } from "@/lib/ui-prefs";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import {
  TASK_STATUSES,
  type ProjectRecord,
  type TaskRecord,
  type UserRecord,
  getActiveOpenTimeLog,
  getPriorityPillClass,
  getStatusPillClass,
  getTaskExecutorNames,
  getTotalTaskSeconds,
  hasUnreadTaskComments,
} from "./types";

interface ProjectsKanbanViewProps {
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  users: UserRecord[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onSelectTask: (t: TaskRecord) => void;
  onCreateTaskInProject?: (projectId?: string, status?: string) => void;
  onPatchTask: (taskId: string, patch: Record<string, unknown>) => Promise<void>;
  onOpenComments: (t: TaskRecord) => void;
  nowMs: number;
}

interface ProjectPalette {
  dot: string;
  border: string;
  badge: string;
}

const PROJECT_PALETTES: ProjectPalette[] = [
  {
    dot: "bg-[#0F62FE] dark:bg-[#60A5FA]",
    border: "border-l-[#0F62FE] dark:border-l-[#60A5FA]",
    badge:
      "bg-[#0F62FE] text-white dark:bg-[#60A5FA] dark:text-[#161A26]",
  },
  {
    dot: "bg-[#0D9488] dark:bg-[#2DD4BF]",
    border: "border-l-[#0D9488] dark:border-l-[#2DD4BF]",
    badge:
      "bg-[#0D9488] text-white dark:bg-[#2DD4BF] dark:text-[#161A26]",
  },
  {
    dot: "bg-[#7C3AED] dark:bg-[#A78BFA]",
    border: "border-l-[#7C3AED] dark:border-l-[#A78BFA]",
    badge:
      "bg-[#7C3AED] text-white dark:bg-[#A78BFA] dark:text-[#161A26]",
  },
  {
    dot: "bg-[#D97706] dark:bg-[#FBBF24]",
    border: "border-l-[#D97706] dark:border-l-[#FBBF24]",
    badge:
      "bg-[#D97706] text-white dark:bg-[#FBBF24] dark:text-[#161A26]",
  },
  {
    dot: "bg-[#DC2626] dark:bg-[#F87171]",
    border: "border-l-[#DC2626] dark:border-l-[#F87171]",
    badge:
      "bg-[#DC2626] text-white dark:bg-[#F87171] dark:text-[#161A26]",
  },
];

const FALLBACK_PALETTE: ProjectPalette = {
  dot: "bg-[var(--text-muted)]",
  border: "border-l-[var(--border-strong)]",
  badge: "bg-[var(--bg-subtle)] text-[var(--text-ink)]",
};

const AVATAR_TONES = [
  "bg-[#DBEAFE] text-[#1D4ED8] dark:bg-[#1E3A8A] dark:text-[#93C5FD]",
  "bg-[#D1FAE5] text-[#047857] dark:bg-[#064E3B] dark:text-[#6EE7B7]",
  "bg-[#EDE9FE] text-[#6D28D9] dark:bg-[#4C1D95] dark:text-[#DDD6FE]",
  "bg-[#FEF3C7] text-[#B45309] dark:bg-[#78350F] dark:text-[#FDE68A]",
  "bg-[#FCE7F3] text-[#BE185D] dark:bg-[#831843] dark:text-[#FBCFE8]",
];

function getColumnHeaderAccent(status: string): {
  underline: string;
  dot: string;
} {
  switch (status) {
    case "Ongoing":
      return { underline: "bg-[var(--brand)]", dot: "bg-[var(--brand)]" };
    case "Suspended":
      return { underline: "bg-[var(--warn)]", dot: "bg-[var(--warn)]" };
    case "Completed":
      return { underline: "bg-[var(--ok)]", dot: "bg-[var(--ok)]" };
    default:
      return { underline: "bg-[var(--text-muted)]/45", dot: "bg-[var(--text-muted)]" };
  }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

interface KanbanDropTarget {
  projectKey: string;
  status: string;
}

export default function ProjectsKanbanView({
  projects,
  tasks,
  users,
  selectedProjectId,
  onSelectProject,
  onSelectTask,
  onCreateTaskInProject,
  onPatchTask,
  onOpenComments,
  nowMs,
}: ProjectsKanbanViewProps) {
  const { locale, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [executorFilter, setExecutorFilter] = useState("ALL");
  const [mobileStatus, setMobileStatus] = useState<string>("Ongoing");
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});

  const [boardPref, setBoardPref] = useUiPref("projects_kanban_mode", "swimlanes");
  const [subtaskPref, setSubtaskPref] = useUiPref("projects_kanban_subtasks", "all");

  const boardMode = boardPref === "combined" ? "combined" : "swimlanes";
  const mainTasksOnly = subtaskPref === "main";
  const effectiveSwimlanes = selectedProjectId === "all" && boardMode === "swimlanes";

  const [dragSession, setDragSession] = useState<{
    taskId: string;
    title: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<KanbanDropTarget | null>(null);

  const dragSessionRef = useRef(dragSession);
  const dropTargetRef = useRef(dropTarget);
  const tasksRef = useRef(tasks);
  const onPatchRef = useRef(onPatchTask);
  const blockClickRef = useRef(false);

  useEffect(() => {
    tasksRef.current = tasks;
    onPatchRef.current = onPatchTask;
  }, [tasks, onPatchTask]);

  const usersByNameLower = useMemo(() => {
    const map = new Map<string, UserRecord>();
    for (const u of users) {
      map.set(u.name.trim().toLowerCase(), u);
    }
    return map;
  }, [users]);

  const projectPaletteMap = useMemo(() => {
    const map = new Map<string, ProjectPalette>();
    projects.forEach((p, idx) => {
      map.set(p.id, PROJECT_PALETTES[idx % PROJECT_PALETTES.length]);
    });
    return map;
  }, [projects]);

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const resolveExecutorProfiles = (tk: TaskRecord): Array<{ id: string; name: string; photo?: string | null }> => {
    if (tk.executors && tk.executors.length > 0) {
      return tk.executors.map((ex) => ({
        id: ex.userId,
        name: ex.user?.name || "User",
        photo: ex.user?.photo,
      }));
    }
    const names = getTaskExecutorNames(tk);
    return names.map((name, idx) => {
      const matched = usersByNameLower.get(name.trim().toLowerCase());
      return {
        id: matched?.id || `${tk.id}-ex-${idx}`,
        name: matched?.name || name,
        photo: matched?.photo || null,
      };
    });
  };

  const executorOptions = useMemo(() => {
    const names = new Set<string>();
    for (const tk of tasks) {
      for (const n of getTaskExecutorNames(tk)) {
        if (n) names.add(n);
      }
    }
    return [
      { value: "ALL", label: t.projects.allExecutors },
      ...[...names].sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n })),
    ];
  }, [tasks, t.projects.allExecutors]);

  const searchAndExecutorTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tasks.filter((tk) => {
      if (executorFilter !== "ALL") {
        const execs = getTaskExecutorNames(tk);
        if (!execs.includes(executorFilter)) return false;
      }
      if (!q) return true;
      const exec = getTaskExecutorNames(tk).join(" ").toLowerCase();
      return (
        tk.title.toLowerCase().includes(q) ||
        exec.includes(q) ||
        (tk.project?.name || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, executorFilter, searchQuery]);

  const projectPillCounts = useMemo(() => {
    const counts = new Map<string, { total: number; done: number }>();
    for (const tk of searchAndExecutorTasks) {
      const key = tk.projectId || "__unassigned__";
      const cur = counts.get(key) || { total: 0, done: 0 };
      const isDone = tk.status === "Completed" || tk.status === "Done";
      counts.set(key, { total: cur.total + 1, done: cur.done + (isDone ? 1 : 0) });
    }
    return counts;
  }, [searchAndExecutorTasks]);

  const visibleTasks = useMemo(() => {
    const projectScoped =
      selectedProjectId === "all"
        ? searchAndExecutorTasks
        : searchAndExecutorTasks.filter((tk) => tk.projectId === selectedProjectId);

    if (!mainTasksOnly) return projectScoped;

    const allIds = new Set(tasks.map((tk) => tk.id));
    return projectScoped.filter((tk) => !tk.parentId || !allIds.has(tk.parentId));
  }, [searchAndExecutorTasks, selectedProjectId, mainTasksOnly, tasks]);

  const subtaskStatsMap = useMemo(() => computeSubtaskStatsByParent(tasks), [tasks]);

  const projectLanes = useMemo(() => {
    const projectScoped =
      selectedProjectId === "all"
        ? searchAndExecutorTasks
        : searchAndExecutorTasks.filter((tk) => tk.projectId === selectedProjectId);

    return buildKanbanProjectLanes(projects, projectScoped, {
      mainTasksOnly,
      allTaskIds: new Set(tasks.map((tk) => tk.id)),
    });
  }, [projects, searchAndExecutorTasks, selectedProjectId, mainTasksOnly, tasks]);

  const combinedByColumn = useMemo(() => {
    const groups: Record<string, TaskRecord[]> = {
      "Not Started": [],
      Ongoing: [],
      Suspended: [],
      Completed: [],
    };
    for (const tk of visibleTasks) {
      const normalized = tk.status === "Done" ? "Completed" : tk.status;
      if (groups[normalized]) groups[normalized].push(tk);
      else groups["Not Started"].push(tk);
    }
    return groups;
  }, [visibleTasks]);

  const isLaneExpanded = (key: string) => collapsedLanes[key] !== true;
  const allLanesExpanded =
    projectLanes.length > 0 && projectLanes.every((l) => isLaneExpanded(l.projectKey));

  const toggleAllLanes = () => {
    const nextCollapsed = allLanesExpanded;
    const next: Record<string, boolean> = {};
    for (const l of projectLanes) {
      next[l.projectKey] = nextCollapsed;
    }
    setCollapsedLanes(next);
  };

  // Pointer-event Drag & Drop across Kanban columns & swimlanes
  const isTrackingPointer = dragSession !== null;

  useEffect(() => {
    if (!isTrackingPointer) return;

    const taskById = new Map(tasksRef.current.map((tk) => [tk.id, tk]));

    const hitTestColumn = (x: number, y: number): KanbanDropTarget | null => {
      const elements = document.elementsFromPoint(x, y);
      for (const el of elements) {
        if (!(el instanceof HTMLElement)) continue;
        const colEl = el.closest("[data-kanban-column='true']") as HTMLElement | null;
        if (colEl?.dataset.status) {
          return {
            projectKey: colEl.dataset.projectKey || "__all__",
            status: colEl.dataset.status,
          };
        }
      }
      return null;
    };

    const handlePointerMove = (ev: PointerEvent) => {
      const current = dragSessionRef.current;
      if (!current) return;
      const dist = Math.hypot(ev.clientX - current.startX, ev.clientY - current.startY);
      if (!current.active && dist < 5) return;

      if (!current.active) {
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        blockClickRef.current = true;
      }

      const nextSession = { ...current, active: true, x: ev.clientX, y: ev.clientY };
      dragSessionRef.current = nextSession;
      setDragSession(nextSession);

      const nextTarget = hitTestColumn(ev.clientX, ev.clientY);
      const prev = dropTargetRef.current;
      if (
        prev?.projectKey !== nextTarget?.projectKey ||
        prev?.status !== nextTarget?.status
      ) {
        dropTargetRef.current = nextTarget;
        setDropTarget(nextTarget);
      }
    };

    const cleanup = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      dragSessionRef.current = null;
      dropTargetRef.current = null;
      setDragSession(null);
      setDropTarget(null);
      setTimeout(() => {
        blockClickRef.current = false;
      }, 60);
    };

    const handlePointerUp = () => {
      const current = dragSessionRef.current;
      const finalTarget = dropTargetRef.current;
      cleanup();

      if (!current?.active || !finalTarget) return;
      const movingTask = taskById.get(current.taskId);
      if (!movingTask) return;

      const patch: Record<string, unknown> = {};
      const normalizedCurStatus = movingTask.status === "Done" ? "Completed" : movingTask.status;
      if (normalizedCurStatus !== finalTarget.status) {
        patch.status = finalTarget.status;
      }
      if (
        finalTarget.projectKey !== "__all__" &&
        finalTarget.projectKey !== "__unassigned__" &&
        !movingTask.parentId &&
        movingTask.projectId !== finalTarget.projectKey
      ) {
        patch.projectId = finalTarget.projectKey;
      }

      if (Object.keys(patch).length > 0) {
        void onPatchRef.current(movingTask.id, patch);
      }
    };

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") cleanup();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTrackingPointer]);

  const startCardDrag = (e: React.PointerEvent, tk: TaskRecord) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, [data-no-drag='true']")) return;

    dropTargetRef.current = null;
    const nextSession = {
      taskId: tk.id,
      title: tk.title,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
    };
    dragSessionRef.current = nextSession;
    setDragSession(nextSession);
  };

  const renderCard = (tk: TaskRecord, hideProjectBadge = false) => {
    const parent = tk.parentId ? tasksById.get(tk.parentId) : null;
    const profiles = resolveExecutorProfiles(tk);
    const secs = getTotalTaskSeconds(tk, nowMs);
    const isRunning = Boolean(getActiveOpenTimeLog(tk));
    const commentCount = tk.comments?.length || 0;
    const unread = hasUnreadTaskComments(tk);
    const done = tk.status === "Completed" || tk.status === "Done";
    const isOverdue = !done && new Date(tk.endDate).getTime() < nowMs;
    const palette = tk.projectId
      ? projectPaletteMap.get(tk.projectId) || FALLBACK_PALETTE
      : FALLBACK_PALETTE;
    const subStats = subtaskStatsMap.get(tk.id);
    const isDraggingThis = dragSession?.active && dragSession.taskId === tk.id;

    // Progress bar calculation (Screenshot 2 signature, Royal Medica status palette)
    let progressLabel = "0%";
    let progressPct = 0;
    if (subStats && subStats.total > 0) {
      progressLabel = `${subStats.completed}/${subStats.total}`;
      progressPct = Math.round((subStats.completed / subStats.total) * 100);
    } else if (done) {
      progressLabel = "100%";
      progressPct = 100;
    } else if (tk.status === "Ongoing") {
      progressLabel = "50%";
      progressPct = 50;
    } else if (tk.status === "Suspended") {
      progressLabel = "25%";
      progressPct = 25;
    }

    const progressBarColor = done
      ? "bg-[var(--ok)]"
      : isOverdue
        ? "bg-[var(--err)]"
        : tk.status === "Suspended"
          ? "bg-[var(--warn)]"
          : tk.status === "Ongoing"
            ? "bg-[var(--brand)]"
            : "bg-[var(--text-muted)]/35";

    const contextText = parent
      ? `↳ ${parent.title}`
      : tk.issue || tk.solution || tk.documentation || null;

    return (
      <div
        key={tk.id}
        data-kanban-card={tk.id}
        onPointerDown={(e) => startCardDrag(e, tk)}
        onClick={() => {
          if (blockClickRef.current) return;
          onSelectTask(tk);
        }}
        className={`group bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] rounded-2xl p-3.5 shadow-2xs space-y-2.5 cursor-grab active:cursor-grabbing touch-none transition-all select-none ${
          isDraggingThis ? "opacity-40 scale-[0.98]" : "hover:shadow-sm"
        }`}
      >
        {/* Top Tag Pill + Grab Handle + Live/Overdue */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {!hideProjectBadge && tk.project?.name ? (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight truncate max-w-[180px] ${palette.badge}`}
              >
                {tk.project.name}
              </span>
            ) : parent ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand-tint)] text-[var(--brand)] border border-[var(--brand-stroke)] truncate max-w-[180px]">
                {parent.title}
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--bg-subtle)] text-[var(--text-ink2)]">
                Main Task
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isRunning && (
              <span className="font-mono-code text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-stroke)] text-[var(--ok)]">
                ● LIVE
              </span>
            )}
            {isOverdue && (
              <span className="font-mono-code text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--err-bg)] text-[var(--err)]">
                OVERDUE
              </span>
            )}
            <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)]/45 group-hover:text-[var(--brand)] transition-colors" />
          </div>
        </div>

        {/* Title & Concise Context Line */}
        <div className="space-y-1">
          <h4 className="font-heading font-bold text-[13px] text-[var(--text-ink)] line-clamp-2 leading-snug">
            {tk.title}
          </h4>
          {contextText && (
            <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">
              {contextText}
            </p>
          )}
        </div>

        {/* Clean Progress Section (Screenshot 2 layout + Royal Medica semantic colors) */}
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="font-medium text-[var(--text-muted)]">
              {t.projects.progressLabel}
            </span>
            <span className="font-mono-code font-bold text-[var(--text-ink)] tnum">
              {progressLabel}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Metadata Telemetry Row (Comments, TimeLog, Date) */}
        <div className="flex items-center gap-3 text-[10.5px] font-mono-code text-[var(--text-muted)] tnum">
          <button
            type="button"
            data-no-drag="true"
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments(tk);
            }}
            className={`relative inline-flex items-center gap-1 hover:text-[var(--brand)] cursor-pointer ${
              unread ? "text-[var(--brand)] font-bold" : ""
            }`}
            aria-label="Open comments"
          >
            <MessageSquare className="w-3 h-3" />
            <span>{commentCount}</span>
            {unread && (
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
            )}
          </button>

          <span className={`inline-flex items-center gap-1 ${isRunning ? "text-[var(--ok)] font-bold" : ""}`}>
            <Clock className="w-3 h-3" />
            <span>{formatDurationCompact(secs)}</span>
          </span>

          <span className={`inline-flex items-center gap-1 ml-auto ${isOverdue ? "text-[var(--err)] font-semibold" : ""}`}>
            <Calendar className="w-3 h-3" />
            <span>{formatShortDate(tk.endDate, locale)}</span>
          </span>
        </div>

        {/* Footer: Overlapping Profile Avatars + Priority Badge */}
        <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center min-w-0">
            {profiles.length > 0 ? (
              <div className="flex items-center -space-x-2">
                {profiles.slice(0, 3).map((prof, idx) => (
                  <div
                    key={prof.id}
                    title={prof.name}
                    className={`w-6 h-6 rounded-full ring-2 ring-[var(--bg-surface)] flex items-center justify-center overflow-hidden font-mono-code text-[9px] font-bold shrink-0 ${
                      AVATAR_TONES[idx % AVATAR_TONES.length]
                    }`}
                  >
                    {prof.photo ? (
                      <Image
                        src={prof.photo}
                        alt={prof.name}
                        width={24}
                        height={24}
                        unoptimized
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getInitials(prof.name)
                    )}
                  </div>
                ))}
                {profiles.length > 3 && (
                  <div
                    title={profiles
                      .slice(3)
                      .map((p) => p.name)
                      .join(", ")}
                    className="w-6 h-6 rounded-full ring-2 ring-[var(--bg-surface)] bg-[var(--bg-subtle)] text-[var(--text-ink2)] flex items-center justify-center font-mono-code text-[9px] font-bold shrink-0"
                  >
                    +{profiles.length - 3}
                  </div>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <User className="w-3 h-3" />
                <span>—</span>
              </span>
            )}
          </div>

          <span
            className={`font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getPriorityPillClass(
              tk.priority
            )}`}
          >
            {tk.priority}
          </span>
        </div>
      </div>
    );
  };

  const renderColumnsGrid = (
    laneTasks: TaskRecord[],
    projectKey: string,
    options?: { hideProjectBadge?: boolean; maxColumnHeight?: boolean; projectIdForAdd?: string }
  ) => {
    const colMap: Record<string, TaskRecord[]> = {
      "Not Started": [],
      Ongoing: [],
      Suspended: [],
      Completed: [],
    };
    for (const tk of laneTasks) {
      const normalized = tk.status === "Done" ? "Completed" : tk.status;
      if (colMap[normalized]) colMap[normalized].push(tk);
      else colMap["Not Started"].push(tk);
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 items-start">
        {TASK_STATUSES.map((col) => {
          const items = colMap[col] || [];
          const isTarget =
            dropTarget?.projectKey === projectKey && dropTarget?.status === col;
          const colStyle = getColumnHeaderAccent(col);

          return (
            <div
              key={`${projectKey}-${col}`}
              data-kanban-column="true"
              data-project-key={projectKey}
              data-status={col}
              className={`rounded-2xl p-2.5 space-y-3 border transition-colors ${
                options?.maxColumnHeight ? "min-h-[180px]" : "min-h-[420px]"
              } ${
                isTarget
                  ? "border-[var(--brand)] bg-[var(--brand-tint)]/35 ring-1 ring-[var(--brand)]"
                  : "border-[var(--border-subtle)]/70 bg-[var(--bg-canvas)]/70"
              }`}
            >
              {/* Clean Screenshot-2 Column Header + 2px Colored Underline */}
              <div className="space-y-2 px-1 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${colStyle.dot}`} />
                    <span className="font-mono-code text-[11px] font-bold uppercase tracking-wider text-[var(--text-ink)]">
                      {col}
                    </span>
                    <span className="font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink2)] tnum">
                      {items.length}
                    </span>
                  </div>

                  {onCreateTaskInProject && (
                    <button
                      type="button"
                      onClick={() => onCreateTaskInProject(options?.projectIdForAdd, col)}
                      title={`${t.projects.addCard} (${col})`}
                      className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--bg-surface)] cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className={`h-[2.5px] w-full rounded-full ${colStyle.underline}`} />
              </div>

              <div
                className={`space-y-2.5 ${
                  options?.maxColumnHeight ? "max-h-[480px] overflow-y-auto pr-0.5" : ""
                }`}
              >
                {items.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-muted)] text-center py-6 border border-dashed border-[var(--border-subtle)] rounded-xl">
                    —
                  </p>
                ) : (
                  items.map((tk) => renderCard(tk, options?.hideProjectBadge))
                )}
              </div>

              {onCreateTaskInProject && col !== "Completed" && (
                <button
                  type="button"
                  onClick={() => onCreateTaskInProject(options?.projectIdForAdd, col)}
                  className="w-full py-2 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]/70 hover:bg-[var(--bg-surface)] hover:border-[var(--brand)] text-[11.5px] font-semibold text-[var(--text-muted)] hover:text-[var(--brand)] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.projects.addCard}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const projectOptions = [
    { value: "all", label: t.projects.allProjects },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const activeSingleProject =
    selectedProjectId !== "all" ? projects.find((p) => p.id === selectedProjectId) || null : null;

  return (
    <div className="space-y-3.5 w-full">
      {/* Kanban Toolbar & Quick Project Filter Strip */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3 space-y-2.5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5">
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
              value={executorFilter}
              onChange={setExecutorFilter}
              options={executorOptions}
              icon={<User className="w-3.5 h-3.5" />}
              className="min-w-[160px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Main Tasks Only vs All Tasks toggle */}
            <div className="inline-flex items-center bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setSubtaskPref("all")}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                  !mainTasksOnly
                    ? "bg-[var(--brand)] text-white dark:text-[#161A26]"
                    : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                }`}
              >
                {t.projects.allTasksMode}
              </button>
              <button
                type="button"
                onClick={() => setSubtaskPref("main")}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                  mainTasksOnly
                    ? "bg-[var(--brand)] text-white dark:text-[#161A26]"
                    : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                }`}
              >
                {t.projects.mainTasksOnly}
              </button>
            </div>

            {/* Swimlanes vs Combined Board toggle (shown when All Projects active) */}
            {selectedProjectId === "all" && (
              <div className="hidden md:inline-flex items-center bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => setBoardPref("swimlanes")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    boardMode === "swimlanes"
                      ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                      : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>{t.projects.swimlanesMode}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBoardPref("combined")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                    boardMode === "combined"
                      ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                      : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>{t.projects.singleBoardMode}</span>
                </button>
              </div>
            )}

            {effectiveSwimlanes && projectLanes.length > 1 && (
              <button
                type="button"
                onClick={toggleAllLanes}
                className="hidden md:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] text-[11px] font-medium text-[var(--text-ink2)] hover:text-[var(--text-ink)] transition-colors cursor-pointer"
              >
                {allLanesExpanded ? (
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
        </div>

        {/* Row 2: One-Click Project Filter Pills */}
        {projects.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible pt-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => onSelectProject("all")}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-colors cursor-pointer ${
                selectedProjectId === "all"
                  ? "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]"
                  : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
              }`}
            >
              <span>{t.projects.allProjects}</span>
              <span className="font-mono-code text-[10px] opacity-80 tnum">
                ({searchAndExecutorTasks.length})
              </span>
            </button>
            {projects.map((proj) => {
              const c = projectPillCounts.get(proj.id) || { total: 0, done: 0 };
              const pal = projectPaletteMap.get(proj.id) || FALLBACK_PALETTE;
              const isSelected = selectedProjectId === proj.id;
              return (
                <button
                  key={`pill-${proj.id}`}
                  type="button"
                  onClick={() => onSelectProject(isSelected ? "all" : proj.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]"
                      : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${pal.dot}`} />
                  <span className="max-w-[160px] truncate">{proj.name}</span>
                  <span className="font-mono-code text-[10px] opacity-75 tnum">
                    {c.done}/{c.total}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile Column Switcher (< md) */}
      <div className="md:hidden flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full p-1 gap-1 overflow-x-auto">
        {TASK_STATUSES.map((col) => (
          <button
            key={col}
            type="button"
            onClick={() => setMobileStatus(col)}
            className={`px-3 py-1 rounded-full font-mono-code text-[10px] font-bold whitespace-nowrap transition-colors ${
              mobileStatus === col
                ? "bg-[var(--brand)] text-white dark:text-[#161A26]"
                : "text-[var(--text-ink2)]"
            }`}
          >
            {col} ({combinedByColumn[col]?.length || 0})
          </button>
        ))}
      </div>

      {/* Mobile Cards (< md) */}
      <div className="md:hidden space-y-2.5">
        {(combinedByColumn[mobileStatus] || []).map((tk) => renderCard(tk, false))}
        {(combinedByColumn[mobileStatus] || []).length === 0 && (
          <p className="text-xs text-[var(--text-muted)] text-center py-8 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)]">
            No tasks in {mobileStatus}.
          </p>
        )}
      </div>

      {/* Desktop / Tablet Board: Swimlanes (All Projects default) OR Single Project / Combined */}
      <div className="hidden md:block space-y-4">
        {effectiveSwimlanes ? (
          projectLanes.length === 0 ? (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl py-10 text-center text-xs text-[var(--text-muted)]">
              No tasks match your current filters.
            </div>
          ) : (
            projectLanes.map((lane) => {
              const expanded = isLaneExpanded(lane.projectKey);
              const pct =
                lane.totalCount > 0
                  ? Math.round((lane.completedCount / lane.totalCount) * 100)
                  : 0;
              const laneName = lane.project?.name || t.projects.unassignedProject;
              const pal = lane.project
                ? projectPaletteMap.get(lane.project.id) || FALLBACK_PALETTE
                : FALLBACK_PALETTE;

              return (
                <section
                  key={`lane-${lane.projectKey}`}
                  data-kanban-lane={lane.projectKey}
                  className="bg-[var(--bg-surface)]/55 border border-[var(--border-subtle)] rounded-2xl p-3 space-y-3"
                >
                  {/* Collapsible Project Swimlane Header */}
                  <div
                    className={`flex items-center justify-between gap-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] border-l-4 ${pal.border} rounded-xl px-3 py-2`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedLanes((prev) => ({
                            ...prev,
                            [lane.projectKey]: expanded,
                          }))
                        }
                        aria-label={`Toggle swimlane ${laneName}`}
                        className="p-1 rounded-md text-[var(--text-ink2)] hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
                      >
                        {expanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedLanes((prev) => ({
                            ...prev,
                            [lane.projectKey]: expanded,
                          }))
                        }
                        className="font-heading font-bold text-[13px] text-[var(--text-ink)] hover:text-[var(--brand)] truncate cursor-pointer"
                      >
                        {laneName}
                      </button>
                      {lane.project?.status && (
                        <span
                          className={`font-mono-code text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase shrink-0 ${getStatusPillClass(
                            lane.project.status
                          )}`}
                        >
                          {lane.project.status}
                        </span>
                      )}
                      <span className="font-mono-code text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] tnum shrink-0">
                        {lane.completedCount}/{lane.totalCount} Tasks · {pct}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {lane.project && (
                        <button
                          type="button"
                          onClick={() => onSelectProject(lane.project!.id)}
                          className="px-2.5 py-1 rounded-full text-[10.5px] font-medium text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
                        >
                          Focus
                        </button>
                      )}
                      {lane.project && onCreateTaskInProject && (
                        <button
                          type="button"
                          onClick={() => onCreateTaskInProject(lane.project!.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-[10.5px] font-semibold text-[var(--brand)] cursor-pointer transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{t.projects.newTask}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {expanded &&
                    renderColumnsGrid(lane.tasks, lane.projectKey, {
                      hideProjectBadge: true,
                      maxColumnHeight: true,
                      projectIdForAdd: lane.project?.id,
                    })}
                </section>
              );
            })
          )
        ) : (
          renderColumnsGrid(
            visibleTasks,
            activeSingleProject?.id || "__all__",
            {
              hideProjectBadge: Boolean(activeSingleProject),
              maxColumnHeight: false,
              projectIdForAdd: activeSingleProject?.id,
            }
          )
        )}
      </div>

      {/* Floating Portal Drag Preview Pill */}
      {dragSession?.active &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              transform: `translate3d(${dragSession.x + 14}px, ${dragSession.y + 14}px, 0)`,
            }}
            className="z-[10060] pointer-events-none px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--brand)] shadow-xl flex items-center gap-2 text-xs font-semibold text-[var(--text-ink)]"
          >
            <GripVertical className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
            <span className="max-w-[220px] truncate">{dragSession.title}</span>
            {dropTarget && (
              <span className="font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-tint)] text-[var(--brand)] shrink-0">
                {t.projects.moveCardTo} {dropTarget.status}
              </span>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
