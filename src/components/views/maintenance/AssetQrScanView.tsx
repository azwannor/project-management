"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  History,
  Loader2,
  MapPin,
  QrCode,
  Ticket,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import {
  computeScheduleUrgency,
  computeWarrantyHealth,
  resolveAssetHolder,
  resolveAssetLocationLabel,
} from "@/lib/maintenance-helpers";
import ExecuteMaintenancePanel from "./ExecuteMaintenancePanel";
import type {
  EnterpriseAssetItem,
  MaintenanceLogItem,
  MaintenanceScheduleItem,
} from "./types";

interface AssetQrScanViewProps {
  asset: EnterpriseAssetItem;
  schedules: MaintenanceScheduleItem[];
  logs: MaintenanceLogItem[];
  qrSvg: string;
}

export default function AssetQrScanView({
  asset,
  schedules,
  logs,
  qrSvg,
}: AssetQrScanViewProps) {
  const { t } = useI18n();
  const router = useRouter();

  const [executingSchedule, setExecutingSchedule] = useState<MaintenanceScheduleItem | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState(`[Asset Issue] ${asset.assetName} (${asset.assetCode})`);
  const [issueDetail, setIssueDetail] = useState("");
  const [issuePriority, setIssuePriority] = useState("Normal");
  const [reporting, setReporting] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [nowMs] = useState(() => Date.now());

  const showToast = (kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  };

  const holder = resolveAssetHolder(asset);
  const locLabel = resolveAssetLocationLabel(asset);
  const warranty = computeWarrantyHealth(asset.warrantyEndDate, nowMs);
  const pendingSchedules = schedules.filter((s) => s.status !== "DONE");

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim() || reporting) return;
    setReporting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: issueTitle.trim(),
          ticketType: "REQUEST",
          module: "IT Asset Management",
          supportType: "Hardware Troubleshooting",
          area: asset.detailedLocation || asset.location || null,
          priority: issuePriority,
          issue: issueDetail.trim() || null,
          sourceType: "QR_SCAN",
          assetId: asset.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("err", data.error || "Failed to report issue");
        return;
      }
      setReportOpen(false);
      setIssueDetail("");
      showToast("ok", `Support Ticket ${data.ticketNumber || ""} created`);
      router.refresh();
    } catch {
      showToast("err", "Network error while creating ticket");
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-5 py-4 space-y-4">
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

      {/* Top Back Bar */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/maintenance"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink2)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t.assets.registryTab}</span>
        </Link>

        <span className="font-mono-code text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)]">
          QR FIELD SCAN
        </span>
      </div>

      {/* Asset Identity Hero Card */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-20 h-20 rounded-xl bg-white border border-[var(--border-subtle)] p-1.5 shrink-0 flex items-center justify-center overflow-hidden">
            {qrSvg ? (
              <div
                className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <QrCode className="w-10 h-10 text-slate-700" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono-code text-xs font-extrabold text-[var(--brand)]">
                {asset.assetCode}
              </span>
              <span
                className={`font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  asset.status === "ACTIVE"
                    ? "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]"
                    : asset.status === "IN_REPAIR"
                      ? "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]"
                      : "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]"
                }`}
              >
                {asset.status.replace("_", " ")}
              </span>
            </div>
            <h1 className="font-heading font-bold text-lg text-[var(--text-ink)]">
              {asset.assetName}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              {[asset.assetType?.name, asset.brand, asset.model, asset.serialNumber ? `SN: ${asset.serialNumber}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
          <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-2.5">
            <p className="font-mono-code text-[9.5px] font-bold uppercase text-[var(--text-muted)]">
              Holder / PIC
            </p>
            <p className="text-xs font-semibold text-[var(--text-ink)] mt-0.5 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
              <span className="truncate">{holder || asset.pic?.name || "Unassigned"}</span>
            </p>
          </div>

          <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-2.5">
            <p className="font-mono-code text-[9.5px] font-bold uppercase text-[var(--text-muted)]">
              Division & Location
            </p>
            <p className="text-xs font-semibold text-[var(--text-ink)] mt-0.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[var(--info)] shrink-0" />
              <span className="truncate">
                {[asset.division?.name, locLabel].filter(Boolean).join(" · ") || "-"}
              </span>
            </p>
          </div>

          <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-2.5">
            <p className="font-mono-code text-[9.5px] font-bold uppercase text-[var(--text-muted)]">
              Warranty
            </p>
            <p className="text-xs font-semibold text-[var(--text-ink)] mt-0.5">
              {warranty.state === "UNTRACKED"
                ? t.assets.noWarranty
                : warranty.state === "EXPIRED"
                  ? t.assets.warrantyExpired
                  : warranty.state === "EXPIRING_SOON"
                    ? `${t.assets.warrantyExpiring} (${warranty.daysRemaining}d)`
                    : `${t.assets.warrantyActive} (${format(new Date(asset.warrantyEndDate!), "dd MMM yyyy")})`}
            </p>
          </div>
        </div>

        {/* Primary Field Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setReportOpen((p) => !p)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--warn-bg)] border border-[var(--warn-stroke)] text-[var(--warn)] text-xs font-semibold cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{t.assets.reportIssue}</span>
          </button>

          {pendingSchedules.length > 0 && (
            <button
              type="button"
              onClick={() => setExecutingSchedule(pendingSchedules[0])}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{t.assets.executeNow}</span>
            </button>
          )}
        </div>
      </section>

      {/* Report Asset Issue Form */}
      {reportOpen && (
        <form
          onSubmit={handleReportSubmit}
          className="bg-[var(--bg-surface)] border border-[var(--brand-stroke)] rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-[var(--text-ink)]">
              {t.assets.reportIssue}
            </h3>
            <button type="button" onClick={() => setReportOpen(false)} className="cursor-pointer">
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>
          <input
            type="text"
            required
            value={issueTitle}
            onChange={(e) => setIssueTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)]"
          />
          <ThemedSelect
            value={issuePriority}
            onChange={setIssuePriority}
            options={[
              { value: "Low", label: "Low" },
              { value: "Normal", label: "Normal" },
              { value: "High", label: "High" },
              { value: "Urgent", label: "Urgent" },
            ]}
            className="w-full sm:w-44"
          />
          <textarea
            rows={2}
            value={issueDetail}
            onChange={(e) => setIssueDetail(e.target.value)}
            placeholder="Describe the hardware/software issue observed..."
            className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)]"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={reporting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {reporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Submit Support Request</span>
            </button>
          </div>
        </form>
      )}

      {/* Inline Checklist Execution Panel */}
      {executingSchedule && (
        <section className="bg-[var(--bg-surface)] border border-[var(--brand-stroke)] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-sm text-[var(--text-ink)]">
              {executingSchedule.template?.templateName || "Maintenance Checklist"}
            </h3>
            <button
              type="button"
              onClick={() => setExecutingSchedule(null)}
              className="cursor-pointer"
            >
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>
          <ExecuteMaintenancePanel
            schedule={executingSchedule}
            onNotify={showToast}
            onCancel={() => setExecutingSchedule(null)}
            onSubmitted={() => {
              setExecutingSchedule(null);
              router.refresh();
            }}
          />
        </section>
      )}

      {/* Pending Maintenance Schedules */}
      <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[var(--brand)]" />
          <h2 className="font-heading font-bold text-sm text-[var(--text-ink)]">
            {t.assets.schedulesTab} ({pendingSchedules.length})
          </h2>
        </div>

        {pendingSchedules.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] py-2">{t.assets.noPendingSchedules}</p>
        ) : (
          <div className="space-y-2">
            {pendingSchedules.map((sch) => {
              const urg = computeScheduleUrgency(sch.status, sch.nextDueDate, nowMs);
              return (
                <div
                  key={sch.id}
                  className="flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-ink)]">
                      {sch.template?.templateName || "Ad-hoc Maintenance"}
                    </p>
                    <p className="font-mono-code text-[10.5px] text-[var(--text-muted)] tnum">
                      Due: {format(new Date(sch.nextDueDate), "dd MMM yyyy")} · {urg.state}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExecutingSchedule(sch)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>{t.assets.executeNow}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Support Tickets & Maintenance Logs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-[var(--warn)]" />
            <h2 className="font-heading font-bold text-sm text-[var(--text-ink)]">
              Support Tickets ({asset.supportTickets?.length || 0})
            </h2>
          </div>
          {!asset.supportTickets || asset.supportTickets.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No linked support tickets.</p>
          ) : (
            <div className="space-y-1.5">
              {asset.supportTickets.map((tk) => (
                <Link
                  key={tk.id}
                  href={`/support?ticket=${tk.id}`}
                  className="flex items-center justify-between gap-2 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs"
                >
                  <span className="truncate font-medium text-[var(--text-ink)]">
                    <span className="font-mono-code font-bold text-[var(--brand)] mr-1.5">
                      {tk.ticketNumber || tk.id.slice(0, 8)}
                    </span>
                    {tk.taskName}
                  </span>
                  <ExternalLink className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--ok)]" />
            <h2 className="font-heading font-bold text-sm text-[var(--text-ink)]">
              Inspection & Custody ({logs.length} logs)
            </h2>
          </div>
          {logs.length === 0 && (!asset.custodyLogs || asset.custodyLogs.length === 0) ? (
            <p className="text-xs text-[var(--text-muted)]">No inspection or custody logs yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs space-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--ok)]">
                      <CheckCircle2 className="w-3 h-3" /> {l.overallCondition}
                    </span>
                    <span className="font-mono-code text-[10px] text-[var(--text-muted)] tnum">
                      {format(new Date(l.executionDate), "dd MMM yyyy")}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-ink2)]">
                    By {l.executedBy?.name || "IT Staff"}
                    {l.findings ? ` · ${l.findings}` : ""}
                  </p>
                </div>
              ))}
              {(asset.custodyLogs || []).slice(0, 5).map((cl) => (
                <div
                  key={cl.id}
                  className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-ink2)]"
                >
                  <span className="font-mono-code text-[10px] text-[var(--text-muted)] mr-1.5">
                    {format(new Date(cl.changedAt), "dd MMM")}
                  </span>
                  <span>{cl.previousPerson || "—"}</span>
                  <ArrowRight className="inline w-3 h-3 mx-1 text-[var(--brand)]" />
                  <span className="font-semibold text-[var(--text-ink)]">
                    {cl.newPerson || "Unassigned"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
