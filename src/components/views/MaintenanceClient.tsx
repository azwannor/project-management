"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangle,
  Bell,
  Box,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  History,
  Loader2,
  MapPin,
  PackageX,
  Plus,
  QrCode,
  Search,
  ShieldAlert,
  Ticket,
  Trash2,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import {
  ASSET_STATUS_VALUES,
  computeScheduleUrgency,
  computeWarrantyHealth,
  resolveAssetHolder,
  resolveAssetLocationLabel,
} from "@/lib/maintenance-helpers";
import AssetDetailDrawer from "./maintenance/AssetDetailDrawer";
import QrCustodyView from "./maintenance/QrCustodyView";
import ExecuteMaintenancePanel from "./maintenance/ExecuteMaintenancePanel";
import {
  ExcelImportModal,
  ScheduleFormModal,
  TemplateFormModal,
} from "./maintenance/MaintenanceModals";
import type {
  AssetTypeOption,
  DivisionOption,
  EnterpriseAssetItem,
  LocationOption,
  MaintCurrentUser,
  MaintUserOption,
  MaintenanceLogItem,
  MaintenanceScheduleItem,
  MaintenanceTemplateItem,
} from "./maintenance/types";

export type MaintTabId = "assets" | "qr" | "schedules" | "execute" | "templates";

interface MaintenanceClientProps {
  currentUser: MaintCurrentUser;
  divisions: DivisionOption[];
  assetTypes: AssetTypeOption[];
  locations: LocationOption[];
  assets: EnterpriseAssetItem[];
  templates: MaintenanceTemplateItem[];
  schedules: MaintenanceScheduleItem[];
  logs: MaintenanceLogItem[];
  systemUsers: MaintUserOption[];
  qrSvgMap: Record<string, string>;
  initialTab?: MaintTabId;
  initialScheduleId?: string | null;
  initialAssetId?: string | null;
}

