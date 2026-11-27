"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  FileSpreadsheet,
  Loader2,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import { ThemedDatePicker } from "@/components/ui/ThemedDatePicker";
import type {
  AssetTypeOption,
  EnterpriseAssetItem,
  MaintUserOption,
  MaintenanceScheduleItem,
  MaintenanceTemplateItem,
} from "./types";

/* ═══════════════════════════════════════════════════════════════
   1. EXCEL BULK ASSET IMPORT MODAL
   ═══════════════════════════════════════════════════════════════ */
export function ExcelImportModal({
  isOpen,
  onClose,
  onImported,
  onNotify,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
  onNotify: (kind: "ok" | "err", text: string) => void;
}) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    successCount: number;
    failedCount: number;
    errors: Array<{ row: number; assetCode: string; reason: string }>;
  } | null>(null);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/assets/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }
      setResult({
        successCount: data.successCount || 0,
        failedCount: data.failedCount || 0,
        errors: Array.isArray(data.errors) ? data.errors : [],
      });
      if ((data.successCount || 0) > 0) {
        onNotify("ok", `Imported ${data.successCount} asset(s)`);
        await onImported();
      }
    } catch {
      setError("Failed to upload Excel file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[var(--brand)]" />
            <h3 className="font-heading font-bold text-base text-[var(--text-ink)]">
              {t.assets.importExcel}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer p-1">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-5 overflow-y-auto space-y-4">
          <p className="text-xs text-[var(--text-ink2)]">
            Required columns:{" "}
            <span className="font-mono-code font-bold text-[var(--text-ink)]">
              Asset Code, Asset Name, Asset Type, Area
            </span>{" "}
            (optional: Serial Number, Purchase Date).
          </p>

          <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-[var(--border-strong)] hover:border-[var(--brand)] rounded-2xl bg-[var(--bg-canvas)] cursor-pointer text-center">
            <UploadCloud className="w-7 h-7 text-[var(--brand)]" />
            <span className="text-xs font-semibold text-[var(--text-ink)]">
              {file ? file.name : "Choose .xlsx / .xls file"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>

          {error && (
            <div className="text-xs font-semibold text-[var(--err)] bg-[var(--err-bg)] border border-[var(--err-stroke)] rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-2 text-xs">
              <p className="font-semibold text-[var(--text-ink)]">
                Imported: <span className="text-[var(--ok)]">{result.successCount}</span> · Failed:{" "}
                <span className="text-[var(--err)]">{result.failedCount}</span>
              </p>
              {result.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-[var(--err)]">
                  {result.errors.slice(0, 15).map((err, i) => (
                    <p key={i}>
                      Row {err.row} ({err.assetCode}): {err.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={!file || busy}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Upload & Import</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2. MAINTENANCE SCHEDULE CREATE / EDIT MODAL
   ═══════════════════════════════════════════════════════════════ */
export function ScheduleFormModal(props: {
  isOpen: boolean;
  schedule: MaintenanceScheduleItem | null;
  assets: EnterpriseAssetItem[];
  templates: MaintenanceTemplateItem[];
  users: MaintUserOption[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onNotify: (kind: "ok" | "err", text: string) => void;
}) {
  if (!props.isOpen) return null;
  const key = props.schedule ? props.schedule.id : "new-schedule";
  return <ScheduleFormModalInner key={key} {...props} />;
}

function ScheduleFormModalInner({
  schedule,
  assets,
  templates,
  users,
  isAdmin,
  onClose,
  onSaved,
  onNotify,
}: {
  isOpen: boolean;
  schedule: MaintenanceScheduleItem | null;
  assets: EnterpriseAssetItem[];
  templates: MaintenanceTemplateItem[];
  users: MaintUserOption[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onNotify: (kind: "ok" | "err", text: string) => void;
}) {
  const { locale, t } = useI18n();
  const activeAssets = assets.filter((a) => a.status !== "RETIRED");

  const [scheduleType, setScheduleType] = useState<"RECURRING" | "ADHOC">(() =>
    schedule ? (schedule.scheduleType === "ADHOC" ? "ADHOC" : "RECURRING") : isAdmin ? "RECURRING" : "ADHOC"
  );
  const [assetId, setAssetId] = useState(() => schedule?.assetId || activeAssets[0]?.id || "");
  const [templateId, setTemplateId] = useState(
    () => schedule?.templateId || templates[0]?.id || ""
  );
  const [frequencyDays, setFrequencyDays] = useState(() =>
    schedule?.frequencyDays
      ? String(schedule.frequencyDays)
      : String(templates[0]?.defaultFrequencyDays || 30)
  );
  const [nextDueDate, setNextDueDate] = useState(() =>
    schedule?.nextDueDate
      ? format(new Date(schedule.nextDueDate), "yyyy-MM-dd")
      : format(new Date(Date.now() + 7 * 86_400_000), "yyyy-MM-dd")
  );
  const [executorIds, setExecutorIds] = useState<string[]>(() =>
    schedule ? schedule.assignedExecutors.map((e) => e.id) : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAssetChange = (nextId: string) => {
    setAssetId(nextId);
    const chosenAsset = activeAssets.find((a) => a.id === nextId);
    if (chosenAsset) {
      const matchingTpl = templates.find((tpl) => tpl.assetTypeId === chosenAsset.assetTypeId);
      if (matchingTpl) {
        setTemplateId(matchingTpl.id);
        setFrequencyDays(String(matchingTpl.defaultFrequencyDays));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId || !nextDueDate || saving) return;
    setSaving(true);
    setError("");

    const payload = {
      scheduleType,
      assetId,
      templateId: scheduleType === "RECURRING" ? templateId : templateId || null,
      frequencyDays:
        scheduleType === "RECURRING" && frequencyDays ? Number(frequencyDays) : null,
      nextDueDate: `${nextDueDate}T09:00:00.000Z`,
      executorIds,
    };

    try {
      const res = await fetch(
        schedule ? `/api/maintenance-schedules/${schedule.id}` : "/api/maintenance-schedules",
        {
          method: schedule ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save schedule");
        return;
      }
      onNotify("ok", schedule ? "Schedule updated" : "Schedule created");
      await onSaved();
      onClose();
    } catch {
      setError("Network error while saving schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="font-heading font-bold text-base text-[var(--text-ink)]">
            {schedule ? "Edit Schedule" : t.assets.newSchedule}
          </h3>
          <button type="button" onClick={onClose} className="cursor-pointer p-1">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="text-xs font-semibold text-[var(--err)] bg-[var(--err-bg)] border border-[var(--err-stroke)] rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {!schedule && isAdmin && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
              {(["RECURRING", "ADHOC"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setScheduleType(type)}
                  className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    scheduleType === type
                      ? "bg-[var(--bg-surface)] text-[var(--brand)] border border-[var(--brand-stroke)] shadow-2xs"
                      : "text-[var(--text-ink2)]"
                  }`}
                >
                  {type === "RECURRING" ? "Recurring Routine" : "Ad-Hoc Inspection"}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Target Asset
            </label>
            <ThemedSelect
              value={assetId}
              onChange={handleAssetChange}
              options={activeAssets.map((a) => ({
                value: a.id,
                label: `${a.assetCode} · ${a.assetName}`,
                badge: a.location || undefined,
              }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Checklist Template
            </label>
            <ThemedSelect
              value={templateId}
              onChange={(val) => {
                setTemplateId(val);
                const found = templates.find((tpl) => tpl.id === val);
                if (found) setFrequencyDays(String(found.defaultFrequencyDays));
              }}
              options={[
                ...(scheduleType === "ADHOC" ? [{ value: "", label: "— Default Ad-Hoc —" }] : []),
                ...templates.map((tpl) => ({
                  value: tpl.id,
                  label: tpl.templateName,
                  badge: `${tpl.defaultFrequencyDays}d`,
                })),
              ]}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Next Due Date
              </label>
              <ThemedDatePicker
                value={nextDueDate}
                onChange={setNextDueDate}
                locale={locale}
                allowClear={false}
              />
            </div>

            {scheduleType === "RECURRING" && (
              <div>
                <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Interval (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={730}
                  value={frequencyDays}
                  onChange={(e) => setFrequencyDays(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] font-mono-code text-xs text-[var(--text-ink)] tnum"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              Executors (leave empty to auto-assign by asset area)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {users.map((u) => {
                const selected = executorIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      setExecutorIds((prev) =>
                        prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                      )
                    }
                    className={`px-2.5 py-1 rounded-full border text-xs font-semibold cursor-pointer ${
                      selected
                        ? "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]"
                        : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-ink2)]"
                    }`}
                  >
                    {u.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving || !assetId || !nextDueDate}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
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

/* ═══════════════════════════════════════════════════════════════
   3. CHECKLIST TEMPLATE BUILDER MODAL
   ═══════════════════════════════════════════════════════════════ */
export function TemplateFormModal(props: {
  isOpen: boolean;
  template: MaintenanceTemplateItem | null;
  assetTypes: AssetTypeOption[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onNotify: (kind: "ok" | "err", text: string) => void;
}) {
  if (!props.isOpen) return null;
  const key = props.template ? props.template.id : "new-template";
  return <TemplateFormModalInner key={key} {...props} />;
}

function TemplateFormModalInner({
  template,
  assetTypes,
  onClose,
  onSaved,
  onNotify,
}: {
  isOpen: boolean;
  template: MaintenanceTemplateItem | null;
  assetTypes: AssetTypeOption[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onNotify: (kind: "ok" | "err", text: string) => void;
}) {
  const { t } = useI18n();

  const [templateName, setTemplateName] = useState(() => template?.templateName || "");
  const [assetTypeId, setAssetTypeId] = useState(
    () => template?.assetTypeId || assetTypes[0]?.id || ""
  );
  const [defaultFrequencyDays, setDefaultFrequencyDays] = useState(() =>
    String(template?.defaultFrequencyDays || 30)
  );
  const [reminderOffsetDays, setReminderOffsetDays] = useState(() =>
    String(template?.reminderOffsetDays || 3)
  );
  const [items, setItems] = useState<
    Array<{ id?: string; itemText: string; isRequired: boolean }>
  >(() =>
    template?.checklistItems && template.checklistItems.length > 0
      ? template.checklistItems.map((it) => ({
          id: it.id,
          itemText: it.itemText,
          isRequired: it.isRequired,
        }))
      : [{ itemText: "", isRequired: true }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !assetTypeId || saving) return;
    setSaving(true);
    setError("");

    const cleanItems = items
      .filter((it) => it.itemText.trim().length > 0)
      .map((it, idx) => ({
        ...(it.id ? { id: it.id } : {}),
        itemText: it.itemText.trim(),
        order: idx + 1,
        isRequired: it.isRequired,
      }));

    try {
      const res = await fetch(
        template ? `/api/maintenance-templates/${template.id}` : "/api/maintenance-templates",
        {
          method: template ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateName: templateName.trim(),
            assetTypeId,
            defaultFrequencyDays: Number(defaultFrequencyDays) || 30,
            reminderOffsetDays: Number(reminderOffsetDays) || 3,
            checklistItems: cleanItems,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save template");
        return;
      }
      onNotify("ok", template ? "Template updated" : "Template created");
      await onSaved();
      onClose();
    } catch {
      setError("Network error while saving template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="font-heading font-bold text-base text-[var(--text-ink)]">
            {template ? "Edit Checklist Template" : t.assets.newTemplate}
          </h3>
          <button type="button" onClick={onClose} className="cursor-pointer p-1">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="text-xs font-semibold text-[var(--err)] bg-[var(--err-bg)] border border-[var(--err-stroke)] rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Template Name
            </label>
            <input
              type="text"
              required
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Monthly Server Room Inspection"
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Asset Type
              </label>
              <ThemedSelect
                value={assetTypeId}
                onChange={setAssetTypeId}
                options={assetTypes.map((at) => ({ value: at.id, label: at.name }))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Frequency (Days)
              </label>
              <input
                type="number"
                min={1}
                value={defaultFrequencyDays}
                onChange={(e) => setDefaultFrequencyDays(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] font-mono-code text-xs text-[var(--text-ink)] tnum"
              />
            </div>

            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Remind Offset (D)
              </label>
              <input
                type="number"
                min={0}
                value={reminderOffsetDays}
                onChange={(e) => setReminderOffsetDays(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] font-mono-code text-xs text-[var(--text-ink)] tnum"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Checklist Items
              </span>
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, { itemText: "", isRequired: true }])}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="font-mono-code text-[10px] text-[var(--text-muted)] w-5 text-right tnum">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={item.itemText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItems((prev) =>
                        prev.map((row, rIdx) => (rIdx === idx ? { ...row, itemText: val } : row))
                      );
                    }}
                    placeholder="Inspection step..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)]"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, rIdx) => rIdx !== idx))}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--err)] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving || !templateName.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
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
