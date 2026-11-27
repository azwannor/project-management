"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Clock,
  CornerDownRight,
  Edit3,
  FolderKanban,
  GripVertical,
  MessageSquare,
  Plus,
  Search,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { formatDurationCompact, formatShortDate } from "@/lib/format";
import {
  buildProjectGroupedTaskTrees,
  type ReorderDropMode,
  wouldCreateTaskCycle,
} from "@/lib/project-helpers";
import { useUiPref } from "@/lib/ui-prefs";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ProjectRecord,
  type TaskRecord,
  getActiveOpenTimeLog,
  getPriorityPillClass,
  getStatusPillClass,
  getTaskExecutorNames,
  getTotalTaskSeconds,
  hasUnreadTaskComments,
} from "./types";

interface ProjectsTableViewProps {
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onSelectTask: (t: TaskRecord) => void;
  onAddSubtask: (parentTask: TaskRecord) => void;
  onCreateTaskInProject?: (projectId: string) => void;
  onOpenComments: (t: TaskRecord) => void;
  onPatchTask: (taskId: string, patch: Record<string, unknown>) => Promise<void>;
  onReorderTask: (params: {
    taskId: string;
    targetTaskId?: string | null;
    mode: ReorderDropMode;
    targetProjectId?: string | null;
  }) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onQuickCreateTask: (title: string, projectId: string) => Promise<void>;
  onRemindTask: (taskId: string) => Promise<void>;
  nowMs: number;
}

type DropTargetState =
  | { kind: "task"; taskId: string; mode: "before" | "after" | "inside" }
  | { kind: "project"; projectKey: string }
  | { kind: "root" }
  | null;

const MIN_ZOOM = 70;
const MAX_ZOOM = 130;
const ZOOM_STEP = 10;