export default function MaintenanceClient({
  currentUser,
  divisions,
  assetTypes,
  locations,
  assets,
  templates,
  schedules,
  logs,
  systemUsers,
  qrSvgMap,
  initialTab = "assets",
  initialScheduleId = null,
  initialAssetId = null,
}: MaintenanceClientProps) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const isAdmin = currentUser.canManageMaintenance || currentUser.role?.toLowerCase() === "admin";

  const [activeTab, setActiveTab] = useState<MaintTabId>(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState<MaintTabId>(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  // Registry filters
  const [assetSearch, setAssetSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Schedule filters
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState("all");
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState("all");

  // Drawers & modals
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(() =>
    Boolean(initialAssetId && assets.some((a) => a.id === initialAssetId))
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(initialAssetId);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceScheduleItem | null>(null);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MaintenanceTemplateItem | null>(null);

  const [executingScheduleId, setExecutingScheduleId] = useState<string | null>(
    () =>
      initialScheduleId ||
      schedules.find((s) => s.status !== "DONE")?.id ||
      null
  );

  // Confirm modals (replaces window.confirm)
  const [retireTarget, setRetireTarget] = useState<EnterpriseAssetItem | null>(null);
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<MaintenanceScheduleItem | null>(
    null
  );
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<MaintenanceTemplateItem | null>(
    null
  );
  const [busyAction, setBusyAction] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [nowMs] = useState(() => Date.now());

  const showToast = useCallback((kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refreshServerData = useCallback(() => {
    router.refresh();
  }, [router]);

  // 4 Enterprise KPI Metrics
  const kpiStats = useMemo(() => {
    let activeCount = 0;
    let repairIssueCount = 0;
    let warrantyAlertCount = 0;

    for (const a of assets) {
      if (a.status === "ACTIVE" || a.status === "SPARE") activeCount += 1;
      if (a.status === "IN_REPAIR" || a.status === "LOST") repairIssueCount += 1;
      const wh = computeWarrantyHealth(a.warrantyEndDate, nowMs);
      if (wh.state === "EXPIRED" || wh.state === "EXPIRING_SOON") {
        warrantyAlertCount += 1;
      }
    }

    const pendingSchedules = schedules.filter((s) => s.status !== "DONE");
    const overdueCount = pendingSchedules.filter(
      (s) => computeScheduleUrgency(s.status, s.nextDueDate, nowMs).state === "OVERDUE"
    ).length;

    return {
      totalAssets: assets.length,
      activeCount,
      repairIssueCount,
      warrantyAlertCount,
      pendingCount: pendingSchedules.length,
      overdueCount,
    };
  }, [assets, schedules, nowMs]);

  const activeAsset = useMemo(
    () => (selectedAssetId ? assets.find((a) => a.id === selectedAssetId) || null : null),
    [selectedAssetId, assets]
  );

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    return assets.filter((a) => {
      if (divisionFilter !== "all" && a.divisionId !== divisionFilter) return false;
      if (typeFilter !== "all" && a.assetTypeId !== typeFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (q) {
        const hay = [
          a.assetCode,
          a.assetName,
          a.brand || "",
          a.model || "",
          a.serialNumber || "",
          resolveAssetHolder(a) || "",
          resolveAssetLocationLabel(a) || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [assets, assetSearch, divisionFilter, typeFilter, statusFilter]);

  const pendingSchedules = useMemo(
    () => schedules.filter((s) => s.status !== "DONE"),
    [schedules]
  );

  const filteredSchedules = useMemo(() => {
    const q = scheduleSearch.trim().toLowerCase();
    return schedules.filter((s) => {
      if (scheduleStatusFilter !== "all" && s.status !== scheduleStatusFilter) return false;
      if (scheduleTypeFilter !== "all" && s.scheduleType !== scheduleTypeFilter) return false;
      if (q) {
        const hay = [
          s.asset.assetCode,
          s.asset.assetName,
          s.asset.location || "",
          s.template?.templateName || "",
          s.assignedExecutors.map((e) => e.name).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [schedules, scheduleSearch, scheduleStatusFilter, scheduleTypeFilter]);

  const executingSchedule = useMemo(
    () =>
      (executingScheduleId
        ? pendingSchedules.find((s) => s.id === executingScheduleId)
        : null) ||
      pendingSchedules[0] ||
      null,
    [executingScheduleId, pendingSchedules]
  );

  const tabs = useMemo(() => {
    const list: Array<{
      id: MaintTabId;
      label: string;
      shortLabel: string;
      count: number;
      icon: typeof Box;
    }> = [
      {
        id: "assets",
        label: t.assets.registryTab,
        shortLabel: locale === "id" ? "Aset" : "Registry",
        count: assets.length,
        icon: Box,
      },
      {
        id: "qr",
        label: t.assets.qrStudioTab,
        shortLabel: locale === "id" ? "QR" : "QR Code",
        count: assets.length,
        icon: QrCode,
      },
      {
        id: "schedules",
        label: t.assets.schedulesTab,
        shortLabel: locale === "id" ? "Jadwal" : "Schedule",
        count: kpiStats.pendingCount,
        icon: CalendarClock,
      },
      {
        id: "execute",
        label: t.assets.execTab,
        shortLabel: locale === "id" ? "Eksekusi" : "Execute",
        count: logs.length,
        icon: Wrench,
      },
    ];
    if (isAdmin) {
      list.push({
        id: "templates",
        label: t.assets.templatesTab,
        shortLabel: locale === "id" ? "Templat" : "Template",
        count: templates.length,
        icon: ClipboardList,
      });
    }
    return list;
  }, [
    isAdmin,
    locale,
    t.assets.registryTab,
    t.assets.qrStudioTab,
    t.assets.schedulesTab,
    t.assets.execTab,
    t.assets.templatesTab,
    assets.length,
    kpiStats.pendingCount,
    logs.length,
    templates.length,
  ]);

  const handleRetireConfirm = async () => {
    if (!retireTarget || busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/assets/${retireTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("ok", `${retireTarget.assetCode} retired`);
        setRetireTarget(null);
        refreshServerData();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast("err", d.error || "Failed to retire asset");
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteScheduleConfirm = async () => {
    if (!deleteScheduleTarget || busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/maintenance-schedules/${deleteScheduleTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("ok", "Schedule deleted");
        setDeleteScheduleTarget(null);
        refreshServerData();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast("err", d.error || "Cannot delete schedule");
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteTemplateConfirm = async () => {
    if (!deleteTemplateTarget || busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/maintenance-templates/${deleteTemplateTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("ok", "Template deleted");
        setDeleteTemplateTarget(null);
        refreshServerData();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast("err", d.error || "Cannot delete template");
      }
    } finally {
      setBusyAction(false);
    }
  };

  const handleDuplicateTemplate = async (tpl: MaintenanceTemplateItem) => {
    const res = await fetch(`/api/maintenance-templates/${tpl.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      showToast("ok", "Template duplicated");
      refreshServerData();
    } else {
      showToast("err", "Failed to duplicate template");
    }
  };

  const handleRemindSchedule = async (sch: MaintenanceScheduleItem) => {
    if (remindingId) return;
    setRemindingId(sch.id);
    try {
      const res = await fetch(`/api/maintenance-schedules/${sch.id}/remind`, { method: "POST" });
      showToast(res.ok ? "ok" : "err", res.ok ? "Reminder sent" : "Failed to send reminder");
    } finally {
      setRemindingId(null);
    }
  };

  const renderAssetStatusBadge = (status: string) => {
    const tone =
      status === "ACTIVE"
        ? "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]"
        : status === "IN_REPAIR"
          ? "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]"
          : status === "SPARE"
            ? "bg-[var(--info-bg)] border-[var(--info-stroke)] text-[var(--info)]"
            : status === "RETIRED" || status === "LOST"
              ? "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]"
              : "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-ink2)]";

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full border font-mono-code text-[10px] font-bold whitespace-nowrap ${tone}`}
      >
        {status.replace("_", " ")}
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

      {/* 1. Top Workspace Switcher Bar */}
      <section className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-2.5 sm:px-3.5">
        <div
          className={`grid ${isAdmin ? "grid-cols-5" : "grid-cols-4"} sm:inline-flex sm:flex-wrap items-center bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-2xl sm:rounded-full p-0.5 gap-0.5 w-full lg:w-auto`}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 sm:px-3 py-1.5 rounded-xl sm:rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                    : "text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="sm:hidden truncate max-w-full">{tab.shortLabel}</span>
                <span className="hidden sm:inline truncate max-w-full">{tab.label}</span>
                <span className="hidden md:inline font-mono-code text-[9.5px] text-[var(--text-muted)] tnum">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Context CTA buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {activeTab === "assets" && isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{t.assets.importExcel}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedAssetId(null);
                  setAssetDrawerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.assets.newAsset}</span>
              </button>
            </>
          )}

          {activeTab === "schedules" && (
            <button
              type="button"
              onClick={() => {
                setEditingSchedule(null);
                setScheduleModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.assets.newSchedule}</span>
            </button>
          )}

          {activeTab === "templates" && isAdmin && (
            <button
              type="button"
              onClick={() => {
                setEditingTemplate(null);
                setTemplateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.assets.newTemplate}</span>
            </button>
          )}
        </div>
      </section>

      {/* 2. Enterprise Telemetry Strip (4 KPI Cards) */}
      <section className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t.assets.kpiTotalAssets}
            </span>
            <Box className="w-4 h-4 text-[var(--brand)] shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-extrabold text-xl sm:text-2xl text-[var(--text-ink)] tnum">
              {kpiStats.totalAssets}
            </span>
            <span className="font-mono-code text-[10px] font-bold text-[var(--ok)] tnum">
              {kpiStats.activeCount} active
            </span>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t.assets.kpiInRepair}
            </span>
            <AlertTriangle className="w-4 h-4 text-[var(--warn)] shrink-0" />
          </div>
          <span className="font-heading font-extrabold text-xl sm:text-2xl text-[var(--text-ink)] tnum">
            {kpiStats.repairIssueCount}
          </span>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t.assets.kpiWarrantyAlert}
            </span>
            <ShieldAlert className="w-4 h-4 text-[var(--err)] shrink-0" />
          </div>
          <span className="font-heading font-extrabold text-xl sm:text-2xl text-[var(--text-ink)] tnum">
            {kpiStats.warrantyAlertCount}
          </span>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t.assets.kpiPendingSched}
            </span>
            <CalendarClock className="w-4 h-4 text-[var(--info)] shrink-0" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-extrabold text-xl sm:text-2xl text-[var(--text-ink)] tnum">
              {kpiStats.pendingCount}
            </span>
            {kpiStats.overdueCount > 0 && (
              <span className="font-mono-code text-[10px] font-bold text-[var(--err)] tnum">
                {kpiStats.overdueCount} overdue
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════
          TAB 1: ASSET REGISTRY
         ═════════════════════════════════════════════════════════════ */}
      {activeTab === "assets" && (
        <div className="space-y-3.5">
          {/* Filters */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3">
            <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-2">
              <div className="relative flex-1 min-w-0 lg:max-w-xs">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder={t.assets.searchPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
                <ThemedSelect
                  value={divisionFilter}
                  onChange={setDivisionFilter}
                  options={[
                    { value: "all", label: t.assets.allDivisions },
                    ...divisions.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                  className="w-full sm:w-auto sm:min-w-[150px]"
                />
                <ThemedSelect
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={[
                    { value: "all", label: t.assets.allTypes },
                    ...assetTypes.map((at) => ({ value: at.id, label: at.name })),
                  ]}
                  className="w-full sm:w-auto sm:min-w-[160px]"
                />
                <ThemedSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "all", label: t.assets.allStatuses },
                    ...ASSET_STATUS_VALUES.map((s) => ({ value: s, label: s.replace("_", " ") })),
                  ]}
                  className="col-span-2 sm:col-span-1 w-full sm:w-auto sm:min-w-[140px]"
                />
              </div>
            </div>
          </div>

          {/* Desktop/Tablet Table */}
          <div className="hidden md:block bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
            {filteredAssets.length === 0 ? (
              <div className="py-14 text-center text-xs text-[var(--text-muted)]">
                No assets match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="py-3 px-3.5">Code</th>
                      <th className="py-3 px-3">Asset & Specs</th>
                      <th className="py-3 px-3">Type & Division</th>
                      <th className="py-3 px-3">Custody & Location</th>
                      <th className="py-3 px-3">Status & Warranty</th>
                      <th className="py-3 px-3.5 text-right">{t.common.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {filteredAssets.map((a) => {
                      const holder = resolveAssetHolder(a);
                      const loc = resolveAssetLocationLabel(a);
                      const wh = computeWarrantyHealth(a.warrantyEndDate, nowMs);
                      return (
                        <tr
                          key={a.id}
                          onClick={() => {
                            setSelectedAssetId(a.id);
                            setAssetDrawerOpen(true);
                          }}
                          className="hover:bg-[var(--bg-canvas)]/70 transition-colors cursor-pointer align-top"
                        >
                          <td className="py-3 px-3.5 min-w-[130px]">
                            <span className="font-mono-code text-xs font-bold text-[var(--brand)] whitespace-nowrap">
                              {a.assetCode}
                            </span>
                            {a.qrPrintedAt && (
                              <p className="font-mono-code text-[9.5px] text-[var(--ok)] mt-0.5">
                                {t.assets.qrPrintedLabel}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3 max-w-[260px]">
                            <p className="font-semibold text-xs text-[var(--text-ink)] truncate">
                              {a.assetName}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                              {[a.brand, a.model, a.serialNumber ? `SN: ${a.serialNumber}` : null]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <p className="text-xs font-medium text-[var(--text-ink)]">
                              {a.assetType?.name || "—"}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              {a.division?.name || "—"}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <p className="text-xs font-medium text-[var(--text-ink)] flex items-center gap-1">
                              <UserCheck className="w-3 h-3 text-[var(--brand)] shrink-0" />
                              <span className="truncate max-w-[170px]">{holder || "Unassigned"}</span>
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[170px]">{loc || "—"}</span>
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col items-start gap-1">
                              {renderAssetStatusBadge(a.status)}
                              {wh.state !== "UNTRACKED" && (
                                <span
                                  className={`font-mono-code text-[9.5px] font-bold ${
                                    wh.state === "EXPIRED"
                                      ? "text-[var(--err)]"
                                      : wh.state === "EXPIRING_SOON"
                                        ? "text-[var(--warn)]"
                                        : "text-[var(--ok)]"
                                  }`}
                                >
                                  {wh.state === "EXPIRED"
                                    ? t.assets.warrantyExpired
                                    : wh.state === "EXPIRING_SOON"
                                      ? `${t.assets.warrantyExpiring} (${wh.daysRemaining}d)`
                                      : t.assets.warrantyActive}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Link
                                href={`/assets/q/${encodeURIComponent(a.assetCode)}`}
                                onClick={(e) => e.stopPropagation()}
                                title={t.assets.openScanPage}
                                className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] hover:border-[var(--brand)]"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </Link>
                              {isAdmin && a.status !== "RETIRED" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRetireTarget(a);
                                  }}
                                  title="Retire Asset"
                                  className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--err)] cursor-pointer"
                                >
                                  <PackageX className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-2.5">
            {filteredAssets.map((a) => {
              const holder = resolveAssetHolder(a);
              const loc = resolveAssetLocationLabel(a);
              return (
                <div
                  key={a.id}
                  onClick={() => {
                    setSelectedAssetId(a.id);
                    setAssetDrawerOpen(true);
                  }}
                  className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 space-y-2 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono-code text-xs font-bold text-[var(--brand)] whitespace-nowrap">
                      {a.assetCode}
                    </span>
                    {renderAssetStatusBadge(a.status)}
                  </div>
                  <p className="font-semibold text-sm text-[var(--text-ink)] line-clamp-1">
                    {a.assetName}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {[a.assetType?.name, a.division?.name, loc].filter(Boolean).join(" · ")}
                  </p>
                  <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[var(--text-ink2)] truncate">
                      {holder || "Unassigned"}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/assets/q/${encodeURIComponent(a.assetCode)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)]"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </Link>
                      {isAdmin && a.status !== "RETIRED" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRetireTarget(a);
                          }}
                          className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
                        >
                          <PackageX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════
          TAB 2: QR STICKER STUDIO & CUSTODY AUDIT
         ═════════════════════════════════════════════════════════════ */}
      {activeTab === "qr" && (
        <QrCustodyView
          assets={assets}
          initialQrSvgMap={qrSvgMap}
          isAdmin={isAdmin}
          onRefresh={refreshServerData}
          onNotify={showToast}
        />
      )}

      {/* ═════════════════════════════════════════════════════════════
          TAB 3: PREVENTIVE MAINTENANCE SCHEDULES
         ═════════════════════════════════════════════════════════════ */}
      {activeTab === "schedules" && (
        <div className="space-y-3.5">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
              <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={scheduleSearch}
                  onChange={(e) => setScheduleSearch(e.target.value)}
                  placeholder="Search asset or executor..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
                />
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                <ThemedSelect
                  value={scheduleStatusFilter}
                  onChange={setScheduleStatusFilter}
                  options={[
                    { value: "all", label: t.assets.allStatuses },
                    { value: "OVERDUE", label: "OVERDUE" },
                    { value: "DUE", label: "DUE" },
                    { value: "UPCOMING", label: "UPCOMING" },
                    { value: "DONE", label: "DONE" },
                  ]}
                  className="w-full sm:w-40"
                />
                <ThemedSelect
                  value={scheduleTypeFilter}
                  onChange={setScheduleTypeFilter}
                  options={[
                    { value: "all", label: "All Types" },
                    { value: "RECURRING", label: "RECURRING" },
                    { value: "ADHOC", label: "ADHOC" },
                  ]}
                  className="w-full sm:w-40"
                />
              </div>
            </div>
          </div>

          <div className="hidden md:block bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
            {filteredSchedules.length === 0 ? (
              <div className="py-14 text-center text-xs text-[var(--text-muted)]">
                No maintenance schedules found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="py-3 px-3.5">Asset</th>
                      <th className="py-3 px-3">Template & Cycle</th>
                      <th className="py-3 px-3">Due Date & Urgency</th>
                      <th className="py-3 px-3">Executors</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3.5 text-right">{t.common.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {filteredSchedules.map((sch) => {
                      const urg = computeScheduleUrgency(sch.status, sch.nextDueDate, nowMs);
                      return (
                        <tr
                          key={sch.id}
                          className="hover:bg-[var(--bg-canvas)]/60 transition-colors align-top"
                        >
                          <td className="py-3 px-3.5">
                            <p className="font-mono-code text-[11px] font-bold text-[var(--brand)]">
                              {sch.asset.assetCode}
                            </p>
                            <p className="text-xs font-semibold text-[var(--text-ink)]">
                              {sch.asset.assetName}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)]">
                              {sch.asset.location || "-"}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <p className="text-xs font-medium text-[var(--text-ink)]">
                              {sch.template?.templateName || "Ad-Hoc Inspection"}
                            </p>
                            <p className="font-mono-code text-[10px] text-[var(--text-muted)]">
                              {sch.scheduleType}
                              {sch.frequencyDays ? ` · Every ${sch.frequencyDays}d` : ""}
                            </p>
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-mono-code text-xs font-semibold text-[var(--text-ink)] tnum">
                              {format(new Date(sch.nextDueDate), "dd MMM yyyy")}
                            </p>
                            {sch.status !== "DONE" && (
                              <span
                                className={`inline-block mt-1 font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${
                                  urg.state === "OVERDUE"
                                    ? "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]"
                                    : urg.state === "DUE_SOON"
                                      ? "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]"
                                      : "bg-[var(--info-bg)] border-[var(--info-stroke)] text-[var(--info)]"
                                }`}
                              >
                                {urg.state === "OVERDUE"
                                  ? `${Math.abs(urg.daysDelta)}d overdue`
                                  : `in ${urg.daysDelta}d`}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs text-[var(--text-ink2)]">
                            {sch.assignedExecutors.length > 0
                              ? sch.assignedExecutors.map((e) => e.name).join(", ")
                              : "Unassigned"}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full border font-mono-code text-[10px] font-bold ${
                                sch.status === "DONE"
                                  ? "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]"
                                  : sch.status === "OVERDUE"
                                    ? "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]"
                                    : "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]"
                              }`}
                            >
                              {sch.status}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              {sch.status !== "DONE" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExecutingScheduleId(sch.id);
                                      setActiveTab("execute");
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-[11px] font-semibold cursor-pointer"
                                  >
                                    <ClipboardCheck className="w-3 h-3" />
                                    <span>{t.assets.executeNow}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemindSchedule(sch)}
                                    disabled={remindingId === sch.id}
                                    title={t.assets.remindTelegram}
                                    className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] cursor-pointer"
                                  >
                                    {remindingId === sch.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Bell className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </>
                              )}
                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSchedule(sch);
                                      setScheduleModalOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteScheduleTarget(sch)}
                                    className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--err)] cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mobile Schedule Cards */}
          <div className="md:hidden space-y-2.5">
            {filteredSchedules.map((sch) => (
              <div
                key={sch.id}
                className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono-code text-[10.5px] font-bold text-[var(--brand)]">
                      {sch.asset.assetCode}
                    </span>
                    <p className="font-semibold text-sm text-[var(--text-ink)]">
                      {sch.asset.assetName}
                    </p>
                  </div>
                  <span className="font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-ink2)]">
                    {sch.status}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-ink2)]">
                  {sch.template?.templateName || "Ad-Hoc"} · Due{" "}
                  {format(new Date(sch.nextDueDate), "dd MMM yyyy")}
                </p>
                {sch.status !== "DONE" && (
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => handleRemindSchedule(sch)}
                      className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)]"
                    >
                      <Bell className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExecutingScheduleId(sch.id);
                        setActiveTab("execute");
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>{t.assets.executeNow}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════
          TAB 4: EXECUTE MAINTENANCE CHECKLIST & INSPECTION HISTORY
         ═════════════════════════════════════════════════════════════ */}
      {activeTab === "execute" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Interactive Execution Panel */}
          <div className="xl:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[var(--brand)]" />
                <h3 className="font-heading font-bold text-sm text-[var(--text-ink)]">
                  {t.assets.pendingQueueTitle}
                </h3>
              </div>

              {pendingSchedules.length > 0 && (
                <ThemedSelect
                  value={executingSchedule?.id || ""}
                  onChange={setExecutingScheduleId}
                  options={pendingSchedules.map((s) => ({
                    value: s.id,
                    label: `${s.asset.assetCode} · ${s.asset.assetName}`,
                    badge: format(new Date(s.nextDueDate), "dd MMM"),
                  }))}
                  className="w-full sm:w-72"
                  menuAlign="right"
                />
              )}
            </div>

            {!executingSchedule ? (
              <div className="py-12 text-center space-y-2 text-[var(--text-muted)]">
                <CheckCircle2 className="w-9 h-9 text-[var(--ok)] mx-auto" />
                <p className="text-sm font-semibold text-[var(--text-ink)]">
                  {t.assets.noPendingSchedules}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-mono-code font-bold text-[var(--brand)]">
                      {executingSchedule.asset.assetCode}
                    </p>
                    <p className="font-semibold text-[var(--text-ink)]">
                      {executingSchedule.asset.assetName}
                    </p>
                  </div>
                  <span className="font-mono-code text-[11px] text-[var(--text-muted)] tnum">
                    Due {format(new Date(executingSchedule.nextDueDate), "dd MMM yyyy")}
                  </span>
                </div>

                <ExecuteMaintenancePanel
                  key={executingSchedule.id}
                  schedule={executingSchedule}
                  onNotify={showToast}
                  onSubmitted={() => {
                    refreshServerData();
                  }}
                />
              </div>
            )}
          </div>

          {/* Inspection History Logs */}
          <div className="xl:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)]">
              <History className="w-4 h-4 text-[var(--ok)]" />
              <h3 className="font-heading font-bold text-sm text-[var(--text-ink)]">
                {t.assets.recentLogsTitle} ({logs.length})
              </h3>
            </div>

            {logs.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-8 text-center">
                No maintenance logs recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {logs.map((l) => (
                  <div
                    key={l.id}
                    className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-1.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono-code text-[10.5px] font-bold text-[var(--brand)]">
                          {l.schedule?.asset.assetCode || "ASSET"}
                        </p>
                        <p className="font-semibold text-[var(--text-ink)] truncate">
                          {l.schedule?.asset.assetName || "Maintenance Log"}
                        </p>
                      </div>
                      <span
                        className={`font-mono-code text-[9.5px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          l.overallCondition === "BAIK"
                            ? "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]"
                            : l.overallCondition === "PERLU_PERHATIAN"
                              ? "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]"
                              : "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]"
                        }`}
                      >
                        {l.overallCondition}
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)]">
                      {l.executedBy?.name || "IT Staff"} ·{" "}
                      {format(new Date(l.executionDate), "dd MMM yyyy HH:mm")} ·{" "}
                      {l.checklistResults.filter((c) => c.checked).length}/{l.checklistResults.length}{" "}
                      passed
                    </p>

                    {l.findings && (
                      <p className="text-[11px] text-[var(--text-ink2)]">{l.findings}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {l.supportTicket && (
                        <Link
                          href={`/support?ticket=${l.supportTicket.id}`}
                          className="inline-flex items-center gap-1 font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--warn-bg)] border border-[var(--warn-stroke)] text-[var(--warn)]"
                        >
                          <Ticket className="w-3 h-3" />
                          <span>{l.supportTicket.ticketNumber || "Support Ticket"}</span>
                        </Link>
                      )}
                      {l.attachment && (
                        <a
                          href={l.attachment}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand)] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> Proof
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════
          TAB 5: CHECKLIST TEMPLATES (ADMIN ONLY)
         ═════════════════════════════════════════════════════════════ */}
      {activeTab === "templates" && isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)]">
                      {tpl.assetType?.name || "Asset Type"}
                    </span>
                    <h4 className="font-heading font-bold text-sm text-[var(--text-ink)] mt-1.5">
                      {tpl.templateName}
                    </h4>
                  </div>
                  <span className="font-mono-code text-[10.5px] font-bold text-[var(--text-muted)] shrink-0 tnum">
                    Every {tpl.defaultFrequencyDays}d
                  </span>
                </div>

                <ul className="space-y-1 text-xs text-[var(--text-ink2)]">
                  {tpl.checklistItems.slice(0, 4).map((it) => (
                    <li key={it.id} className="flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="w-3 h-3 text-[var(--ok)] shrink-0" />
                      <span className="truncate">{it.itemText}</span>
                    </li>
                  ))}
                  {tpl.checklistItems.length > 4 && (
                    <li className="text-[11px] text-[var(--text-muted)] pl-4">
                      +{tpl.checklistItems.length - 4} more items
                    </li>
                  )}
                </ul>
              </div>

              <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                <span className="font-mono-code text-[10px] text-[var(--text-muted)] tnum">
                  {tpl._count?.schedules || 0} active schedule(s)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDuplicateTemplate(tpl)}
                    title={t.assets.duplicateTemplate}
                    className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplate(tpl);
                      setTemplateModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-ink2)] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTemplateTarget(tpl)}
                    className="p-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--err)] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawers & Modals */}
      <AssetDetailDrawer
        isOpen={assetDrawerOpen}
        asset={activeAsset}
        qrSvgMap={qrSvgMap}
        assetTypes={assetTypes}
        divisions={divisions}
        locations={locations}
        users={systemUsers}
        isAdmin={isAdmin}
        onClose={() => {
          setAssetDrawerOpen(false);
          setSelectedAssetId(null);
        }}
        onSaved={refreshServerData}
        onNotify={showToast}
        onQuickMasterCreated={refreshServerData}
      />

      <ExcelImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={refreshServerData}
        onNotify={showToast}
      />

      <ScheduleFormModal
        isOpen={scheduleModalOpen}
        schedule={editingSchedule}
        assets={assets}
        templates={templates}
        users={systemUsers}
        isAdmin={isAdmin}
        onClose={() => {
          setScheduleModalOpen(false);
          setEditingSchedule(null);
        }}
        onSaved={refreshServerData}
        onNotify={showToast}
      />

      <TemplateFormModal
        isOpen={templateModalOpen}
        template={editingTemplate}
        assetTypes={assetTypes}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplate(null);
        }}
        onSaved={refreshServerData}
        onNotify={showToast}
      />

      {/* Retire / Delete Confirmation Modals */}
      {(retireTarget || deleteScheduleTarget || deleteTemplateTarget) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-xl p-5 space-y-4">
            <div className="space-y-1">
              <h4 className="font-heading font-bold text-base text-[var(--text-ink)]">
                {t.projects.confirmDeleteTitle}
              </h4>
              <p className="text-xs text-[var(--text-ink2)]">
                {retireTarget
                  ? t.assets.retireAssetConfirm
                  : deleteScheduleTarget
                    ? `Delete schedule for ${deleteScheduleTarget.asset.assetCode}?`
                    : `Delete template "${deleteTemplateTarget?.templateName}"?`}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRetireTarget(null);
                  setDeleteScheduleTarget(null);
                  setDeleteTemplateTarget(null);
                }}
                className="px-4 py-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={busyAction}
                onClick={
                  retireTarget
                    ? handleRetireConfirm
                    : deleteScheduleTarget
                      ? handleDeleteScheduleConfirm
                      : handleDeleteTemplateConfirm
                }
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--err)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {busyAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t.common.delete}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
