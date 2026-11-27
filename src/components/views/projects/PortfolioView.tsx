"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  FolderKanban,
  Plus,
  Users,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { formatDurationCompact, formatShortDate } from "@/lib/format";
import { buildFlatTaskTree } from "@/lib/project-helpers";
import {
  type ProjectRecord,
  type TaskRecord,
  type UserRecord,
  getStatusPillClass,
  getTotalTaskSeconds,
} from "./types";

interface PortfolioViewProps {
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  users: UserRecord[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onEditProject: (p: ProjectRecord) => void;
  onCreateTaskInProject: (projectId: string) => void;
  onSelectTask: (t: TaskRecord) => void;
  nowMs: number;
}

export default function PortfolioView({
  projects,
  tasks,
  users,
  selectedProjectId,
  onSelectProject,
  onEditProject,
  onCreateTaskInProject,
  onSelectTask,
  nowMs,
}: PortfolioViewProps) {
  const { locale, t } = useI18n();
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const activeProject = useMemo(() => {
    if (selectedProjectId && selectedProjectId !== "all") {
      return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
    }
    return projects[0] || null;
  }, [projects, selectedProjectId]);

  const projectTasksMap = useMemo(() => {
    const map = new Map<string, TaskRecord[]>();
    tasks.forEach((tItem) => {
      if (!tItem.projectId) return;
      const arr = map.get(tItem.projectId) || [];
      arr.push(tItem);
      map.set(tItem.projectId, arr);
    });
    return map;
  }, [tasks]);

  const getProjectMembersList = (proj: ProjectRecord): UserRecord[] => {
    if (proj.projectMembers && proj.projectMembers.length > 0) {
      return proj.projectMembers
        .map((pm) => pm.user || users.find((u) => u.id === pm.userId))
        .filter((u): u is UserRecord => Boolean(u));
    }
    if (!proj.members) return [];
    const names = proj.members
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return users.filter((u) => names.includes(u.name.toLowerCase()));
  };

  const activeTasks = useMemo(
    () => (activeProject ? projectTasksMap.get(activeProject.id) || [] : []),
    [activeProject, projectTasksMap]
  );
  const activeDone = activeTasks.filter(
    (tItem) => tItem.status === "Completed" || tItem.status === "Done"
  ).length;
  const activePct =
    activeTasks.length > 0
      ? Math.round((activeDone / activeTasks.length) * 100)
      : activeProject?.status === "Completed"
      ? 100
      : 0;
  const activeLoggedSeconds = activeTasks.reduce(
    (acc, tItem) => acc + getTotalTaskSeconds(tItem, nowMs),
    0
  );

  const flatProjectTree = useMemo(() => buildFlatTaskTree(activeTasks), [activeTasks]);

  const isParentExpanded = (id: string) => expandedParents[id] !== false;

  return (
    <div className="space-y-4">
      {/* Portfolio Grid (03A-4) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {projects.map((proj) => {
          const pTasks = projectTasksMap.get(proj.id) || [];
          const done = pTasks.filter(
            (tItem) => tItem.status === "Completed" || tItem.status === "Done"
          ).length;
          const pct =
            pTasks.length > 0
              ? Math.round((done / pTasks.length) * 100)
              : proj.status === "Completed"
              ? 100
              : 0;
          const isSelected = activeProject?.id === proj.id;
          const members = getProjectMembersList(proj);

          return (
            <div
              key={proj.id}
              onClick={() => onSelectProject(proj.id)}
              className={`bg-[var(--bg-surface)] rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                isSelected
                  ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/15"
                  : "border-[var(--border-subtle)] hover:border-[var(--brand-stroke)]"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderKanban className="w-4 h-4 text-[var(--brand)] shrink-0" />
                    <h3 className="font-heading font-bold text-sm text-[var(--text-ink)] truncate">
                      {proj.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full border uppercase ${getStatusPillClass(
                        proj.status
                      )}`}
                    >
                      {proj.status}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditProject(proj);
                      }}
                      aria-label={`Edit ${proj.name}`}
                      className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {proj.objective && (
                  <p className="text-xs text-[var(--text-ink2)] line-clamp-2">{proj.objective}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between font-mono-code text-[10.5px] text-[var(--text-muted)] tnum">
                  <span>
                    {formatShortDate(proj.startDate, locale)} → {formatShortDate(proj.endDate, locale)}
                  </span>
                  <span className="font-bold text-[var(--text-ink)]">
                    {done}/{pTasks.length} {t.nav.tasks} · {pct}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      proj.status === "Completed" ? "bg-[var(--ok)]" : "bg-[var(--brand)]"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {members.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-0.5 font-mono-code text-[10px] text-[var(--text-muted)] truncate">
                    <Users className="w-3 h-3 shrink-0" />
                    <span className="truncate">{members.map((m) => m.name).join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Project Detail Card (03A-4 bottom) */}
      {activeProject && (
        <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading font-bold text-lg text-[var(--text-ink)]">
                  {activeProject.name}
                </h2>
                <span
                  className={`font-mono-code text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${getStatusPillClass(
                    activeProject.status
                  )}`}
                >
                  {activeProject.status}
                </span>
              </div>
              {activeProject.objective && (
                <p className="text-xs text-[var(--text-ink2)]">{activeProject.objective}</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onEditProject(activeProject)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{t.common.edit}</span>
              </button>
              <button
                type="button"
                onClick={() => onCreateTaskInProject(activeProject.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.projects.newTask}</span>
              </button>
            </div>
          </div>

          {/* Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-code text-xs tnum">
            <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3">
              <span className="text-[10px] text-[var(--text-muted)] block">PROGRESS</span>
              <span className="text-xl font-extrabold text-[var(--brand)]">{activePct}%</span>
            </div>
            <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3">
              <span className="text-[10px] text-[var(--text-muted)] block">TASKS DONE</span>
              <span className="text-xl font-extrabold text-[var(--text-ink)]">
                {activeDone}/{activeTasks.length}
              </span>
            </div>
            <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3">
              <span className="text-[10px] text-[var(--text-muted)] block">LOGGED TIME</span>
              <span className="text-xl font-extrabold text-[var(--ok)]">
                {formatDurationCompact(activeLoggedSeconds)}
              </span>
            </div>
            <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3">
              <span className="text-[10px] text-[var(--text-muted)] block">TARGET END</span>
              <span className="text-sm font-bold text-[var(--text-ink)] mt-1 block">
                {formatShortDate(activeProject.endDate, locale)}
              </span>
            </div>
          </div>

          {/* Assigned Members */}
          <div className="space-y-1.5">
            <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              {t.projects.teamMembers} ({getProjectMembersList(activeProject).length})
            </span>
            <div className="flex flex-wrap gap-2">
              {getProjectMembersList(activeProject).map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-ink)]"
                >
                  <span className="w-5 h-5 rounded-full bg-[var(--brand-tint)] text-[var(--brand)] font-mono-code text-[10px] font-bold flex items-center justify-center">
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span>{m.name}</span>
                </span>
              ))}
              {getProjectMembersList(activeProject).length === 0 && (
                <span className="text-xs text-[var(--text-muted)]">No members assigned.</span>
              )}
            </div>
          </div>

          {/* Tasks in this Project */}
          <div className="space-y-2">
            <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              {t.projects.projectTasksTitle} ({activeTasks.length})
            </span>
            {flatProjectTree.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-3">
                No tasks in this project yet.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-canvas)] overflow-hidden">
                {flatProjectTree.map(({ task, depth, childCount }) => {
                  if (depth > 0 && task.parentId && !isParentExpanded(task.parentId)) {
                    return null;
                  }
                  const secs = getTotalTaskSeconds(task, nowMs);
                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-[var(--bg-subtle)]/60 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {depth > 0 ? (
                          <span className="font-mono-code text-[var(--text-muted)] pl-4 shrink-0">
                            |--
                          </span>
                        ) : childCount > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedParents((p) => ({
                                ...p,
                                [task.id]: !isParentExpanded(task.id),
                              }));
                            }}
                            className="p-0.5 text-[var(--text-muted)] hover:text-[var(--brand)]"
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
                        <span className="font-medium text-[var(--text-ink)] truncate">
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 font-mono-code text-[10px] tnum">
                        {secs > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[var(--text-muted)]">
                            <Clock className="w-3 h-3" />
                            {formatDurationCompact(secs)}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full border font-bold ${getStatusPillClass(
                            task.status
                          )}`}
                        >
                          {task.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
