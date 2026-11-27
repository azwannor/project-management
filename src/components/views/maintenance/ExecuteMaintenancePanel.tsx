"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  Paperclip,
  Save,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/i18n";
import type { MaintenanceScheduleItem } from "./types";

interface ChecklistEntry {
  itemText: string;
  checked: boolean;
  note: string;
}

interface ExecuteMaintenancePanelProps {
  schedule: MaintenanceScheduleItem;
  onSubmitted: (result?: { createdTicketNumber?: string | null }) => Promise<void> | void;
  onCancel?: () => void;
  onNotify: (kind: "ok" | "err", text: string) => void;
}

export default function ExecuteMaintenancePanel({
  schedule,
  onSubmitted,
  onCancel,
  onNotify,
}: ExecuteMaintenancePanelProps) {
  const { t } = useI18n();

  const [items, setItems] = useState<ChecklistEntry[]>(() => {
    const master = schedule.template?.checklistItems || [];
    if (master.length > 0) {
      return master.map((m) => ({ itemText: m.itemText, checked: false, note: "" }));
    }
    return [
      { itemText: "Visual & physical hardware condition check", checked: false, note: "" },
      { itemText: "Functional verification & system check", checked: false, note: "" },
    ];
  });

  const [overallCondition, setOverallCondition] = useState<
    "BAIK" | "PERLU_PERHATIAN" | "BERMASALAH"
  >("BAIK");
  const [findings, setFindings] = useState("");
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [createFollowUpTicket, setCreateFollowUpTicket] = useState(true);
  const [attachment, setAttachment] = useState("");
  const [attachmentKey, setAttachmentKey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "maintenance");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/maintenance-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: schedule.id,
          checklistResults: items.map((it) => ({
            itemText: it.itemText,
            checked: it.checked,
            note: it.note.trim() || null,
          })),
          overallCondition,
          findings: findings.trim() || null,
          followUpNeeded,
          createFollowUpTicket: followUpNeeded && createFollowUpTicket,
          attachment: attachment || null,
          attachmentKey: attachmentKey || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit maintenance log");
        return;
      }

      const createdTicketNum = data?.followUp?.createdTicket?.ticketNumber || null;
      onNotify(
        "ok",
        createdTicketNum
          ? `Maintenance logged & Support Ticket ${createdTicketNum} created`
          : "Maintenance inspection submitted"
      );
      await onSubmitted({ createdTicketNumber: createdTicketNum });
    } catch {
      setError("Network error while submitting log");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-xs font-semibold text-[var(--err)] bg-[var(--err-bg)] border border-[var(--err-stroke)] rounded-xl px-3.5 py-2.5">
          {error}
        </div>
      )}

      {/* Checklist Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1">
              <ClipboardCheck className="w-3.5 h-3.5 text-[var(--brand)]" />
              Checklist ({items.filter((i) => i.checked).length}/{items.length})
            </span>
          </span>
          <button
            type="button"
            onClick={() => setItems((prev) => prev.map((it) => ({ ...it, checked: true })))}
            className="text-[11px] font-semibold text-[var(--brand)] hover:underline cursor-pointer"
          >
            Mark All Passed
          </button>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={`${idx}-${item.itemText}`}
              className={`border rounded-xl p-3 space-y-2 transition-colors ${
                item.checked
                  ? "bg-[var(--ok-bg)]/40 border-[var(--ok-stroke)]"
                  : "bg-[var(--bg-canvas)] border-[var(--border-subtle)]"
              }`}
            >
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setItems((prev) =>
                      prev.map((row, rIdx) => (rIdx === idx ? { ...row, checked: next } : row))
                    );
                  }}
                  className="mt-0.5 w-4 h-4 rounded accent-[var(--brand)] cursor-pointer"
                />
                <span className="text-xs font-semibold text-[var(--text-ink)] flex-1">
                  {item.itemText}
                </span>
              </label>
              <input
                type="text"
                value={item.note}
                onChange={(e) => {
                  const val = e.target.value;
                  setItems((prev) =>
                    prev.map((row, rIdx) => (rIdx === idx ? { ...row, note: val } : row))
                  );
                }}
                placeholder="Optional check note..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Overall Condition */}
      <div>
        <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
          {t.assets.overallCondition}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              {
                id: "BAIK",
                label: t.assets.conditionGood,
                icon: CheckCircle2,
                activeCls: "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]",
              },
              {
                id: "PERLU_PERHATIAN",
                label: t.assets.conditionAttention,
                icon: AlertTriangle,
                activeCls: "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]",
              },
              {
                id: "BERMASALAH",
                label: t.assets.conditionProblem,
                icon: XCircle,
                activeCls: "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]",
              },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = overallCondition === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setOverallCondition(opt.id);
                  if (opt.id === "BERMASALAH") setFollowUpNeeded(true);
                }}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                  active
                    ? opt.activeCls
                    : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-ink2)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-full">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Findings */}
      <div>
        <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
          {t.assets.findingsLabel}
        </label>
        <textarea
          rows={3}
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          placeholder="Summary of temperature, cleanliness, disk health, or defects..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
        />
      </div>

      {/* Attachment */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-strong)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] cursor-pointer">
          <Paperclip className="w-3.5 h-3.5" />
          <span>{uploading ? "Uploading..." : t.projects.uploadFile}</span>
          <input
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            accept="image/*,.pdf,.xlsx,.csv"
            className="hidden"
          />
        </label>
        {attachment && (
          <a
            href={attachment}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline truncate max-w-[200px]"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{attachment.split("/").pop()}</span>
          </a>
        )}
      </div>

      {/* Follow-up Ticket Option */}
      <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-2">
        <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-ink)] cursor-pointer">
          <input
            type="checkbox"
            checked={followUpNeeded}
            onChange={(e) => setFollowUpNeeded(e.target.checked)}
            className="w-4 h-4 accent-[var(--brand)]"
          />
          <span>{t.assets.followUpNeeded}</span>
        </label>

        {followUpNeeded && (
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--brand)] cursor-pointer pl-6">
            <input
              type="checkbox"
              checked={createFollowUpTicket}
              onChange={(e) => setCreateFollowUpTicket(e.target.checked)}
              className="w-4 h-4 accent-[var(--brand)]"
            />
            <span>{t.assets.createTicketAuto}</span>
          </label>
        )}
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
          >
            {t.common.cancel}
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{t.assets.submitLog}</span>
        </button>
      </div>
    </form>
  );
}
