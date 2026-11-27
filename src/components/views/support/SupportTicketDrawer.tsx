"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Bell,
  Box,
  Check,
  Clock,
  ExternalLink,
  FolderKanban,
  Loader2,
  MapPin,
  MessageSquare,
  Paperclip,
  Pause,
  Play,
  Plus,
  Rocket,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useI18n } from "@/i18n";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import { ThemedDatePicker } from "@/components/ui/ThemedDatePicker";
import { ThemedTimePicker } from "@/components/ui/ThemedTimePicker";
import { formatDurationCompact, formatLiveHms } from "@/lib/format";
import {
  computeTicketLoggedSeconds,
  evaluateTicketSla,
  formatCompactMinutes,
  normalizeSupportPriority,
  stripRichHtml,
} from "@/lib/support-helpers";
import type {
  SupportAssetOption,
  SupportModuleOption,
  SupportProjectOption,
  SupportSlaPolicyItem,
  SupportTicketItem,
  SupportTimeLogItem,
  SupportUserItem,
} from "./types";

interface SupportTicketDrawerProps {
  isOpen: boolean;
  ticket: SupportTicketItem | null;
  defaultTicketType: "REQUEST" | "DAILY_ACTIVITY";
  modules: SupportModuleOption[];
  areas: string[];
  assets: SupportAssetOption[];
  projects: SupportProjectOption[];
  slaPolicies: SupportSlaPolicyItem[];
  users: SupportUserItem[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onNotify: (kind: "ok" | "err", text: string) => void;
  onOpenComments?: (ticket: SupportTicketItem) => void;
}

function toDatePart(value?: string | Date | null): string {
  if (!value) return format(new Date(), "yyyy-MM-dd");
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? format(new Date(), "yyyy-MM-dd") : format(d, "yyyy-MM-dd");
}

function toTimePart(value?: string | Date | null): string {
  if (!value) return format(new Date(), "HH:mm");
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "09:00" : format(d, "HH:mm");
}

function combineDateTimeIso(dateStr: string, timeStr: string): string {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : format(new Date(), "yyyy-MM-dd");
  const safeTime = /^\d{2}:\d{2}$/.test(timeStr) ? timeStr : "09:00";
  const dt = new Date(`${safeDate}T${safeTime}:00`);
  return Number.isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
}

export default function SupportTicketDrawer(props: SupportTicketDrawerProps) {
  if (!props.isOpen) return null;
  const key = props.ticket
    ? `${props.ticket.id}-${String(props.ticket.updatedAt || "")}`
    : `new-${props.defaultTicketType}`;
  return <SupportTicketDrawerInner key={key} {...props} />;
}

function SupportTicketDrawerInner({
  ticket,
  defaultTicketType,
  modules,
  areas,
  assets,
  projects,
  slaPolicies,
  users,
  onClose,
  onSaved,
  onNotify,
  onOpenComments,
}: SupportTicketDrawerProps) {
  const { locale, t } = useI18n();

  const knownModuleNames = useMemo(() => new Set(modules.map((m) => m.name)), [modules]);
  const firstMod = modules[0];

  const [ticketType, setTicketType] = useState<"REQUEST" | "DAILY_ACTIVITY">(() =>
    ticket ? (ticket.ticketType === "REQUEST" ? "REQUEST" : "DAILY_ACTIVITY") : defaultTicketType
  );
  const [taskName, setTaskName] = useState(() => ticket?.taskName || "");
  const [requesterName, setRequesterName] = useState(() => ticket?.requesterName || "");
  const [requesterEmail, setRequesterEmail] = useState(() => ticket?.requesterEmail || "");
  const [moduleName, setModuleName] = useState(() => {
    if (!ticket) return firstMod?.name || "Sistem AI";
    return knownModuleNames.has(ticket.module) ? ticket.module : "__CUSTOM__";
  });
  const [customModule, setCustomModule] = useState(() => {
    if (!ticket || knownModuleNames.has(ticket.module)) return "";
    return ticket.module || "";
  });
  const [supportType, setSupportType] = useState(
    () => ticket?.supportType || firstMod?.categories[0]?.name || "User Admin"
  );
  const [area, setArea] = useState(() => ticket?.area || "");
  const [executorIds, setExecutorIds] = useState<string[]>(() =>
    ticket ? (ticket.executors || []).map((e) => e.id) : []
  );
  const [assetId, setAssetId] = useState(() => ticket?.assetId || "");
  const [startDay, setStartDay] = useState(() => toDatePart(ticket?.startDate));
  const [startClock, setStartClock] = useState(() => toTimePart(ticket?.startDate));
  const [endDay, setEndDay] = useState(() =>
    ticket ? toDatePart(ticket.endDate || ticket.startDate) : format(new Date(), "yyyy-MM-dd")
  );
  const [endClock, setEndClock] = useState(() =>
    ticket
      ? toTimePart(ticket.endDate)
      : format(new Date(Date.now() + 60 * 60_000), "HH:mm")
  );
  const [status, setStatus] = useState(
    () => ticket?.status || (defaultTicketType === "REQUEST" ? "Not Started" : "Done")
  );
  const [priority, setPriority] = useState(() =>
    ticket ? normalizeSupportPriority(ticket.priority) : "Normal"
  );
  const [issue, setIssue] = useState(() => stripRichHtml(ticket?.issue));
  const [solution, setSolution] = useState(() => stripRichHtml(ticket?.solution));
  const [link, setLink] = useState(() => ticket?.link || "");
  const [attachment, setAttachment] = useState(() => ticket?.attachment || "");
  const [attachmentKey, setAttachmentKey] = useState(() => ticket?.attachmentKey || "");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [remindOk, setRemindOk] = useState(false);
  const [error, setError] = useState("");

  // Time Tracker state
  const [timeLogs, setTimeLogs] = useState<SupportTimeLogItem[]>(() => ticket?.timeLogs || []);
  const [timerBusy, setTimerBusy] = useState(false);
  const [manualMinutes, setManualMinutes] = useState("30");
  const [manualNote, setManualNote] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Promote to Project Task state
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteProjectId, setPromoteProjectId] = useState(() => projects[0]?.id || "");
  const [promoting, setPromoting] = useState(false);

