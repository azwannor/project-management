"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Bell,
  Box,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  FolderKanban,
  Headset,
  Layers,
  Loader2,
  MapPin,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import { ThemedDatePicker } from "@/components/ui/ThemedDatePicker";
import CommentsDrawer from "@/components/common/CommentsDrawer";
import { formatDurationCompact } from "@/lib/format";
import { useUiPref } from "@/lib/ui-prefs";
import {
  computeTicketLoggedSeconds,
  evaluateTicketSla,
  formatCompactMinutes,
  formatSafeCsvCell,
  normalizeSupportPriority,
  stripRichHtml,
} from "@/lib/support-helpers";
import SupportTicketDrawer from "./support/SupportTicketDrawer";
import type {
  SupportAssetOption,
  SupportCurrentUser,
  SupportModuleOption,
  SupportProjectOption,
  SupportSlaPolicyItem,
  SupportTicketItem,
  SupportUserItem,
} from "./support/types";

interface SupportClientProps {
  initialTickets: SupportTicketItem[];
  currentUser: SupportCurrentUser;
  systemUsers: SupportUserItem[];
  modules: SupportModuleOption[];
  areas: string[];
  slaPolicies: SupportSlaPolicyItem[];
  assets: SupportAssetOption[];
  projects: SupportProjectOption[];
  initialTicketId?: string | null;
}

const PAGE_SIZE = 50;

