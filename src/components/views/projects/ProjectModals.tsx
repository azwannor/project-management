"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useI18n } from "@/i18n";
import { formatDurationCompact, formatShortDate } from "@/lib/format";
import { wouldCreateTaskCycle } from "@/lib/project-helpers";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import { ThemedDatePicker } from "@/components/ui/ThemedDatePicker";
import {
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ProjectRecord,
  type TaskRecord,
  type TimeLogRecord,
  type UserRecord,
  getActiveOpenTimeLog,
  getTaskExecutorIds,
  getTotalTaskSeconds,
  hasUnreadTaskComments,
} from "./types";

function toIsoDate(val?: string | Date | null, fallbackDaysOffset = 0): string {
  if (val) {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
  }
  const base = new Date();
  base.setDate(base.getDate() + fallbackDaysOffset);
  return format(base, "yyyy-MM-dd");
}

function formatLiveHms(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function ProjectFormModal(props: {
  isOpen: boolean;
  project: ProjectRecord | null;
  users: UserRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  if (!props.isOpen) return null;
  return (
    <ProjectFormModalInner
      key={props.project?.id || "new-project"}
      project={props.project}
      users={props.users}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  );
}

function resolveInitialProjectMembers(project: ProjectRecord | null, users: UserRecord[]): string[] {
  if (!project) return [];
  if (project.projectMembers && project.projectMembers.length > 0) {
    return project.projectMembers.map((pm) => pm.userId);
  }
  if (project.members) {
    const names = project.members.split(",").map((s) => s.trim().toLowerCase());
    return users.filter((u) => names.includes(u.name.toLowerCase())).map((u) => u.id);
  }
  return [];
}

function ProjectFormModalInner({
  project,
  users,
  onClose,
  onSaved,
}: {
  project: ProjectRecord | null;
  users: UserRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { locale, t } = useI18n();
  const [name, setName] = useState(project?.name ?? "");
  const [objective, setObjective] = useState(project?.objective || "");
  const description = project?.description || "";
  const [status, setStatus] = useState(project?.status || "Not Started");
  const [startDate, setStartDate] = useState(() =>
    project ? toIsoDate(project.startDate) : toIsoDate(null, 0)
  );
  const [endDate, setEndDate] = useState(() =>
    project ? toIsoDate(project.endDate) : toIsoDate(null, 30)
  );
  const [memberIds, setMemberIds] = useState<string[]>(() =>
    resolveInitialProjectMembers(project, users)
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMember = (uid: string) => {
    setMemberIds((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = project ? `/api/projects/${project.id}` : "/api/projects";
      const method = project ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          objective: objective.trim() || null,
          description: description.trim() || null,
          status,
          startDate,
          endDate,
          memberIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to save project");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Failed to delete project");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Failed to delete project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="font-heading font-bold text-base text-[var(--text-ink)]">
            {project ? t.projects.editProject : t.projects.newProject}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="text-xs font-semibold text-[var(--err)] bg-[var(--err-bg)] border border-[var(--err-stroke)] rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1.5">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. ERP & HRIS API Bridge"
              className="w-full px-3.5 py-2 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
            />
          </div>

          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1.5">
              {t.projects.projectObjective}
            </label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={2}
              placeholder="Target business outcome..."
              className="w-full px-3.5 py-2 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1.5">
                Start Date
              </label>
              <ThemedDatePicker value={startDate} onChange={setStartDate} locale={locale} />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1.5">
                Target End
              </label>
              <ThemedDatePicker
                value={endDate}
                onChange={setEndDate}
                locale={locale}
                menuAlign="right"
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1.5">
                Status
              </label>
              <ThemedSelect
                value={status}
                onChange={setStatus}
                options={PROJECT_STATUSES.map((s) => ({ value: s, label: s }))}
                menuAlign="right"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1.5">
              {t.projects.teamMembers} ({memberIds.length})
            </label>
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] max-h-36 overflow-y-auto">
              {users.map((u) => {
                const selected = memberIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleMember(u.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      selected
                        ? "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)] font-semibold"
                        : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                    }`}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    <span>{u.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
            {project ? (
              confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-full bg-[var(--err)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer"
                  >
                    {t.projects.confirmDeleteTitle}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1.5 rounded-full text-xs text-[var(--text-muted)] cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.common.delete}</span>
                </button>
              )
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t.common.save}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TaskDetailDrawer(props: {
  isOpen: boolean;
  task: TaskRecord | null;
  defaultProjectId?: string;
  defaultParentId?: string | null;
  defaultStatus?: string;
  defaultStartDate?: string;
  projects: ProjectRecord[];
  allTasks: TaskRecord[];
  users: UserRecord[];
  onClose: () => void;
  onSaved: () => void;
  onOpenComments?: (t: TaskRecord) => void;
}) {
  if (!props.isOpen) return null;
  return (
    <TaskDetailDrawerInner
      key={`${props.task?.id || "new"}-${props.defaultProjectId || ""}-${props.defaultParentId || ""}-${props.defaultStatus || ""}-${props.defaultStartDate || ""}`}
      task={props.task}
      defaultProjectId={props.defaultProjectId}
      defaultParentId={props.defaultParentId}
      defaultStatus={props.defaultStatus}
      defaultStartDate={props.defaultStartDate}
      projects={props.projects}
      allTasks={props.allTasks}
      users={props.users}
      onClose={props.onClose}
      onSaved={props.onSaved}
      onOpenComments={props.onOpenComments}
    />
  );
}

function TaskDetailDrawerInner({
  task,
  defaultProjectId,
  defaultParentId,
  defaultStatus,
  defaultStartDate,
  projects,
  allTasks,
  users,
  onClose,
  onSaved,
  onOpenComments,
}: {
  task: TaskRecord | null;
  defaultProjectId?: string;
  defaultParentId?: string | null;
  defaultStatus?: string;
  defaultStartDate?: string;
  projects: ProjectRecord[];
  allTasks: TaskRecord[];
  users: UserRecord[];
  onClose: () => void;
  onSaved: () => void;
  onOpenComments?: (t: TaskRecord) => void;
}) {
  const { locale, t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(task?.title ?? "");
  const [projectId, setProjectId] = useState(() =>
    task
      ? task.projectId || (projects[0]?.id ?? "")
      : defaultProjectId && defaultProjectId !== "all"
        ? defaultProjectId
        : projects[0]?.id || ""
  );
  const [parentId, setParentId] = useState(() => (task ? task.parentId || "" : defaultParentId || ""));
  const [status, setStatus] = useState(task?.status || defaultStatus || "Not Started");
  const [priority, setPriority] = useState(task?.priority || "Normal");
  const [startDate, setStartDate] = useState(() =>
    task ? toIsoDate(task.startDate) : defaultStartDate ? toIsoDate(defaultStartDate) : toIsoDate(null, 0)
  );
  const [endDate, setEndDate] = useState(() => {
    if (task) return toIsoDate(task.endDate);
    if (defaultStartDate) {
      const base = new Date(`${defaultStartDate}T12:00:00`);
      if (!Number.isNaN(base.getTime())) {
        base.setDate(base.getDate() + 7);
        return format(base, "yyyy-MM-dd");
      }
    }
    return toIsoDate(null, 7);
  });
  const [actualEndDate, setActualEndDate] = useState(() =>
    task?.actualEndDate ? toIsoDate(task.actualEndDate) : ""
  );
  const [executorIds, setExecutorIds] = useState<string[]>(() =>
    task ? getTaskExecutorIds(task, users) : []
  );
  const [documentation, setDocumentation] = useState(task?.documentation || "");
  const [issue, setIssue] = useState(task?.issue || "");
  const [solution, setSolution] = useState(task?.solution || "");
  const [attachment, setAttachment] = useState<string | null>(task?.attachment || null);
  const [attachmentKey, setAttachmentKey] = useState<string | null>(task?.attachmentKey || null);

  const [timeLogs, setTimeLogs] = useState<TimeLogRecord[]>(() => task?.timeLogs || []);
  const [manualMinutes, setManualMinutes] = useState("30");
  const [manualNote, setManualNote] = useState("");
  const [tickNowMs, setTickNowMs] = useState(() => Date.now());
  const [timerBusy, setTimerBusy] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [remindSuccess, setRemindSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task?.id) return;
    let cancelled = false;
    fetch(`/api/timelogs?taskId=${task.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setTimeLogs(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [task?.id]);

  const activeLog = useMemo(
    () => timeLogs.find((tl) => !tl.endTime) || getActiveOpenTimeLog({ ...(task || {}), timeLogs } as TaskRecord),
    [timeLogs, task]
  );

  useEffect(() => {
    if (!activeLog) return;
    const id = setInterval(() => setTickNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeLog]);

  const validParentOptions = useMemo(() => {
    const candidates = allTasks.filter((tItem) => {
      if (projectId && tItem.projectId !== projectId) return false;
      if (task && wouldCreateTaskCycle(task.id, tItem.id, allTasks)) return false;
      return true;
    });
    return [
      { value: "", label: locale === "id" ? "Tugas Utama (Root)" : "Root Task (No Parent)" },
      ...candidates.map((tItem) => ({ value: tItem.id, label: tItem.title })),
    ];
  }, [allTasks, projectId, task, locale]);

  const totalLoggedSeconds = getTotalTaskSeconds(
    { ...(task || {}), timeLogs } as TaskRecord,
    tickNowMs
  );

  const toggleExecutor = (uid: string) => {
    setExecutorIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "tasks");
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      setAttachment(data.url);
      setAttachmentKey(data.key);
    } catch {
      setError("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleTimer = async () => {
    if (!task) return;
    setTimerBusy(true);
    setError(null);
    try {
      const action = activeLog ? "PAUSE" : "START";
      const res = await fetch("/api/timelogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, action }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Failed to toggle timer");
        return;
      }
      const logsRes = await fetch(`/api/timelogs?taskId=${task.id}`);
      if (logsRes.ok) setTimeLogs(await logsRes.json());
      if (action === "START" && status !== "Ongoing") setStatus("Ongoing");
      onSaved();
    } finally {
      setTimerBusy(false);
    }
  };

  const handleAddManualTime = async () => {
    if (!task) return;
    const mins = Number(manualMinutes);
    if (!mins || mins <= 0) {
      setError("Enter valid positive minutes");
      return;
    }
    setTimerBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/timelogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          durationMinutes: mins,
          note: manualNote.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Failed to log time");
        return;
      }
      setManualNote("");
      const logsRes = await fetch(`/api/timelogs?taskId=${task.id}`);
      if (logsRes.ok) setTimeLogs(await logsRes.json());
      onSaved();
    } finally {
      setTimerBusy(false);
    }
  };

  const handleDeleteTimeLog = async (logId: string) => {
    const res = await fetch(`/api/timelogs/${logId}`, { method: "DELETE" });
    if (res.ok && task) {
      setTimeLogs((prev) => prev.filter((l) => l.id !== logId));
      onSaved();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = task ? `/api/tasks/${task.id}` : "/api/tasks";
      const method = task ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          projectId: projectId || null,
          parentId: parentId || null,
          status,
          priority,
          startDate,
          endDate,
          actualEndDate: actualEndDate || null,
          executorIds,
          documentation: documentation.trim() || null,
          issue: issue.trim() || null,
          solution: solution.trim() || null,
          attachment,
          attachmentKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to save task");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (res.ok) {
        onSaved();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemind = async () => {
    if (!task) return;
    setReminding(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/remind`, { method: "POST" });
      if (res.ok) setRemindSuccess(true);
    } finally {
      setReminding(false);
    }
  };

  const unread = task ? hasUnreadTaskComments(task) : false;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-xs">
      <div className="w-full max-w-lg h-full bg-[var(--bg-surface)] border-l border-[var(--border-strong)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-sm sm:text-base text-[var(--text-ink)] truncate">
                {task ? t.projects.editTask : t.projects.newTask}
              </h3>
              {task && (
                <span className="font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] tnum whitespace-nowrap shrink-0">
                  {formatDurationCompact(totalLoggedSeconds)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {task && onOpenComments && (
              <button
                type="button"
                onClick={() => onOpenComments(task)}
                title={t.projects.commentsLabel}
                aria-label={t.projects.commentsLabel}
                className="relative inline-flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.projects.commentsLabel}</span>
                {unread && (
                  <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
                )}
              </button>
            )}
            {task && (
              <button
                type="button"
                onClick={handleRemind}
                disabled={reminding}
                title={t.projects.remindTelegram}
                className="p-2 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] text-[var(--text-ink2)] cursor-pointer"
              >
                {reminding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : remindSuccess ? (
                  <Check className="w-3.5 h-3.5 text-[var(--ok)]" />
                ) : (
                  <Bell className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="text-xs font-semibold text-[var(--err)] bg-[var(--err-bg)] border border-[var(--err-stroke)] rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Hybrid Time Tracker Card (when editing existing task) */}
          {task && (
            <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--brand)]" />
                  <span className="font-mono-code text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-ink)]">
                    {t.projects.hybridTimeTracker}
                  </span>
                </div>
                <span
                  className={`font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full border tnum ${
                    activeLog
                      ? "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]"
                      : "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]"
                  }`}
                >
                  {activeLog ? `${activeLog.source} RUNNING` : "READY"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono-code font-extrabold text-2xl text-[var(--text-ink)] tnum">
                    {formatLiveHms(totalLoggedSeconds)}
                  </p>
                  <p className="font-mono-code text-[10px] text-[var(--text-muted)] tnum">
                    {timeLogs.length} session(s) recorded
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleTimer}
                  disabled={timerBusy}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    activeLog
                      ? "bg-[var(--warn-bg)] border border-[var(--warn-stroke)] text-[var(--warn)]"
                      : "bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26]"
                  }`}
                >
                  {timerBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : activeLog ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>{activeLog ? t.projects.pauseTimer : t.projects.startTimer}</span>
                </button>
              </div>

              {/* Manual duration entry */}
              <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  className="w-20 px-2.5 py-1.5 text-xs font-mono-code rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink)] tnum"
                  placeholder="30"
                />
                <span className="font-mono-code text-[10px] text-[var(--text-muted)]">
                  {t.projects.minutesLabel}
                </span>
                <input
                  type="text"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder={t.projects.noteOptional}
                  className="flex-1 min-w-[120px] px-2.5 py-1.5 text-xs rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink)]"
                />
                <button
                  type="button"
                  onClick={handleAddManualTime}
                  disabled={timerBusy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-strong)] hover:border-[var(--brand)] text-[11px] font-semibold text-[var(--text-ink)] cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t.projects.logManualTime}</span>
                </button>
              </div>

              {timeLogs.length > 0 && (
                <div className="max-h-28 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                  {timeLogs.slice(0, 6).map((tl) => {
                    const secs = tl.durationSeconds || tl.duration || 0;
                    return (
                      <div
                        key={tl.id}
                        className="py-1.5 flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="min-w-0">
                          <span className="font-mono-code text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink2)] mr-2">
                            {tl.source}
                          </span>
                          <span className="text-[var(--text-ink2)]">
                            {tl.note || formatShortDate(tl.startTime, locale)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono-code font-semibold text-[var(--text-ink)] tnum">
                            {tl.endTime ? formatDurationCompact(secs) : "LIVE"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteTimeLog(tl.id)}
                            className="text-[var(--text-muted)] hover:text-[var(--err)] cursor-pointer"
                            aria-label="Delete session"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Task Core Form */}
          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3.5 py-2 text-sm rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
                Project
              </label>
              <ThemedSelect
                value={projectId}
                onChange={(val) => {
                  setProjectId(val);
                  setParentId("");
                }}
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
                Parent Task
              </label>
              <ThemedSelect
                value={parentId}
                onChange={setParentId}
                options={validParentOptions}
                menuAlign="right"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
                Status
              </label>
              <ThemedSelect
                value={status}
                onChange={setStatus}
                options={TASK_STATUSES.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
                Priority
              </label>
              <ThemedSelect
                value={priority}
                onChange={setPriority}
                options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
                menuAlign="right"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
                Start Date
              </label>
              <ThemedDatePicker value={startDate} onChange={setStartDate} locale={locale} />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
                Target End
              </label>
              <ThemedDatePicker value={endDate} onChange={setEndDate} locale={locale} />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
                Actual End
              </label>
              <ThemedDatePicker
                value={actualEndDate}
                onChange={setActualEndDate}
                locale={locale}
                allowClear
                menuAlign="right"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
              Executors ({executorIds.length})
            </label>
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] max-h-28 overflow-y-auto">
              {users.map((u) => {
                const selected = executorIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleExecutor(u.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer ${
                      selected
                        ? "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)] font-semibold"
                        : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-ink2)]"
                    }`}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    <span>{u.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
              Documentation URL
            </label>
            <input
              type="text"
              value={documentation}
              onChange={(e) => setDocumentation(e.target.value)}
              placeholder="https://docs..."
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
            />
          </div>

          {/* MinIO File Upload (Zero Base64 Bloat) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)]">
                {t.projects.docsAndUpload}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.xlsx,.csv,.txt,.docx"
                onChange={handleUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                <span>{t.projects.uploadFile}</span>
              </button>
            </div>
            {attachment && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs">
                <a
                  href={attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 min-w-0 text-[var(--brand)] hover:underline font-medium"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="truncate">{attachmentKey || attachment}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setAttachment(null);
                    setAttachmentKey(null);
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--err)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
                {t.projects.issueLabel}
              </label>
              <textarea
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)]"
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink2)] mb-1">
                {t.projects.solutionLabel}
              </label>
              <textarea
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink)]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
            {task ? (
              confirmDelete ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDeleteTask}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-full bg-[var(--err)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer"
                  >
                    {t.projects.confirmDeleteTitle}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1.5 text-xs text-[var(--text-muted)] cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.common.delete}</span>
                </button>
              )
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t.common.save}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