  const activeLog = useMemo(() => timeLogs.find((l) => !l.endTime), [timeLogs]);

  useEffect(() => {
    if (!activeLog) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeLog]);

  const selectedModuleObj = useMemo(
    () => modules.find((m) => m.name === moduleName) || null,
    [modules, moduleName]
  );

  const categoryOptions = useMemo(() => {
    if (selectedModuleObj && selectedModuleObj.categories.length > 0) {
      const opts = selectedModuleObj.categories.map((c) => ({
        value: c.name,
        label: c.name,
      }));
      if (supportType && !opts.some((o) => o.value === supportType)) {
        opts.unshift({ value: supportType, label: supportType });
      }
      return opts;
    }
    const fallback = ["Rapat & Diskusi Internal", "Koordinasi Vendor", "Lainnya..."];
    if (supportType && !fallback.includes(supportType)) {
      fallback.unshift(supportType);
    }
    return fallback.map((name) => ({ value: name, label: name }));
  }, [selectedModuleObj, supportType]);

  const categoryRequiresArea = useMemo(() => {
    if (supportType === "Master Data") return true;
    const cat = selectedModuleObj?.categories.find((c) => c.name === supportType);
    return Boolean(cat?.requiresArea);
  }, [selectedModuleObj, supportType]);

  const moduleSelectOptions = useMemo(() => {
    const grouped = modules.map((m) => ({
      value: m.name,
      label: m.name,
      badge: m.groupName.split(" ")[0],
    }));
    grouped.push({
      value: "__CUSTOM__",
      label: "General IT / Custom...",
      badge: "Custom",
    });
    return grouped;
  }, [modules]);

  const assetSelectOptions = useMemo(
    () => [
      { value: "", label: t.support.noAssetLinked },
      ...assets.map((a) => ({
        value: a.id,
        label: `${a.assetCode} · ${a.assetName}`,
        badge: a.location || undefined,
      })),
    ],
    [assets, t.support.noAssetLinked]
  );

  const areaSelectOptions = useMemo(
    () => [
      { value: "", label: `— ${t.support.regionalAreaLabel} —` },
      ...areas.map((a) => ({ value: a, label: a })),
    ],
    [areas, t.support.regionalAreaLabel]
  );

  const totalLoggedSeconds = computeTicketLoggedSeconds(timeLogs, nowMs);