export default function SupportClient({
  initialTickets,
  currentUser,
  systemUsers,
  modules,
  areas,
  slaPolicies,
  assets,
  projects,
  initialTicketId = null,
}: SupportClientProps) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const canViewTeam = currentUser.role === "Admin" || currentUser.canViewTeamLogs;

  const [tickets, setTickets] = useState<SupportTicketItem[]>(initialTickets);
  const [prevInitialTickets, setPrevInitialTickets] = useState<SupportTicketItem[]>(initialTickets);
  if (initialTickets !== prevInitialTickets) {
    setPrevInitialTickets(initialTickets);
    setTickets(initialTickets);
  }

  const [viewMode, setViewMode] = useUiPref("support_mode", "queue") as [
    "queue" | "daily" | "all",
    (v: string) => void,
  ];
  const [scope, setScope] = useUiPref(
    "support_scope",
    canViewTeam ? "team" : "my"
  ) as ["my" | "team", (v: string) => void];

  const [searchQuery, setSearchQuery] = useState("");
  const [slaFilter, setSlaFilter] = useState<"all" | "alert" | "urgent">("all");
  const [userFilter, setUserFilter] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  // Drawer & modals
  const [drawerOpen, setDrawerOpen] = useState(() =>
    Boolean(initialTicketId && initialTickets.some((tk) => tk.id === initialTicketId))
  );
  const [activeTicketId, setActiveTicketId] = useState<string | null>(initialTicketId);
  const [drawerDefaultType, setDrawerDefaultType] = useState<"REQUEST" | "DAILY_ACTIVITY">(
    "REQUEST"
  );
  const [commentTicket, setCommentTicket] = useState<{ id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportTicketItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [timerBusyId, setTimerBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const showToast = useCallback((kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refreshTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/support", { cache: "no-store" });
      if (res.ok) {
        setTickets(await res.json());
      }
      router.refresh();
    } catch (err) {
      console.error("Failed to refresh support tickets:", err);
    }
  }, [router]);

  const runningTicket = useMemo(
    () =>
      tickets.find((tk) =>
        (tk.timeLogs || []).some((l) => !l.endTime && l.userId === currentUser.id)
      ) || null,
    [tickets, currentUser.id]
  );

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), runningTicket ? 1000 : 30_000);
    return () => clearInterval(interval);
  }, [runningTicket]);

  const effectiveScope: "my" | "team" = canViewTeam ? scope : "my";

  const scopedTickets = useMemo(() => {
    return tickets.filter((tk) => {
      if (effectiveScope === "my") {
        const isCreator = tk.userId === currentUser.id;
        const isExecutor = (tk.executors || []).some((e) => e.id === currentUser.id);
        if (!isCreator && !isExecutor) return false;
      }
      return true;
    });
  }, [tickets, effectiveScope, currentUser.id]);

  // Tab badge counts
  const modeCounts = useMemo(() => {
    let queueOpen = 0;
    let queueTotal = 0;
    let dailyTotal = 0;
    for (const tk of scopedTickets) {
      if (tk.ticketType === "REQUEST") {
        queueTotal += 1;
        if (tk.status !== "Done") queueOpen += 1;
      } else {
        dailyTotal += 1;
      }
    }
    return {
      queueOpen,
      queueTotal,
      dailyTotal,
      allTotal: scopedTickets.length,
    };
  }, [scopedTickets]);

  // 4 Enterprise KPI calculations for current scope
  const kpiSummary = useMemo(() => {
    const requests = scopedTickets.filter((tk) => tk.ticketType === "REQUEST");
    const daily = scopedTickets.filter((tk) => tk.ticketType !== "REQUEST");

    const openReq = requests.filter((tk) => tk.status !== "Done");
    const urgentOpen = openReq.filter(
      (tk) => normalizeSupportPriority(tk.priority) === "Urgent"
    ).length;

    let slaMetOrOnTrack = 0;
    let slaTrackedTotal = 0;
    let atRiskCount = 0;
    let breachedCount = 0;
    let totalResolveMins = 0;
    let resolvedWithDuration = 0;

    for (const tk of requests) {
      const ev = evaluateTicketSla(tk, slaPolicies, nowMs);
      if (ev.state !== "NONE") {
        slaTrackedTotal += 1;
        if (ev.state === "MET" || ev.state === "ON_TRACK") slaMetOrOnTrack += 1;
        if (ev.state === "AT_RISK") atRiskCount += 1;
        if (ev.state === "BREACHED" || ev.state === "MISSED") breachedCount += 1;
      }
      if (tk.status === "Done" && tk.endDate) {
        const startMs = new Date(tk.startDate).getTime();
        const endMs = new Date(tk.endDate).getTime();
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
          totalResolveMins += (endMs - startMs) / 60_000;
          resolvedWithDuration += 1;
        }
      }
    }

    let dailySeconds = 0;
    for (const tk of scopedTickets) {
      const logged = computeTicketLoggedSeconds(tk.timeLogs, nowMs);
      if (logged > 0) {
        dailySeconds += logged;
      } else if (tk.endDate) {
        const s = new Date(tk.startDate).getTime();
        const e = new Date(tk.endDate).getTime();
        if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) {
          dailySeconds += Math.round((e - s) / 1000);
        }
      }
    }

    const slaRate =
      slaTrackedTotal > 0 ? Math.round((slaMetOrOnTrack / slaTrackedTotal) * 100) : 100;
    const avgMttrMinutes =
      resolvedWithDuration > 0 ? Math.round(totalResolveMins / resolvedWithDuration) : 0;

    return {
      openReqCount: openReq.length,
      urgentOpen,
      slaRate,
      atRiskCount,
      breachedCount,
      dailyCount: daily.length,
      dailySeconds,
      avgMttrMinutes,
      resolvedCount: resolvedWithDuration,
    };
  }, [scopedTickets, slaPolicies, nowMs]);

  const activeTicket = useMemo(
    () => (activeTicketId ? tickets.find((tk) => tk.id === activeTicketId) || null : null),
    [activeTicketId, tickets]
  );

  // Build dropdown options from live DB modules + categories + any historical values in tickets
  const moduleFilterOptions = useMemo(() => {
    const names = new Set<string>(modules.map((m) => m.name));
    for (const tk of tickets) {
      if (tk.module) names.add(tk.module);
    }
    return [
      { value: "all", label: t.support.allModules },
      ...Array.from(names)
        .sort()
        .map((m) => ({ value: m, label: m })),
    ];
  }, [modules, tickets, t.support.allModules]);

  const categoryFilterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const m of modules) {
      for (const c of m.categories) names.add(c.name);
    }
    for (const tk of tickets) {
      if (tk.supportType) names.add(tk.supportType);
    }
    return [
      { value: "all", label: t.support.allCategories },
      ...Array.from(names)
        .sort()
        .map((c) => ({ value: c, label: c })),
    ];
  }, [modules, tickets, t.support.allCategories]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedTickets.filter((tk) => {
      if (viewMode === "queue" && tk.ticketType !== "REQUEST") return false;
      if (viewMode === "daily" && tk.ticketType === "REQUEST") return false;

      if (userFilter !== "all") {
        const isCreator = tk.userId === userFilter;
        const isExec = (tk.executors || []).some((e) => e.id === userFilter);
        if (!isCreator && !isExec) return false;
      }
      if (moduleFilter !== "all" && tk.module !== moduleFilter) return false;
      if (categoryFilter !== "all" && tk.supportType !== categoryFilter) return false;
      if (statusFilter !== "all" && tk.status !== statusFilter) return false;

      if (dateFilter) {
        const d = new Date(tk.startDate);
        const dayStr = Number.isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
        if (dayStr !== dateFilter) return false;
      }

      if (slaFilter === "alert") {
        const ev = evaluateTicketSla(tk, slaPolicies, nowMs);
        if (ev.state !== "AT_RISK" && ev.state !== "BREACHED" && ev.state !== "MISSED") {
          return false;
        }
      } else if (slaFilter === "urgent") {
        const p = normalizeSupportPriority(tk.priority);
        if (p !== "Urgent" && p !== "High") return false;
      }

      if (q) {
        const haystack = [
          tk.ticketNumber || "",
          tk.taskName,
          tk.requesterName || "",
          tk.module,
          tk.supportType,
          tk.area || "",
          tk.asset?.assetCode || "",
          tk.asset?.assetName || "",
          stripRichHtml(tk.issue),
          (tk.executors || []).map((e) => e.name).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    scopedTickets,
    viewMode,
    userFilter,
    moduleFilter,
    categoryFilter,
    statusFilter,
    dateFilter,
    slaFilter,
    searchQuery,
    slaPolicies,
    nowMs,
  ]);

  const visibleTickets = useMemo(
    () => filteredTickets.slice(0, visibleLimit),
    [filteredTickets, visibleLimit]
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    slaFilter !== "all" ||
    userFilter !== "all" ||
    moduleFilter !== "all" ||
    categoryFilter !== "all" ||
    statusFilter !== "all" ||
    dateFilter !== "";

  const clearFilters = () => {
    setSearchQuery("");
    setSlaFilter("all");
    setUserFilter("all");
    setModuleFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setDateFilter("");
  };

  const handleExportCsv = () => {
    const headers = [
      "Ticket #",
      "Type",
      "Start Time",
      "End Time",
      "Requester",
      "Executor",
      "Subject",
      "Module",
      "Category",
      "Area",
      "Asset",
      "Issue",
      "Solution",
      "Status",
      "Priority",
    ];
    const rows = filteredTickets.map((tk) => [
      tk.ticketNumber || tk.id,
      tk.ticketType,
      tk.startDate ? format(new Date(tk.startDate), "yyyy-MM-dd HH:mm") : "-",
      tk.endDate ? format(new Date(tk.endDate), "yyyy-MM-dd HH:mm") : "-",
      tk.requesterName || tk.user?.name || "-",
      tk.ticketType === "REQUEST"
        ? (tk.executors || []).map((e) => e.name).join(", ") || "Unassigned"
        : tk.user?.name || "-",
      tk.taskName,
      tk.module,
      tk.supportType,
      tk.area || "-",
      tk.asset ? `${tk.asset.assetCode} (${tk.asset.assetName})` : "-",
      stripRichHtml(tk.issue),
      stripRichHtml(tk.solution),
      tk.status,
      normalizeSupportPriority(tk.priority),
    ]);

    const csv = [
      headers.map(formatSafeCsvCell).join(","),
      ...rows.map((r) => r.map(formatSafeCsvCell).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `IT_Support_${viewMode}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleQuickTimer = async (tk: SupportTicketItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerBusyId) return;
    setTimerBusyId(tk.id);
    const isRunningHere = (tk.timeLogs || []).some(
      (l) => !l.endTime && l.userId === currentUser.id
    );
    try {
      const res = await fetch("/api/timelogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supportTicketId: tk.id,
          action: isRunningHere ? "PAUSE" : "START",
        }),
      });
      if (res.ok) {
        await refreshTickets();
      } else {
        showToast("err", "Timer update failed");
      }
    } finally {
      setTimerBusyId(null);
    }
  };

  const handleQuickRemind = async (tk: SupportTicketItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (remindingId) return;
    setRemindingId(tk.id);
    try {
      const res = await fetch(`/api/support/${tk.id}/remind`, { method: "POST" });
      showToast(res.ok ? "ok" : "err", res.ok ? t.support.remindSent : t.support.remindFailed);
    } catch {
      showToast("err", t.support.remindFailed);
    } finally {
      setRemindingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/support/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        if (activeTicketId === deleteTarget.id) {
          setDrawerOpen(false);
          setActiveTicketId(null);
        }
        setDeleteTarget(null);
        await refreshTickets();
      } else {
        showToast("err", "Failed to delete ticket");
      }
    } finally {
      setDeleting(false);
    }
  };

  const openCreateDrawer = (type: "REQUEST" | "DAILY_ACTIVITY") => {
    setActiveTicketId(null);
    setDrawerDefaultType(type);
    setDrawerOpen(true);
  };

  const openTicketDrawer = (tk: SupportTicketItem) => {
    setActiveTicketId(tk.id);
    setDrawerOpen(true);
  };

  const renderStatusPill = (status: string) => {
    if (status === "Done" || status === "Completed") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-stroke)] text-[var(--ok)] text-[10px] font-bold whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3" /> Done
        </span>
      );
    }
    if (status === "Ongoing") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--info-bg)] border border-[var(--info-stroke)] text-[var(--info)] text-[10px] font-bold whitespace-nowrap">
          <Clock className="w-3 h-3" /> Ongoing
        </span>
      );
    }
    if (status === "Suspended") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--warn-bg)] border border-[var(--warn-stroke)] text-[var(--warn)] text-[10px] font-bold whitespace-nowrap">
          <AlertTriangle className="w-3 h-3" /> Suspended
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-ink2)] text-[10px] font-bold whitespace-nowrap">
        {status}
      </span>
    );
  };

  const renderPriorityPill = (priority: string) => {
    const norm = normalizeSupportPriority(priority);
    if (norm === "Urgent") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] font-mono-code text-[10px] font-bold whitespace-nowrap">
          URGENT
        </span>
      );
    }
    if (norm === "High") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--warn-bg)] border border-[var(--warn-stroke)] text-[var(--warn)] font-mono-code text-[10px] font-bold whitespace-nowrap">
          High
        </span>
      );
    }
    if (norm === "Low") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] font-mono-code text-[10px] font-bold whitespace-nowrap">
          Low
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] font-mono-code text-[10px] font-bold whitespace-nowrap">
        Normal
      </span>
    );
  };

  const renderSlaBadge = (tk: SupportTicketItem) => {
    const ev = evaluateTicketSla(tk, slaPolicies, nowMs);
    if (ev.state === "NONE") return null;

    const badgeTone =
      ev.state === "BREACHED" || ev.state === "MISSED"
        ? "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]"
        : ev.state === "AT_RISK"
          ? "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]"
          : "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]";

    const label =
      ev.state === "BREACHED"
        ? `BREACH ${ev.remainingMinutes !== null ? formatCompactMinutes(ev.remainingMinutes) : ""}`
        : ev.state === "AT_RISK"
          ? `RISK ${ev.remainingMinutes !== null ? formatCompactMinutes(ev.remainingMinutes) : ""}`
          : ev.state === "MET"
            ? t.support.slaMet
            : ev.state === "MISSED"
              ? t.support.slaMissed
              : `${ev.remainingMinutes !== null ? formatCompactMinutes(ev.remainingMinutes) : "SLA"}`;

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-mono-code text-[9.5px] font-bold tnum whitespace-nowrap ${badgeTone}`}
      >
        {label.trim()}
      </span>
    );
  };

  return (
    <div className="w-full px-3 sm:px-5 lg:px-6 py-4 space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-20 md:bottom-5 right-4 z-50 px-4 py-2.5 rounded-2xl border shadow-lg text-xs font-semibold flex items-center gap-2 ${
            toast.kind === "ok"
              ? "bg-[var(--bg-surface)] border-[var(--ok-stroke)] text-[var(--ok)]"
              : "bg-[var(--bg-surface)] border-[var(--err-stroke)] text-[var(--err)]"
          }`}
        >
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Top Workspace Control Bar */}
      <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-2.5 sm:px-3.5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap xl:flex-nowrap sm:items-center gap-2">
          {/* Mode Switcher: Support Queue | Daily Activity | All */}
          <div className="grid grid-cols-3 sm:inline-flex items-center bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-2xl sm:rounded-full p-0.5 gap-0.5 w-full sm:w-auto">
            {(
              [
                {
                  id: "queue",
                  label: t.support.queueTab,
                  count: `${modeCounts.queueOpen}/${modeCounts.queueTotal}`,
                  icon: Headset,
                },
                {
                  id: "daily",
                  label: t.support.dailyTab,
                  count: String(modeCounts.dailyTotal),
                  icon: ClipboardList,
                },
                {
                  id: "all",
                  label: t.support.allTab,
                  count: String(modeCounts.allTotal),
                  icon: Layers,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setViewMode(tab.id);
                    setVisibleLimit(PAGE_SIZE);
                  }}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-3 py-1.5 rounded-xl sm:rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                      : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-full">{tab.label}</span>
                  <span className="hidden md:inline font-mono-code text-[9.5px] text-[var(--text-muted)] tnum">
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scope Toggle (My Queue vs Team Ops) */}
          {canViewTeam && (
            <div className="inline-flex items-center bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5 self-start sm:self-auto">
              {(
                [
                  { id: "team", label: t.support.teamScope },
                  { id: "my", label: t.support.myScope },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setScope(opt.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    effectiveScope === opt.id
                      ? "bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-2xs"
                      : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Actions: Live Timer Pill + Export CSV + New Ticket */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
          {runningTicket && (
            <button
              type="button"
              onClick={() => openTicketDrawer(runningTicket)}
              className="inline-flex items-center gap-1.5 font-mono-code text-[10.5px] font-bold px-3 py-1.5 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-stroke)] text-[var(--ok)] tnum cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)] animate-pulse" />
              <span>
                {formatDurationCompact(computeTicketLoggedSeconds(runningTicket.timeLogs, nowMs))} ·{" "}
                {runningTicket.taskName.slice(0, 18)}
              </span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.support.exportCsv}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                openCreateDrawer(viewMode === "daily" ? "DAILY_ACTIVITY" : "REQUEST")
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{viewMode === "daily" ? t.support.newLog : t.support.newTicket}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Enterprise Telemetry Strip (4 KPI Cards) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t.support.kpiOpenQueue}
            </span>
            <Headset className="w-4 h-4 text-[var(--brand)] shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-extrabold text-xl sm:text-2xl text-[var(--text-ink)] tnum">
              {kpiSummary.openReqCount}
            </span>
            {kpiSummary.urgentOpen > 0 && (
              <span className="font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] tnum">
                {kpiSummary.urgentOpen} URGENT
              </span>
            )}
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t.support.kpiSlaHealth}
            </span>
            <ShieldCheck className="w-4 h-4 text-[var(--ok)] shrink-0" />
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-heading font-extrabold text-xl sm:text-2xl text-[var(--text-ink)] tnum">
              {kpiSummary.slaRate}%
            </span>
            {(kpiSummary.breachedCount > 0 || kpiSummary.atRiskCount > 0) && (
              <span className="font-mono-code text-[10px] font-bold text-[var(--err)] tnum">
                {kpiSummary.breachedCount} breach · {kpiSummary.atRiskCount} risk
              </span>
            )}
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t.support.kpiDailyActivity}
            </span>
            <Activity className="w-4 h-4 text-[var(--info)] shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-extrabold text-xl sm:text-2xl text-[var(--text-ink)] tnum">
              {kpiSummary.dailyCount}
            </span>
            <span className="font-mono-code text-[10.5px] font-semibold text-[var(--text-muted)] tnum">
              · {formatDurationCompact(kpiSummary.dailySeconds)}
            </span>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t.support.kpiAvgMttr}
            </span>
            <Clock className="w-4 h-4 text-[var(--warn)] shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-extrabold text-xl sm:text-2xl text-[var(--text-ink)] tnum">
              {kpiSummary.resolvedCount > 0 ? formatCompactMinutes(kpiSummary.avgMttrMinutes) : "—"}
            </span>
            <span className="font-mono-code text-[10px] text-[var(--text-muted)] tnum">
              {kpiSummary.resolvedCount} solved
            </span>
          </div>
        </div>
      </section>

      {/* 3. Filter Toolbar */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto lg:flex-1">
            <div className="relative flex-1 min-w-0 sm:min-w-[190px] lg:max-w-xs">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.support.searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
              />
            </div>

            <div className="grid grid-cols-3 sm:inline-flex items-center bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5 w-full sm:w-auto shrink-0">
              {(
                [
                  { id: "all", label: t.support.slaFilterAll },
                  { id: "alert", label: t.support.slaFilterAlert },
                  { id: "urgent", label: t.support.slaFilterUrgent },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSlaFilter(opt.id)}
                  className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[10.5px] font-semibold transition-colors cursor-pointer whitespace-nowrap truncate text-center ${
                    slaFilter === opt.id
                      ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                      : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
            {canViewTeam && effectiveScope === "team" && (
              <ThemedSelect
                value={userFilter}
                onChange={setUserFilter}
                options={[
                  { value: "all", label: t.support.allUsers },
                  ...systemUsers.map((u) => ({ value: u.id, label: u.name })),
                ]}
                className="w-full sm:w-auto sm:min-w-[140px]"
              />
            )}

            <ThemedSelect
              value={moduleFilter}
              onChange={setModuleFilter}
              options={moduleFilterOptions}
              className="w-full sm:w-auto sm:min-w-[155px]"
            />

            <ThemedSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryFilterOptions}
              className="w-full sm:w-auto sm:min-w-[155px]"
            />

            <ThemedSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: t.support.allStatuses },
                { value: "Not Started", label: "Not Started" },
                { value: "Ongoing", label: "Ongoing" },
                { value: "Suspended", label: "Suspended" },
                { value: "Done", label: "Done" },
              ]}
              className="w-full sm:w-auto sm:min-w-[130px]"
            />

            <ThemedDatePicker
              value={dateFilter}
              onChange={setDateFilter}
              locale={locale}
              placeholder={t.support.filterDatePlaceholder}
              className="col-span-2 sm:col-span-1 w-full sm:w-44"
              menuAlign="right"
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="col-span-2 sm:col-span-1 px-3 py-1.5 rounded-full bg-[var(--err-bg)] border border-[var(--err-stroke)] text-[var(--err)] text-[11px] font-semibold cursor-pointer whitespace-nowrap text-center"
              >
                {t.support.clearFilters}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4. Desktop / Tablet Table View */}
      <section className="hidden md:block bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
        {visibleTickets.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-2">
            <Headset className="w-9 h-9 text-[var(--text-muted)] mx-auto" />
            <p className="font-heading font-bold text-sm text-[var(--text-ink)]">
              {t.support.emptyTitle}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{t.support.emptyDesc}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="py-3 px-3.5">{t.support.colTicketMode}</th>
                  <th className="py-3 px-3">{t.support.colSubjectContext}</th>
                  <th className="py-3 px-3">{t.support.colModuleCategory}</th>
                  <th className="py-3 px-3">{t.support.colRequesterStaff}</th>
                  <th className="py-3 px-3">{t.support.colScheduleSla}</th>
                  <th className="py-3 px-3">{t.support.colStatusPriority}</th>
                  <th className="py-3 px-3.5 text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {visibleTickets.map((tk) => {
                  const isRunningHere = (tk.timeLogs || []).some(
                    (l) => !l.endTime && l.userId === currentUser.id
                  );
                  const unread = Boolean(
                    tk.comments?.[0] &&
                      (!tk.commentReadStatuses?.[0] ||
                        new Date(tk.comments[0].createdAt) >
                          new Date(tk.commentReadStatuses[0].lastReadAt))
                  );
                  const loggedSecs = computeTicketLoggedSeconds(tk.timeLogs, nowMs);
                  const cleanIssue = stripRichHtml(tk.issue);

                  return (
                    <tr
                      key={tk.id}
                      onClick={() => openTicketDrawer(tk)}
                      className="hover:bg-[var(--bg-canvas)]/70 transition-colors cursor-pointer align-top"
                    >
                      <td className="py-3 px-3.5 min-w-[132px]">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono-code text-[11px] font-bold text-[var(--text-ink)] tnum whitespace-nowrap">
                            {tk.ticketNumber || tk.id.slice(0, 8)}
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            <span
                              className={`font-mono-code text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                tk.ticketType === "REQUEST"
                                  ? "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]"
                                  : "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-ink2)]"
                              }`}
                            >
                              {tk.ticketType === "REQUEST" ? "REQ" : "DAILY"}
                            </span>
                            {tk.sourceType && tk.sourceType !== "MANUAL" && (
                              <span className="font-mono-code text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--info-bg)] text-[var(--info)]">
                                {tk.sourceType}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 max-w-[300px]">
                        <p className="font-semibold text-xs text-[var(--text-ink)] line-clamp-1">
                          {tk.taskName}
                        </p>
                        {cleanIssue && (
                          <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                            {cleanIssue}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {tk.area && (
                            <span className="inline-flex items-center gap-0.5 font-mono-code text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-ink2)]">
                              <MapPin className="w-2.5 h-2.5" /> {tk.area}
                            </span>
                          )}
                          {tk.asset && (
                            <span className="inline-flex items-center gap-0.5 font-mono-code text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-ink2)]">
                              <Box className="w-2.5 h-2.5" /> {tk.asset.assetCode}
                            </span>
                          )}
                          {tk.promotedTasks && tk.promotedTasks.length > 0 && (
                            <Link
                              href={
                                tk.promotedTasks[0].project
                                  ? `/projects?projectId=${tk.promotedTasks[0].project.id}`
                                  : "/projects"
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 font-mono-code text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--brand-tint)] text-[var(--brand)] hover:underline"
                            >
                              <FolderKanban className="w-2.5 h-2.5" />
                              {t.support.promotedBadge}
                            </Link>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 w-[170px]">
                        <p className="text-xs font-semibold text-[var(--text-ink)] line-clamp-1">
                          {tk.module}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                          {tk.supportType}
                        </p>
                      </td>

                      <td className="py-3 px-3 w-[170px]">
                        <p className="text-xs font-medium text-[var(--text-ink)] line-clamp-1">
                          {tk.requesterName || tk.user?.name || "-"}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          {(tk.executors || []).slice(0, 3).map((ex) => (
                            <span
                              key={ex.id}
                              title={ex.name}
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[9px] font-bold text-[var(--brand)] overflow-hidden"
                            >
                              {ex.photo ? (
                                <Image
                                  src={ex.photo}
                                  alt={ex.name}
                                  width={20}
                                  height={20}
                                  unoptimized
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                ex.name.charAt(0).toUpperCase()
                              )}
                            </span>
                          ))}
                          <span className="text-[11px] text-[var(--text-ink2)] truncate">
                            {tk.ticketType === "REQUEST"
                              ? (tk.executors || []).map((e) => e.name).join(", ") || "Unassigned"
                              : tk.user?.name || "-"}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 w-[165px]">
                        <p className="font-mono-code text-[11px] text-[var(--text-ink)] tnum">
                          {format(new Date(tk.startDate), "dd MMM HH:mm")}
                        </p>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {renderSlaBadge(tk)}
                          {loggedSecs > 0 && (
                            <span className="font-mono-code text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-ink2)] tnum">
                              {formatDurationCompact(loggedSecs)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 w-[125px]">
                        <div className="flex flex-col items-start gap-1">
                          {renderStatusPill(tk.status)}
                          {renderPriorityPill(tk.priority)}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-right w-[135px]">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleQuickTimer(tk, e)}
                            disabled={timerBusyId === tk.id}
                            title={isRunningHere ? t.projects.pauseTimer : t.projects.startTimer}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isRunningHere
                                ? "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]"
                                : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-ink2)] hover:border-[var(--brand)]"
                            }`}
                          >
                            {isRunningHere ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {tk.status !== "Done" && (
                            <button
                              type="button"
                              onClick={(e) => handleQuickRemind(tk, e)}
                              disabled={remindingId === tk.id}
                              title={t.support.remindTelegram}
                              className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] hover:border-[var(--brand)] cursor-pointer"
                            >
                              {remindingId === tk.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Bell className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCommentTicket({ id: tk.id, title: tk.taskName });
                            }}
                            title={t.projects.commentsLabel}
                            className="relative p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] hover:border-[var(--brand)] cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            {unread && (
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--brand)]" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(tk);
                            }}
                            title="Delete"
                            className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--err)] hover:border-[var(--err-stroke)] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. Mobile (< md) Card List */}
      <section className="md:hidden space-y-2.5">
        {visibleTickets.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl py-12 px-4 text-center space-y-2">
            <Headset className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
            <p className="font-heading font-bold text-sm text-[var(--text-ink)]">
              {t.support.emptyTitle}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{t.support.emptyDesc}</p>
          </div>
        ) : (
          visibleTickets.map((tk) => {
            const isRunningHere = (tk.timeLogs || []).some(
              (l) => !l.endTime && l.userId === currentUser.id
            );
            const cleanIssue = stripRichHtml(tk.issue);

            return (
              <div
                key={tk.id}
                onClick={() => openTicketDrawer(tk)}
                className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 space-y-2 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono-code text-[10.5px] font-bold text-[var(--text-ink2)] tnum">
                      {tk.ticketNumber || tk.id.slice(0, 8)}
                    </span>
                    <span
                      className={`font-mono-code text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                        tk.ticketType === "REQUEST"
                          ? "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]"
                          : "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-ink2)]"
                      }`}
                    >
                      {tk.ticketType === "REQUEST" ? "REQ" : "DAILY"}
                    </span>
                    {renderSlaBadge(tk)}
                  </div>
                  {renderPriorityPill(tk.priority)}
                </div>

                <p className="font-semibold text-sm text-[var(--text-ink)] line-clamp-2">
                  {tk.taskName}
                </p>

                {cleanIssue && (
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2">{cleanIssue}</p>
                )}

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-ink2)]">
                  <span className="font-semibold">{tk.module}</span>
                  <span>·</span>
                  <span>{tk.supportType}</span>
                  {tk.area && (
                    <>
                      <span>·</span>
                      <span className="font-mono-code text-[10px]">{tk.area}</span>
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {renderStatusPill(tk.status)}
                    <span className="font-mono-code text-[10px] text-[var(--text-muted)] truncate tnum">
                      {format(new Date(tk.startDate), "dd MMM HH:mm")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleQuickTimer(tk, e)}
                      disabled={timerBusyId === tk.id}
                      aria-label={isRunningHere ? t.projects.pauseTimer : t.projects.startTimer}
                      className={`p-1.5 rounded-lg border cursor-pointer ${
                        isRunningHere
                          ? "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]"
                          : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-ink2)]"
                      }`}
                    >
                      {isRunningHere ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    {tk.status !== "Done" && (
                      <button
                        type="button"
                        onClick={(e) => handleQuickRemind(tk, e)}
                        disabled={remindingId === tk.id}
                        aria-label={t.support.remindTelegram}
                        className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] cursor-pointer"
                      >
                        {remindingId === tk.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Bell className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    {tk.link && (
                      <a
                        href={tk.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={t.support.referenceLinkLabel}
                        className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCommentTicket({ id: tk.id, title: tk.taskName });
                      }}
                      aria-label={t.projects.commentsLabel}
                      className="relative p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {tk.comments?.[0] &&
                        (!tk.commentReadStatuses?.[0] ||
                          new Date(tk.comments[0].createdAt) >
                            new Date(tk.commentReadStatuses[0].lastReadAt)) && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--brand)]" />
                        )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(tk);
                      }}
                      aria-label={t.common.delete}
                      className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--err)] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Pagination Footer */}
      {filteredTickets.length > visibleTickets.length && (
        <div className="flex items-center justify-center pt-1">
          <button
            type="button"
            onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
            className="px-5 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-strong)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] cursor-pointer tnum"
          >
            {t.support.showMore} ({visibleTickets.length} / {filteredTickets.length})
          </button>
        </div>
      )}

      {/* Create / Edit / Detail Drawer */}
      <SupportTicketDrawer
        isOpen={drawerOpen}
        ticket={activeTicket}
        defaultTicketType={drawerDefaultType}
        modules={modules}
        areas={areas}
        assets={assets}
        projects={projects}
        slaPolicies={slaPolicies}
        users={systemUsers}
        onClose={() => {
          setDrawerOpen(false);
          setActiveTicketId(null);
        }}
        onSaved={refreshTickets}
        onNotify={showToast}
        onOpenComments={(tk) => setCommentTicket({ id: tk.id, title: tk.taskName })}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-xl p-5 space-y-4">
            <div className="space-y-1">
              <h4 className="font-heading font-bold text-base text-[var(--text-ink)]">
                {t.projects.confirmDeleteTitle}
              </h4>
              <p className="text-xs text-[var(--text-ink2)]">{t.support.deleteConfirm}</p>
              <p className="text-xs font-semibold text-[var(--text-ink)] pt-1 truncate">
                {deleteTarget.ticketNumber ? `${deleteTarget.ticketNumber} · ` : ""}
                {deleteTarget.taskName}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--err)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t.common.delete}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Drawer */}
      {commentTicket && (
        <CommentsDrawer
          isOpen={!!commentTicket}
          onClose={() => {
            setCommentTicket(null);
            refreshTickets();
          }}
          entityId={commentTicket.id}
          entityType="supportTicket"
          entityTitle={commentTicket.title}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  );
}
