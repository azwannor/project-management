"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  FolderKanban,
  GanttChartSquare,
  KanbanSquare,
  Plus,
  Table2,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { formatDurationCompact } from "@/lib/format";
import {
  computeSiblingReorderUpdates,
  type ReorderDropMode,
} from "@/lib/project-helpers";
import CommentsDrawer from "@/components/common/CommentsDrawer";
import PortfolioView from "./projects/PortfolioView";
import ProjectsTableView from "./projects/ProjectsTableView";
import ProjectsKanbanView from "./projects/ProjectsKanbanView";
import ProjectsTimelineView from "./projects/ProjectsTimelineView";
import ProjectsCalendarView from "./projects/ProjectsCalendarView";
import { ProjectFormModal, TaskDetailDrawer } from "./projects/ProjectModals";
import {
  type ProjectRecord,
  type TaskRecord,
  type UserRecord,
  getActiveOpenTimeLog,
  getTotalTaskSeconds,
} from "./projects/types";

type WorkspaceView = "portfolio" | "table" | "kanban" | "timeline" | "calendar";

interface InitialProjectsData {
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  users: UserRecord[];
  currentUser: { id: string; name: string; role: string; photo: string | null };
  generatedAtIso: string;
}

export default function ProjectDashboardClient({
  initialData,
}: {
  initialData: InitialProjectsData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const urlModule = searchParams.get("module");
  const urlView = searchParams.get("view") as WorkspaceView | null;
  const urlProjectId = searchParams.get("projectId");

  const [viewOverride, setViewOverride] = useState<{
    key: string;
    view: WorkspaceView;
  } | null>(null);
  const [projectOverride, setProjectOverride] = useState<{
    urlKey: string | null;
    projectId: string;
  } | null>(null);

  const navKey = `${urlModule || ""}|${urlView || ""}`;
  const defaultViewFromUrl: WorkspaceView =
    urlView && ["portfolio", "table", "kanban", "timeline", "calendar"].includes(urlView)
      ? urlView
      : urlModule === "task"
      ? "table"
      : "portfolio";

  const activeView =
    viewOverride && viewOverride.key === navKey ? viewOverride.view : defaultViewFromUrl;
  const setActiveView = (next: WorkspaceView) => setViewOverride({ key: navKey, view: next });

  const selectedProjectId =
    projectOverride && projectOverride.urlKey === urlProjectId
      ? projectOverride.projectId
      : urlProjectId || "all";
  const setSelectedProjectId = (next: string) =>
    setProjectOverride({ urlKey: urlProjectId, projectId: next });

  const [nowMs, setNowMs] = useState<number>(() => new Date(initialData.generatedAtIso).getTime());

  // Modals & Drawers
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);

  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createTaskDefaults, setCreateTaskDefaults] = useState<{
    projectId?: string;
    parentId?: string | null;
    status?: string;
    startDate?: string;
  }>({});

  const [commentsTaskId, setCommentsTaskId] = useState<string | null>(null);
  const [readOverrides, setReadOverrides] = useState<Record<string, boolean>>({});
  const [optimisticPatch, setOptimisticPatch] = useState<{
    baseTasks: TaskRecord[];
    tasks: TaskRecord[];
  } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const projects = initialData.projects || [];
  const allTasks = useMemo(() => {
    const source =
      optimisticPatch && optimisticPatch.baseTasks === initialData.tasks
        ? optimisticPatch.tasks
        : initialData.tasks || [];
    return source.map((tk) =>
      readOverrides[tk.id]
        ? { ...tk, commentReadStatuses: [{ lastReadAt: new Date(nowMs + 60_000).toISOString() }] }
        : tk
    );
  }, [initialData.tasks, optimisticPatch, readOverrides, nowMs]);
  const users = initialData.users || [];

  const runningGlobalTask = useMemo(
    () => allTasks.find((tk) => Boolean(getActiveOpenTimeLog(tk))) || null,
    [allTasks]
  );

  useEffect(() => {
    if (!runningGlobalTask) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningGlobalTask]);

  const selectedTask = useMemo(
    () => (selectedTaskId ? allTasks.find((tk) => tk.id === selectedTaskId) || null : null),
    [allTasks, selectedTaskId]
  );

  const commentsTask = useMemo(
    () => (commentsTaskId ? allTasks.find((tk) => tk.id === commentsTaskId) || null : null),
    [allTasks, commentsTaskId]
  );

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const refreshAll = () => {
    router.refresh();
  };

  const handlePatchTask = async (taskId: string, patch: Record<string, unknown>) => {
    if (typeof patch.status === "string" || patch.projectId !== undefined) {
      const optimisticNext = allTasks.map((tk) => {
        if (tk.id !== taskId) return tk;
        const nextProjectId =
          patch.projectId !== undefined ? (patch.projectId as string | null) : tk.projectId;
        const nextProjObj = nextProjectId
          ? projects.find((p) => p.id === nextProjectId) || null
          : null;
        return {
          ...tk,
          status: typeof patch.status === "string" ? patch.status : tk.status,
          projectId: nextProjectId,
          project: nextProjObj ? { id: nextProjObj.id, name: nextProjObj.name } : null,
        };
      });
      setOptimisticPatch({ baseTasks: initialData.tasks, tasks: optimisticNext });
    }

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setOptimisticPatch(null);
      const json = await res.json().catch(() => ({}));
      showToast(json.error || "Failed to update task");
      return;
    }
    refreshAll();
  };

  const handleDeleteTask = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedTaskId === taskId) {
        setTaskDrawerOpen(false);
        setSelectedTaskId(null);
      }
      refreshAll();
    }
  };

  const handleQuickCreateTask = async (title: string, projectId: string) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, projectId }),
    });
    if (res.ok) refreshAll();
  };

  const handleRemindTask = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}/remind`, { method: "POST" });
    if (res.ok) showToast("Reminder notification dispatched");
    else showToast("Failed to send reminder");
  };

  const handleReorderTask = async (params: {
    taskId: string;
    targetTaskId?: string | null;
    mode: ReorderDropMode;
    targetProjectId?: string | null;
  }) => {
    const plan = computeSiblingReorderUpdates(allTasks, params);
    if (!plan.ok) {
      showToast(plan.error);
      return;
    }

    if (plan.updates.length > 0) {
      const updateMap = new Map(plan.updates.map((u) => [u.id, u]));
      const descSet = new Set(plan.descendantIds);
      const nextProjObj = plan.nextProjectId
        ? projects.find((p) => p.id === plan.nextProjectId) || null
        : null;

      const optimisticNext = allTasks.map((tk) => {
        const u = updateMap.get(tk.id);
        if (u) {
          return {
            ...tk,
            sortOrder: u.sortOrder,
            parentId: u.id === params.taskId && u.parentId !== undefined ? u.parentId : tk.parentId,
            projectId:
              u.id === params.taskId && u.projectId !== undefined ? u.projectId : tk.projectId,
            project:
              u.id === params.taskId && u.projectId !== undefined
                ? nextProjObj
                  ? { id: nextProjObj.id, name: nextProjObj.name }
                  : null
                : tk.project,
          };
        }
        if (descSet.has(tk.id)) {
          return {
            ...tk,
            projectId: plan.nextProjectId,
            project: nextProjObj ? { id: nextProjObj.id, name: nextProjObj.name } : null,
          };
        }
        return tk;
      });

      setOptimisticPatch({ baseTasks: initialData.tasks, tasks: optimisticNext });
    }

    try {
      const res = await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        setOptimisticPatch(null);
        const json = await res.json().catch(() => ({}));
        showToast(json.error || "Failed to reorder task");
        return;
      }
      refreshAll();
    } catch {
      setOptimisticPatch(null);
      showToast("Failed to reorder task");
    }
  };

  const viewTabs: Array<{ id: WorkspaceView; label: string; icon: typeof FolderKanban }> = [
    { id: "portfolio", label: t.projects.viewPortfolio, icon: FolderKanban },
    { id: "table", label: t.projects.viewTable, icon: Table2 },
    { id: "kanban", label: t.projects.viewKanban, icon: KanbanSquare },
    { id: "timeline", label: t.projects.viewTimeline, icon: GanttChartSquare },
    { id: "calendar", label: t.projects.viewCalendar, icon: CalendarDays },
  ];

  return (
    <div className="w-full px-3 sm:px-5 lg:px-6 py-4 space-y-4">
      {/* Top Workspace Control Bar (03A-1..03A-5) */}
      <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-2.5 sm:px-3.5">
        <div className="grid grid-cols-5 sm:inline-flex sm:flex-wrap items-center bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-2xl sm:rounded-full p-0.5 gap-0.5 w-full lg:w-auto">
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-3 py-1.5 rounded-xl sm:rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                    : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-full">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
          {runningGlobalTask && (
            <button
              type="button"
              onClick={() => {
                setSelectedTaskId(runningGlobalTask.id);
                setTaskDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 font-mono-code text-[10.5px] font-bold px-3 py-1.5 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-stroke)] text-[var(--ok)] tnum cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)] animate-pulse" />
              <span>
                {formatDurationCompact(getTotalTaskSeconds(runningGlobalTask, nowMs))} ·{" "}
                {runningGlobalTask.title.slice(0, 18)}
              </span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setProjectModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.projects.newProject}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedTaskId(null);
                setCreateTaskDefaults({
                  projectId:
                    selectedProjectId !== "all" ? selectedProjectId : projects[0]?.id,
                  parentId: null,
                });
                setTaskDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.projects.newTask}</span>
            </button>
          </div>
        </div>
      </section>

      {toastMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-xs font-semibold text-[var(--brand)]">
          {toastMsg}
        </div>
      )}

      {/* Active Workspace View */}
      {activeView === "portfolio" && (
        <PortfolioView
          projects={projects}
          tasks={allTasks}
          users={users}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          onEditProject={(proj) => {
            setEditingProject(proj);
            setProjectModalOpen(true);
          }}
          onCreateTaskInProject={(pid) => {
            setSelectedTaskId(null);
            setCreateTaskDefaults({ projectId: pid, parentId: null });
            setTaskDrawerOpen(true);
          }}
          onSelectTask={(tk) => {
            setSelectedTaskId(tk.id);
            setTaskDrawerOpen(true);
          }}
          nowMs={nowMs}
        />
      )}

      {activeView === "table" && (
        <ProjectsTableView
          projects={projects}
          tasks={allTasks}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          onSelectTask={(tk) => {
            setSelectedTaskId(tk.id);
            setTaskDrawerOpen(true);
          }}
          onAddSubtask={(parent) => {
            setSelectedTaskId(null);
            setCreateTaskDefaults({
              projectId: parent.projectId || projects[0]?.id,
              parentId: parent.id,
            });
            setTaskDrawerOpen(true);
          }}
          onCreateTaskInProject={(pid) => {
            setSelectedTaskId(null);
            setCreateTaskDefaults({ projectId: pid, parentId: null });
            setTaskDrawerOpen(true);
          }}
          onOpenComments={(tk) => setCommentsTaskId(tk.id)}
          onPatchTask={handlePatchTask}
          onReorderTask={handleReorderTask}
          onDeleteTask={handleDeleteTask}
          onQuickCreateTask={handleQuickCreateTask}
          onRemindTask={handleRemindTask}
          nowMs={nowMs}
        />
      )}

      {activeView === "kanban" && (
        <ProjectsKanbanView
          projects={projects}
          tasks={allTasks}
          users={users}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          onSelectTask={(tk) => {
            setSelectedTaskId(tk.id);
            setTaskDrawerOpen(true);
          }}
          onCreateTaskInProject={(pid, statusVal) => {
            setSelectedTaskId(null);
            setCreateTaskDefaults({
              projectId: pid || (selectedProjectId !== "all" ? selectedProjectId : projects[0]?.id),
              parentId: null,
              status: statusVal,
            });
            setTaskDrawerOpen(true);
          }}
          onPatchTask={handlePatchTask}
          onOpenComments={(tk) => setCommentsTaskId(tk.id)}
          nowMs={nowMs}
        />
      )}

      {activeView === "timeline" && (
        <ProjectsTimelineView
          projects={projects}
          tasks={allTasks}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          onSelectTask={(tk) => {
            setSelectedTaskId(tk.id);
            setTaskDrawerOpen(true);
          }}
          onCreateTaskInProject={(pid) => {
            setSelectedTaskId(null);
            setCreateTaskDefaults({ projectId: pid, parentId: null });
            setTaskDrawerOpen(true);
          }}
          nowMs={nowMs}
        />
      )}

      {activeView === "calendar" && (
        <ProjectsCalendarView
          projects={projects}
          tasks={allTasks}
          users={users}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          onSelectTask={(tk) => {
            setSelectedTaskId(tk.id);
            setTaskDrawerOpen(true);
          }}
          onCreateTaskAtDate={(isoDate) => {
            setSelectedTaskId(null);
            setCreateTaskDefaults({
              projectId: selectedProjectId !== "all" ? selectedProjectId : projects[0]?.id,
              parentId: null,
              startDate: isoDate,
            });
            setTaskDrawerOpen(true);
          }}
          nowMs={nowMs}
        />
      )}

      {/* Project Create/Edit Modal */}
      <ProjectFormModal
        isOpen={projectModalOpen}
        project={editingProject}
        users={users}
        onClose={() => {
          setProjectModalOpen(false);
          setEditingProject(null);
        }}
        onSaved={refreshAll}
      />

      {/* Task Detail / Create / Hybrid TimeLog Slide-Over Drawer */}
      <TaskDetailDrawer
        isOpen={taskDrawerOpen}
        task={selectedTask}
        defaultProjectId={createTaskDefaults.projectId}
        defaultParentId={createTaskDefaults.parentId}
        defaultStatus={createTaskDefaults.status}
        defaultStartDate={createTaskDefaults.startDate}
        projects={projects}
        allTasks={allTasks}
        users={users}
        onClose={() => {
          setTaskDrawerOpen(false);
          setSelectedTaskId(null);
        }}
        onSaved={refreshAll}
        onOpenComments={(tk) => setCommentsTaskId(tk.id)}
      />

      {/* Threaded Comments Drawer */}
      {commentsTask && (
        <CommentsDrawer
          isOpen={Boolean(commentsTask)}
          onClose={() => setCommentsTaskId(null)}
          entityId={commentsTask.id}
          entityType="task"
          entityTitle={commentsTask.title}
          currentUserId={initialData.currentUser?.id}
          onCommentsRead={() =>
            setReadOverrides((prev) => ({ ...prev, [commentsTask.id]: true }))
          }
        />
      )}
    </div>
  );
}