  const liveSla = ticket
    ? evaluateTicketSla(
        {
          ticketType,
          status,
          priority,
          startDate: combineDateTimeIso(startDay, startClock),
          endDate: ticket.endDate,
          slaDueAt: ticket.slaDueAt,
          slaTargetMinutes: ticket.slaTargetMinutes,
        },
        slaPolicies,
        nowMs
      )
    : null;

  const refreshTimeLogs = async (ticketId: string) => {
    const res = await fetch(`/api/timelogs?supportTicketId=${encodeURIComponent(ticketId)}`);
    if (res.ok) {
      setTimeLogs(await res.json());
    }
  };

  const handleModuleChange = (nextMod: string) => {
    setModuleName(nextMod);
    const modObj = modules.find((m) => m.name === nextMod);
    if (modObj && modObj.categories.length > 0) {
      setSupportType(modObj.categories[0].name);
    } else if (nextMod === "__CUSTOM__") {
      setSupportType("Lainnya...");
    }
  };

  const handleAreaChange = (nextArea: string) => {
    setArea(nextArea);
    if (nextArea && ticketType === "REQUEST" && categoryRequiresArea) {
      const matched = users
        .filter((u) => u.handledAreas.includes(nextArea))
        .map((u) => u.id);
      if (matched.length > 0) {
        setExecutorIds(matched);
      }
    }
  };