export default function ProjectsTableView({
  projects,
  tasks,
  selectedProjectId,
  onSelectProject,
  onSelectTask,
  onAddSubtask,
  onCreateTaskInProject,
  onOpenComments,
  onPatchTask,
  onReorderTask,
  onDeleteTask,
  onQuickCreateTask,
  onRemindTask,
  nowMs,
}: ProjectsTableViewProps) {
  const { locale, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [dragSession, setDragSession] = useState<{
    taskId: string;
    title: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetState>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);

  const draggedTaskId = dragSession?.active ? dragSession.taskId : null;
  const dragSessionRef = useRef(dragSession);
  const dropTargetRef = useRef(dropTarget);
  const tasksRef = useRef(tasks);
  const onReorderRef = useRef(onReorderTask);

  useEffect(() => {
    tasksRef.current = tasks;
    onReorderRef.current = onReorderTask;
  }, [tasks, onReorderTask]);

  const [zoomPref, setZoomPref] = useUiPref("projects_table_zoom", "100");
  const parsedZoom = Number(zoomPref);
  const tableZoom =
    Number.isFinite(parsedZoom) && parsedZoom >= MIN_ZOOM && parsedZoom <= MAX_ZOOM
      ? parsedZoom
      : 100;

  const updateZoom = (next: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    setZoomPref(String(clamped));
  };

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

  const runningTimerSeconds = useMemo(() => {
    const active = tasks.find((tk) => Boolean(getActiveOpenTimeLog(tk)));
    return active ? getTotalTaskSeconds(active, nowMs) : 0;
  }, [tasks, nowMs]);

  const isParentExpanded = (id: string) => expandedParents[id] !== false;
  const isProjectExpanded = (key: string) => expandedProjects[key] !== false;

  const allProjectsExpanded =
    projectGroups.length > 0 && projectGroups.every((g) => isProjectExpanded(g.projectKey));

  const toggleAllProjects = () => {
    const targetState = !allProjectsExpanded;
    const next: Record<string, boolean> = {};
    for (const g of projectGroups) {
      next[g.projectKey] = targetState;
    }
    setExpandedProjects(next);
  };

  const updateDropTarget = (next: DropTargetState) => {
    setDropTarget((prev) => {
      if (prev === null && next === null) return prev;
      if (
        prev?.kind === "task" &&
        next?.kind === "task" &&
        prev.taskId === next.taskId &&
        prev.mode === next.mode
      ) {
        return prev;
      }
      if (
        prev?.kind === "project" &&
        next?.kind === "project" &&
        prev.projectKey === next.projectKey
      ) {
        return prev;
      }
      if (prev?.kind === "root" && next?.kind === "root") return prev;
      return next;
    });
  };

  const resolveTaskDropModeAtPoint = (
    clientY: number,
    rowRect: DOMRect,
    movingId: string,
    targetTask: TaskRecord,
    taskList: TaskRecord[]
  ): "before" | "after" | "inside" | null => {
    if (movingId === targetTask.id) return null;
    const canReorderAtTargetLevel =
      !targetTask.parentId || !wouldCreateTaskCycle(movingId, targetTask.parentId, taskList);
    const canNestInsideTarget = !wouldCreateTaskCycle(movingId, targetTask.id, taskList);

    if (!canReorderAtTargetLevel && !canNestInsideTarget) return null;

    const relY = rowRect.height > 0 ? (clientY - rowRect.top) / rowRect.height : 0.5;

    if (!canNestInsideTarget) {
      return relY < 0.5 ? "before" : "after";
    }
    if (!canReorderAtTargetLevel) {
      return "inside";
    }
    if (relY < 0.3) return "before";
    if (relY > 0.7) return "after";
    return "inside";
  };

  const isTrackingPointer = dragSession !== null;

  useEffect(() => {
    if (!isTrackingPointer) return;

    const taskById = new Map(tasksRef.current.map((tk) => [tk.id, tk]));

    const hitTestTarget = (clientX: number, clientY: number, movingId: string): DropTargetState => {
      const elements = document.elementsFromPoint(clientX, clientY);
      for (const el of elements) {
        if (!(el instanceof HTMLElement)) continue;
        const rootZone = el.closest("[data-root-dropzone='true']");
        if (rootZone) return { kind: "root" };

        const projectRow = el.closest("[data-project-key]") as HTMLElement | null;
        if (projectRow?.dataset.projectKey) {
          return { kind: "project", projectKey: projectRow.dataset.projectKey };
        }

        const taskRow = el.closest("tr[data-task-id]") as HTMLElement | null;
        const targetId = taskRow?.dataset.taskId;
        if (taskRow && targetId && targetId !== movingId) {
          const targetTask = taskById.get(targetId);
          if (!targetTask) continue;
          const mode = resolveTaskDropModeAtPoint(
            clientY,
            taskRow.getBoundingClientRect(),
            movingId,
            targetTask,
            tasksRef.current
          );
          if (mode) return { kind: "task", taskId: targetId, mode };
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
      }

      const nextSession = { ...current, active: true, x: ev.clientX, y: ev.clientY };
      dragSessionRef.current = nextSession;
      setDragSession(nextSession);

      const nextTarget = hitTestTarget(ev.clientX, ev.clientY, current.taskId);
      dropTargetRef.current = nextTarget;
      updateDropTarget(nextTarget);
    };

    const cleanup = () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      dragSessionRef.current = null;
      dropTargetRef.current = null;
      setDragSession(null);
      setDropTarget(null);
    };

    const handlePointerUp = () => {
      const current = dragSessionRef.current;
      const finalTarget = dropTargetRef.current;
      cleanup();

      if (!current?.active || !finalTarget) return;
      if (finalTarget.kind === "root") {
        void onReorderRef.current({ taskId: current.taskId, targetTaskId: null, mode: "root" });
      } else if (finalTarget.kind === "project") {
        void onReorderRef.current({
          taskId: current.taskId,
          targetTaskId: null,
          mode: "root",
          targetProjectId: finalTarget.projectKey,
        });
      } else if (finalTarget.kind === "task") {
        if (finalTarget.mode === "inside" && wouldCreateTaskCycle(current.taskId, finalTarget.taskId, tasksRef.current)) {
          setDragError("Cannot move a parent task inside its own subtask hierarchy.");
          setTimeout(() => setDragError(null), 3500);
          return;
        }
        void onReorderRef.current({
          taskId: current.taskId,
          targetTaskId: finalTarget.taskId,
          mode: finalTarget.mode,
        });
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

  const startPointerDrag = (e: React.PointerEvent, task: TaskRecord) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dropTargetRef.current = null;
    const nextSession = {
      taskId: task.id,
      title: task.title,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
    };
    dragSessionRef.current = nextSession;
    setDragSession(nextSession);
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    const targetProj =
      selectedProjectId !== "all" ? selectedProjectId : projects[0]?.id || "";
    if (!targetProj) return;
    setQuickBusy(true);
    try {
      await onQuickCreateTask(quickTitle.trim(), targetProj);
      setQuickTitle("");
    } finally {
      setQuickBusy(false);
    }
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
      {/* Filter & Zoom Toolbar (hosts zero-shift Root Dropzone overlay during drag) */}
      <div className="relative bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-2.5">
        {draggedTaskId && (
          <div
            data-root-dropzone="true"
            className={`absolute inset-0 z-20 rounded-2xl border-2 border-dashed flex items-center justify-center font-mono-code text-xs font-bold transition-colors backdrop-blur-[2px] ${
              dropTarget?.kind === "root"
                ? "bg-[var(--brand-tint)]/95 border-[var(--brand)] text-[var(--brand)]"
                : "bg-[var(--bg-surface)]/95 border-[var(--brand-stroke)] text-[var(--text-ink2)]"
            }`}
          >
            {t.projects.dropHereToPromote}
          </div>
        )}
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
          {/* Table-Only Zoom Controls (70% - 130%) */}
          <div
            className="hidden md:inline-flex items-center bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5"
            role="group"
            aria-label="Table zoom controls"
          >
            <button
              type="button"
              onClick={() => updateZoom(tableZoom - ZOOM_STEP)}
              disabled={tableZoom <= MIN_ZOOM}
              title={t.projects.zoomOut}
              aria-label={t.projects.zoomOut}
              className="p-1.5 rounded-full text-[var(--text-ink2)] hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)] disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateZoom(100)}
              title={t.projects.resetZoom}
              className="font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] tnum cursor-pointer min-w-[42px] text-center"
            >
              {tableZoom}%
            </button>
            <button
              type="button"
              onClick={() => updateZoom(tableZoom + ZOOM_STEP)}
              disabled={tableZoom >= MAX_ZOOM}
              title={t.projects.zoomIn}
              aria-label={t.projects.zoomIn}
              className="p-1.5 rounded-full text-[var(--text-ink2)] hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)] disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {runningTimerSeconds > 0 && (
            <span className="font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-stroke)] text-[var(--ok)] tnum">
              {t.projects.liveTimer} · {formatDurationCompact(runningTimerSeconds)}
            </span>
          )}
          <span className="hidden sm:inline-flex font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)]">
            {t.projects.dragToReparent}
          </span>
        </div>
      </div>

      {dragError && (
        <div className="px-3.5 py-2 rounded-xl bg-[var(--err-bg)] border border-[var(--err-stroke)] text-xs font-semibold text-[var(--err)]">
          {dragError}
        </div>
      )}

      {/* Desktop / Tablet Hierarchical Table (Project -> Main Task -> Subtask, zoomed independently) */}
      <div className="hidden md:block w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto w-full">
          <div style={{ zoom: tableZoom / 100 }} className="w-full" data-testid="table-zoom-container">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)] font-mono-code text-[10px] uppercase text-[var(--text-muted)]">
                  <th className="py-2.5 px-3 w-[34%] min-w-[260px]">Task Hierarchy</th>
                  <th className="py-2.5 px-2.5 w-[12%]">Project</th>
                  <th className="py-2.5 px-2.5 w-[13%]">Executor</th>
                  <th className="py-2.5 px-2.5 w-[140px]">Status</th>
                  <th className="py-2.5 px-2.5 w-[114px]">Priority</th>
                  <th className="py-2.5 px-2.5 whitespace-nowrap">Timeline</th>
                  <th className="py-2.5 px-2.5 text-right whitespace-nowrap">TimeLog</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {projectGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      No tasks match your current filters.
                    </td>
                  </tr>
                ) : (
                  projectGroups.map((group) => {
                    const projectExpanded = isProjectExpanded(group.projectKey);
                    const pct =
                      group.totalCount > 0
                        ? Math.round((group.completedCount / group.totalCount) * 100)
                        : 0;
                    const groupName = group.project?.name || t.projects.unassignedProject;
                    const isGroupDropHover =
                      dropTarget?.kind === "project" && dropTarget.projectKey === group.projectKey;

                    return (
                      <Fragment key={`proj-group-${group.projectKey}`}>
                        {/* Top-Level Project Parent Row */}
                        <tr
                          data-project-key={group.projectKey}
                          className={`border-t border-b border-[var(--border-subtle)] transition-colors ${
                            isGroupDropHover
                              ? "bg-[var(--brand-tint)] ring-1 ring-inset ring-[var(--brand)]"
                              : "bg-[var(--bg-subtle)]/55 hover:bg-[var(--bg-subtle)]"
                          }`}
                        >
                          <td colSpan={8} className="py-2 px-3 border-l-4 border-l-[var(--brand)]">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedProjects((prev) => ({
                                      ...prev,
                                      [group.projectKey]: !projectExpanded,
                                    }))
                                  }
                                  className="p-1 rounded-md text-[var(--text-ink2)] hover:text-[var(--brand)] hover:bg-[var(--bg-surface)] cursor-pointer shrink-0"
                                  aria-label={`Toggle ${groupName}`}
                                >
                                  {projectExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                                <div className="w-6 h-6 rounded-lg bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] flex items-center justify-center shrink-0">
                                  <FolderKanban className="w-3.5 h-3.5" />
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedProjects((prev) => ({
                                      ...prev,
                                      [group.projectKey]: !projectExpanded,
                                    }))
                                  }
                                  className="font-heading font-bold text-[12.5px] text-[var(--text-ink)] hover:text-[var(--brand)] truncate cursor-pointer"
                                >
                                  {groupName}
                                </button>
                                {group.project?.status && (
                                  <span
                                    className={`font-mono-code text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase shrink-0 ${getStatusPillClass(
                                      group.project.status
                                    )}`}
                                  >
                                    {group.project.status}
                                  </span>
                                )}
                                <span className="font-mono-code text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink2)] tnum shrink-0">
                                  {group.completedCount}/{group.totalCount} Tasks · {pct}%
                                </span>
                                {isGroupDropHover && (
                                  <span className="font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] shrink-0">
                                    {t.projects.dropToProject}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {group.project && onCreateTaskInProject && (
                                  <button
                                    type="button"
                                    onClick={() => onCreateTaskInProject(group.project!.id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-[10.5px] font-semibold text-[var(--brand)] cursor-pointer transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>{t.projects.newTask}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Nested Main Tasks & Subtasks Under Project */}
                        {projectExpanded &&
                          group.rows.map(({ task, depth, childCount }) => {
                            if (depth > 0 && task.parentId && !isParentExpanded(task.parentId)) {
                              return null;
                            }
                            const execNames = getTaskExecutorNames(task);
                            const secs = getTotalTaskSeconds(task, nowMs);
                            const isRunning = Boolean(getActiveOpenTimeLog(task));
                            const unread = hasUnreadTaskComments(task);
                            const isSelfDragging = draggedTaskId === task.id;
                            const activeDropMode =
                              dropTarget?.kind === "task" && dropTarget.taskId === task.id
                                ? dropTarget.mode
                                : null;

                            const dropBoxShadow =
                              activeDropMode === "before"
                                ? "inset 0 3px 0 0 var(--brand)"
                                : activeDropMode === "after"
                                  ? "inset 0 -3px 0 0 var(--brand)"
                                  : activeDropMode === "inside"
                                    ? "inset 0 0 0 1.5px var(--brand)"
                                    : undefined;

                            return (
                              <tr
                                key={task.id}
                                data-task-id={task.id}
                                style={dropBoxShadow ? { boxShadow: dropBoxShadow } : undefined}
                                className={`group transition-colors ${
                                  depth > 0 ? "bg-[var(--bg-canvas)]/60" : ""
                                } ${isSelfDragging ? "opacity-40" : ""} ${
                                  activeDropMode === "inside"
                                    ? "bg-[var(--brand-tint)]"
                                    : activeDropMode
                                      ? "bg-[var(--brand-tint)]/35"
                                      : "hover:bg-[var(--bg-subtle)]/40"
                                }`}
                              >
                                <td className="py-2 px-3">
                                  <div
                                    className="flex items-center gap-1.5 min-w-0"
                                    style={{ paddingLeft: `${18 + depth * 18}px` }}
                                  >
                                    <button
                                      type="button"
                                      data-drag-handle={task.id}
                                      onPointerDown={(e) => startPointerDrag(e, task)}
                                      aria-label={t.projects.dragToReparent}
                                      title={t.projects.dragToReparent}
                                      className="p-1 -ml-1 rounded-md text-[var(--text-muted)]/75 hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)] cursor-grab active:cursor-grabbing touch-none shrink-0 transition-colors"
                                    >
                                      <GripVertical className="w-3.5 h-3.5" />
                                    </button>
                                    {depth > 0 ? (
                                      <CornerDownRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                                    ) : childCount > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedParents((p) => ({
                                            ...p,
                                            [task.id]: !isParentExpanded(task.id),
                                          }))
                                        }
                                        className="p-0.5 text-[var(--text-muted)] hover:text-[var(--brand)] cursor-pointer"
                                      >
                                        {isParentExpanded(task.id) ? (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="w-4 shrink-0" />
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onSelectTask(task)}
                                      className={`${
                                        depth === 0 ? "font-semibold" : "font-medium"
                                      } text-[var(--text-ink)] hover:text-[var(--brand)] truncate text-left cursor-pointer`}
                                    >
                                      {task.title}
                                    </button>
                                    {childCount > 0 && (
                                      <span className="font-mono-code text-[9.5px] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)] shrink-0 tnum">
                                        {childCount}
                                      </span>
                                    )}
                                    {activeDropMode && (
                                      <span className="font-mono-code text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] shrink-0 whitespace-nowrap">
                                        {activeDropMode === "before"
                                          ? `↑ ${t.projects.dropAbove}`
                                          : activeDropMode === "after"
                                            ? `↓ ${t.projects.dropBelow}`
                                            : `↳ ${t.projects.dropInside}`}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2 px-2.5 text-[var(--text-muted)] truncate">
                                  <span className="font-mono-code text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] truncate inline-block max-w-full">
                                    {group.project?.name || "-"}
                                  </span>
                                </td>

                                <td className="py-2 px-2.5 text-[var(--text-ink2)] truncate">
                                  {execNames.join(", ") || "-"}
                                </td>

                                <td className="py-2 px-2.5 w-[140px]">
                                  <ThemedSelect
                                    value={task.status}
                                    onChange={(val) => onPatchTask(task.id, { status: val })}
                                    options={TASK_STATUSES.map((s) => ({ value: s, label: s }))}
                                  />
                                </td>

                                <td className="py-2 px-2.5 w-[114px]">
                                  <ThemedSelect
                                    value={task.priority}
                                    onChange={(val) => onPatchTask(task.id, { priority: val })}
                                    options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
                                  />
                                </td>

                                <td className="py-2 px-2.5 font-mono-code text-[10.5px] text-[var(--text-muted)] whitespace-nowrap tnum">
                                  {formatShortDate(task.startDate, locale)} →{" "}
                                  {formatShortDate(task.endDate, locale)}
                                </td>

                                <td className="py-2 px-2.5 text-right font-mono-code text-[10.5px] whitespace-nowrap tnum">
                                  <span
                                    className={
                                      isRunning
                                        ? "text-[var(--ok)] font-bold"
                                        : "text-[var(--text-ink2)]"
                                    }
                                  >
                                    {isRunning ? "● " : ""}
                                    {formatDurationCompact(secs)}
                                  </span>
                                </td>

                                <td className="py-2 px-3">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onSelectTask(task)}
                                      title={t.common.edit}
                                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onAddSubtask(task)}
                                      title={t.projects.addSubtask}
                                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onOpenComments(task)}
                                      title={t.projects.commentsLabel}
                                      className="relative p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      {unread && (
                                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--brand)]" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onRemindTask(task.id)}
                                      title={t.projects.remindTelegram}
                                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--warn)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                                    >
                                      <Bell className="w-3.5 h-3.5" />
                                    </button>
                                    {confirmDeleteId === task.id ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onDeleteTask(task.id);
                                          setConfirmDeleteId(null);
                                        }}
                                        className="px-2 py-0.5 rounded bg-[var(--err)] text-white dark:text-[#161A26] font-mono-code text-[9.5px] font-bold cursor-pointer"
                                      >
                                        {t.common.delete}
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(task.id)}
                                        title={t.common.delete}
                                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--err)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inline Quick-Add Task Row (03A-2 bottom) */}
        <form
          onSubmit={handleQuickAddSubmit}
          className="px-4 py-2.5 bg-[var(--bg-canvas)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-3"
        >
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder={t.projects.addInlinePlaceholder}
            disabled={quickBusy || projects.length === 0}
            className="flex-1 bg-transparent text-xs text-[var(--text-ink)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={quickBusy || !quickTitle.trim()}
            className="font-mono-code text-[10px] font-bold text-[var(--brand)] disabled:opacity-40 cursor-pointer shrink-0"
          >
            {t.projects.enterToSave}
          </button>
        </form>
      </div>

      {/* Mobile Cards (< md, Grouped cleanly by Project) */}
      <div className="md:hidden space-y-3">
        {projectGroups.map((group) => {
          const groupName = group.project?.name || t.projects.unassignedProject;
          return (
            <div key={`mob-proj-${group.projectKey}`} className="space-y-2">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] border-l-4 border-l-[var(--brand)]">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderKanban className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
                  <span className="font-heading font-bold text-xs text-[var(--text-ink)] truncate">
                    {groupName}
                  </span>
                </div>
                <span className="font-mono-code text-[10px] text-[var(--text-muted)] tnum shrink-0">
                  {group.completedCount}/{group.totalCount}
                </span>
              </div>

              <div className="space-y-2">
                {group.rows.map(({ task, depth }) => {
                  const secs = getTotalTaskSeconds(task, nowMs);
                  return (
                    <div
                      key={`mob-t-${task.id}`}
                      onClick={() => onSelectTask(task)}
                      className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-2 cursor-pointer"
                      style={{ marginLeft: `${Math.min(depth + 1, 3) * 10}px` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-xs text-[var(--text-ink)]">
                          {depth > 0 ? "|-- " : ""}
                          {task.title}
                        </span>
                        <span
                          className={`font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getStatusPillClass(
                            task.status
                          )}`}
                        >
                          {task.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono-code text-[10px] text-[var(--text-muted)] tnum">
                        <span className="truncate">{getTaskExecutorNames(task).join(", ") || "-"}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-1.5 py-0.5 rounded border font-bold ${getPriorityPillClass(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDurationCompact(secs)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Smooth Pointer-Follow Drag Preview Pill */}
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
            {dropTarget?.kind === "task" && (
              <span className="font-mono-code text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--brand-tint)] text-[var(--brand)] shrink-0">
                {dropTarget.mode === "before"
                  ? `↑ ${t.projects.dropAbove}`
                  : dropTarget.mode === "after"
                    ? `↓ ${t.projects.dropBelow}`
                    : `↳ ${t.projects.dropInside}`}
              </span>
            )}
            {dropTarget?.kind === "project" && (
              <span className="font-mono-code text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--brand-tint)] text-[var(--brand)] shrink-0">
                {t.projects.dropToProject}
              </span>
            )}
            {dropTarget?.kind === "root" && (
              <span className="font-mono-code text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--brand-tint)] text-[var(--brand)] shrink-0">
                Root
              </span>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