  const toggleExecutor = (uid: string) => {
    setExecutorIds((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "support");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
      } else {
        setAttachment(data.url);
        setAttachmentKey(data.key || "");
      }
    } catch {
      setError("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;
    setSaving(true);
    setError("");

    const finalModule =
      moduleName === "__CUSTOM__"
        ? customModule.trim() || "General IT / Lainnya..."
        : moduleName;
    const startIso = combineDateTimeIso(startDay, startClock);
    const endIso =
      ticketType === "DAILY_ACTIVITY" ? combineDateTimeIso(endDay, endClock) : undefined;

    const payload = {
      ticketType,
      taskName: taskName.trim(),
      requesterName: requesterName.trim() || null,
      requesterEmail: requesterEmail.trim() || null,
      module: finalModule,
      supportType: supportType || "Lainnya...",
      area: ticketType === "REQUEST" && categoryRequiresArea && area ? area : null,
      executorIds,
      assetId: assetId || null,
      startDate: startIso,
      ...(endIso !== undefined ? { endDate: endIso } : {}),
      status,
      priority,
      issue: issue.trim() || null,
      solution: solution.trim() || null,
      link: link.trim() || null,
      attachment: attachment || null,
      attachmentKey: attachmentKey || null,
    };

    try {
      const res = await fetch(ticket ? `/api/support/${ticket.id}` : "/api/support", {
        method: ticket ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save ticket");
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setError("Network error while saving ticket");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTimer = async () => {
    if (!ticket || timerBusy) return;
    setTimerBusy(true);
    setError("");
    try {
      const action = activeLog ? "PAUSE" : "START";
      const res = await fetch("/api/timelogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportTicketId: ticket.id, action }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Timer action failed");
      } else {
        if (action === "START" && status !== "Ongoing") {
          setStatus("Ongoing");
        }
        await refreshTimeLogs(ticket.id);
        await onSaved();
      }
    } finally {
      setTimerBusy(false);
    }
  };

  const handleAddManualTime = async () => {
    if (!ticket) return;
    const mins = Number(manualMinutes);
    if (!Number.isFinite(mins) || mins <= 0) {
      setError("Enter minutes > 0");
      return;
    }
    setTimerBusy(true);
    try {
      const res = await fetch("/api/timelogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supportTicketId: ticket.id,
          durationMinutes: mins,
          note: manualNote.trim() || undefined,
        }),
      });
      if (res.ok) {
        setManualNote("");
        await refreshTimeLogs(ticket.id);
        await onSaved();
      }
    } finally {
      setTimerBusy(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!ticket) return;
    const res = await fetch(`/api/timelogs/${logId}`, { method: "DELETE" });
    if (res.ok) {
      await refreshTimeLogs(ticket.id);
      await onSaved();
    }
  };

  const handleRemind = async () => {
    if (!ticket || reminding) return;
    setReminding(true);
    try {
      const res = await fetch(`/api/support/${ticket.id}/remind`, { method: "POST" });
      if (res.ok) {
        setRemindOk(true);
        onNotify("ok", t.support.remindSent);
        setTimeout(() => setRemindOk(false), 3000);
      } else {
        onNotify("err", t.support.remindFailed);
      }
    } catch {
      onNotify("err", t.support.remindFailed);
    } finally {
      setReminding(false);
    }
  };

  const handlePromote = async () => {
    if (!ticket || !promoteProjectId || promoting) return;
    setPromoting(true);
    try {
      const res = await fetch(`/api/support/${ticket.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: promoteProjectId }),
      });
      if (res.ok) {
        setPromoteOpen(false);
        onNotify("ok", t.support.promoteSuccess);
        await onSaved();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Promote failed");
      }
    } finally {
      setPromoting(false);
    }
  };

  const unread = Boolean(
    ticket?.comments?.[0] &&
      (!ticket.commentReadStatuses?.[0] ||
        new Date(ticket.comments[0].createdAt) >
          new Date(ticket.commentReadStatuses[0].lastReadAt))
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-2xl h-full bg-[var(--bg-surface)] border-l border-[var(--border-strong)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <h3 className="font-heading font-bold text-sm sm:text-base text-[var(--text-ink)] truncate">
                {ticket ? t.support.editTicket : ticketType === "REQUEST" ? t.support.newTicket : t.support.newLog}
              </h3>
              {ticket && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ticket.ticketNumber && (
                    <span className="font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-ink2)] whitespace-nowrap shrink-0">
                      {ticket.ticketNumber}
                    </span>
                  )}
                  <span className="font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] tnum whitespace-nowrap shrink-0">
                    {formatDurationCompact(totalLoggedSeconds)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {ticket && onOpenComments && (
              <button
                type="button"
                onClick={() => onOpenComments(ticket)}
                title={t.projects.commentsLabel}
                aria-label={t.projects.commentsLabel}
                className="relative inline-flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.projects.commentsLabel}</span>
                {unread && <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />}
              </button>
            )}
            {ticket && ticket.status !== "Done" && (
              <button
                type="button"
                onClick={handleRemind}
                disabled={reminding}
                title={t.support.remindTelegram}
                aria-label={t.support.remindTelegram}
                className="p-2 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] text-[var(--text-ink2)] cursor-pointer"
              >
                {reminding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : remindOk ? (
                  <Check className="w-3.5 h-3.5 text-[var(--ok)]" />
                ) : (
                  <Bell className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="text-xs font-semibold text-[var(--err)] bg-[var(--err-bg)] border border-[var(--err-stroke)] rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}

          {/* SLA Live Status Banner + Promoted Links */}
          {ticket && (liveSla?.state && liveSla.state !== "NONE" || (ticket.promotedTasks && ticket.promotedTasks.length > 0)) && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-2xl px-4 py-2.5">
              {liveSla && liveSla.state !== "NONE" && (
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      liveSla.state === "BREACHED" || liveSla.state === "MISSED"
                        ? "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]"
                        : liveSla.state === "AT_RISK"
                          ? "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]"
                          : "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]"
                    }`}
                  >
                    {liveSla.state === "BREACHED"
                      ? t.support.slaBreached
                      : liveSla.state === "AT_RISK"
                        ? t.support.slaAtRisk
                        : liveSla.state === "MET"
                          ? t.support.slaMet
                          : liveSla.state === "MISSED"
                            ? t.support.slaMissed
                            : t.support.slaOnTrack}
                  </span>
                  {liveSla.remainingMinutes !== null && (
                    <span className="font-mono-code text-[11px] text-[var(--text-ink2)] tnum">
                      {liveSla.remainingMinutes >= 0
                        ? `${t.support.slaRemainingPrefix} ${formatCompactMinutes(liveSla.remainingMinutes)}`
                        : `${t.support.slaOverduePrefix} ${formatCompactMinutes(liveSla.remainingMinutes)}`}
                    </span>
                  )}
                </div>
              )}

              {ticket.promotedTasks && ticket.promotedTasks.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {ticket.promotedTasks.map((pt) => (
                    <Link
                      key={pt.id}
                      href={pt.project ? `/projects?projectId=${pt.project.id}` : "/projects"}
                      className="inline-flex items-center gap-1 font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] hover:opacity-90"
                    >
                      <FolderKanban className="w-3 h-3" />
                      <span>{pt.project?.name || "Project"}</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hybrid Time Tracker Card */}
          {ticket && (
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

              <div className="flex flex-wrap items-center justify-between gap-3">
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
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold cursor-pointer ${
                    activeLog
                      ? "bg-[var(--warn-bg)] border border-[var(--warn-stroke)] text-[var(--warn)]"
                      : "bg-[var(--brand)] text-white dark:text-[#161A26]"
                  }`}
                >
                  {activeLog ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{activeLog ? t.projects.pauseTimer : t.projects.startTimer}</span>
                </button>
              </div>

              {/* Manual duration entry */}
              <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  className="w-20 px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-mono-code text-[var(--text-ink)] tnum"
                  placeholder="Min"
                />
                <input
                  type="text"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)]"
                  placeholder={t.projects.noteOptional}
                />
                <button
                  type="button"
                  onClick={handleAddManualTime}
                  disabled={timerBusy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] text-xs font-semibold text-[var(--text-ink)] hover:border-[var(--brand)] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.projects.logManualTime}</span>
                </button>
              </div>

              {timeLogs.length > 0 && (
                <div className="max-h-28 overflow-y-auto space-y-1 pt-1">
                  {timeLogs.slice(0, 6).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-2 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono-code text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                          {log.source}
                        </span>
                        <span className="font-medium text-[var(--text-ink)] truncate">
                          {log.user?.name || "IT Staff"}
                          {log.note ? ` · ${log.note}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono-code font-semibold text-[var(--text-ink2)] tnum">
                          {log.endTime
                            ? formatDurationCompact(log.durationSeconds ?? log.duration ?? 0)
                            : "LIVE"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLog(log.id)}
                          className="text-[var(--text-muted)] hover:text-[var(--err)] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Ticket Type Switch */}
          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              {t.support.ticketTypeLabel}
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
              {(
                [
                  { id: "REQUEST", label: t.support.requestLabel },
                  { id: "DAILY_ACTIVITY", label: t.support.dailyLogLabel },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTicketType(opt.id);
                    if (!ticket) {
                      setStatus(opt.id === "REQUEST" ? "Not Started" : "Done");
                    }
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    ticketType === opt.id
                      ? "bg-[var(--bg-surface)] text-[var(--brand)] border border-[var(--brand-stroke)] shadow-2xs"
                      : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject & Requester */}
          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              {t.support.titleLabel} <span className="text-[var(--err)]">*</span>
            </label>
            <input
              type="text"
              required
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder={
                ticketType === "REQUEST"
                  ? "e.g. ERP Login Error / Master Data Outlet Update"
                  : "e.g. Daily Printer Troubleshooting & Cabling Check"
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-sm text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
            />
          </div>

          {ticketType === "REQUEST" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  {t.support.requesterLabel}
                </label>
                <input
                  type="text"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  placeholder="e.g. Bpk Ruddin (Finance)"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
              <div>
                <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  {t.support.requesterEmailLabel}
                </label>
                <input
                  type="email"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                  placeholder="requester@royalmedicalink.id"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>
            </div>
          )}

          {/* Module & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {t.support.moduleLabel}
              </label>
              <ThemedSelect
                value={moduleName}
                onChange={handleModuleChange}
                options={moduleSelectOptions}
                className="w-full"
              />
              {moduleName === "__CUSTOM__" && (
                <input
                  type="text"
                  value={customModule}
                  onChange={(e) => setCustomModule(e.target.value)}
                  placeholder={t.support.customModulePlaceholder}
                  className="w-full mt-2 px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
                />
              )}
            </div>

            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {t.support.categoryLabel}
              </label>
              <ThemedSelect
                value={supportType}
                onChange={setSupportType}
                options={categoryOptions}
                className="w-full"
              />
            </div>
          </div>

          {/* Regional Area Auto-Assign + Asset Linking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ticketType === "REQUEST" && categoryRequiresArea && (
              <div>
                <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {t.support.regionalAreaLabel}
                  </span>
                </label>
                <ThemedSelect
                  value={area}
                  onChange={handleAreaChange}
                  options={areaSelectOptions}
                  className="w-full"
                />
                <p className="text-[10.5px] text-[var(--text-muted)] mt-1">
                  {t.support.autoAssignHint}
                </p>
              </div>
            )}

            <div className={ticketType === "REQUEST" && categoryRequiresArea ? "" : "sm:col-span-2"}>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                <span className="inline-flex items-center gap-1">
                  <Box className="w-3 h-3" /> {t.support.linkedAssetLabel}
                </span>
              </label>
              <ThemedSelect
                value={assetId}
                onChange={setAssetId}
                options={assetSelectOptions}
                className="w-full"
              />
            </div>
          </div>

          {/* Executors Selection */}
          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              {t.support.executorsLabel}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {users.map((u) => {
                const selected = executorIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleExecutor(u.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${
                      selected
                        ? "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]"
                        : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-ink2)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {u.photo && (
                      <Image
                        src={u.photo}
                        alt={u.name}
                        width={16}
                        height={16}
                        unoptimized
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    )}
                    <span>{u.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Status
              </label>
              <ThemedSelect
                value={status}
                onChange={setStatus}
                options={[
                  { value: "Not Started", label: "Not Started" },
                  { value: "Ongoing", label: "Ongoing" },
                  { value: "Suspended", label: "Suspended" },
                  { value: "Done", label: "Done" },
                ]}
                className="w-full"
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Priority
              </label>
              <ThemedSelect
                value={priority}
                onChange={(v) => setPriority(normalizeSupportPriority(v))}
                options={[
                  { value: "Low", label: "Low" },
                  { value: "Normal", label: "Normal" },
                  { value: "High", label: "High" },
                  { value: "Urgent", label: "Urgent" },
                ]}
                className="w-full"
              />
            </div>
          </div>

          {/* Start / End Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {t.support.startTimeLabel}
              </label>
              <div className="flex items-center gap-1.5">
                <ThemedDatePicker
                  value={startDay}
                  onChange={setStartDay}
                  locale={locale}
                  allowClear={false}
                  className="flex-1"
                />
                <ThemedTimePicker
                  value={startClock}
                  onChange={setStartClock}
                  locale={locale}
                  menuAlign="right"
                  ariaLabel={t.support.startTimeLabel}
                  className="w-28 shrink-0"
                />
              </div>
            </div>

            {ticketType === "DAILY_ACTIVITY" && (
              <div>
                <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  {t.support.endTimeLabel}
                </label>
                <div className="flex items-center gap-1.5">
                  <ThemedDatePicker
                    value={endDay}
                    onChange={setEndDay}
                    locale={locale}
                    allowClear={false}
                    className="flex-1"
                    menuAlign="right"
                  />
                  <ThemedTimePicker
                    value={endClock}
                    onChange={setEndClock}
                    locale={locale}
                    menuAlign="right"
                    ariaLabel={t.support.endTimeLabel}
                    className="w-28 shrink-0"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Issue & Solution */}
          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              {t.projects.issueLabel}
            </label>
            <textarea
              rows={3}
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="Detail kendala / error yang terjadi..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
            />
          </div>

          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              {t.projects.solutionLabel}
            </label>
            <textarea
              rows={3}
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
              placeholder="Langkah penanganan / solusi..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
            />
          </div>

          {/* Reference Link & MinIO Attachment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {t.support.referenceLinkLabel}
              </label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
              />
            </div>

            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {t.projects.docsAndUpload}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-strong)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] cursor-pointer">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{uploading ? "Uploading..." : t.projects.uploadFile}</span>
                  <input
                    type="file"
                    onChange={handleUpload}
                    disabled={uploading}
                    accept="image/*,.pdf,.xlsx,.csv,.txt,.docx"
                    className="hidden"
                  />
                </label>
                {attachment && (
                  <a
                    href={attachment}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline truncate max-w-[160px]"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{attachment.split("/").pop()}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Promote to Project Task Inline Panel (Existing ticket only) */}
          {ticket && projects.length > 0 && (
            <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-[var(--brand)]" />
                  <span className="text-xs font-semibold text-[var(--text-ink)]">
                    {t.support.promoteTask}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPromoteOpen((prev) => !prev)}
                  className="text-xs font-semibold text-[var(--brand)] hover:underline cursor-pointer"
                >
                  {promoteOpen ? t.common.cancel : t.support.promoteChooseProject}
                </button>
              </div>
              {promoteOpen && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <ThemedSelect
                    value={promoteProjectId}
                    onChange={setPromoteProjectId}
                    options={projects.map((p) => ({ value: p.id, label: p.name, badge: p.status }))}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={handlePromote}
                    disabled={promoting || !promoteProjectId}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {promoting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Rocket className="w-3.5 h-3.5" />
                    )}
                    <span>{t.support.promoteTask}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer Submit */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-ink2)] hover:text-[var(--text-ink)] cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving || !taskName.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{t.common.save}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
