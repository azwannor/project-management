"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Copy,
  Check,
  Send,
  RefreshCw,
  HardDrive,
  Clock,
  ChevronDown,
  ChevronRight,
  Save,
} from "lucide-react";
import { useI18n } from "@/i18n";
import type {
  IntegrationDiagnostics,
  MaskedExternalKey,
  MasterAssetType,
  MasterDivision,
  MasterLocation,
  MasterRegionalArea,
  MasterSlaPolicy,
  MasterSupportModule,
} from "./types";

interface MasterAndApiTabProps {
  divisions: MasterDivision[];
  locations: MasterLocation[];
  assetTypes: MasterAssetType[];
  regionalAreas: MasterRegionalArea[];
  supportModules: MasterSupportModule[];
  slaPolicies: MasterSlaPolicy[];
  externalKeys: MaskedExternalKey[];
  onDivisionsChange: (next: MasterDivision[]) => void;
  onLocationsChange: (next: MasterLocation[]) => void;
  onAssetTypesChange: (next: MasterAssetType[]) => void;
  onAreasChange: (next: MasterRegionalArea[]) => void;
  onModulesChange: (next: MasterSupportModule[]) => void;
  onSlaChange: (next: MasterSlaPolicy[]) => void;
  onKeysChange: (next: MaskedExternalKey[]) => void;
}

type MasterSubTab = "divisions" | "locations" | "assetTypes" | "areas" | "supportSla";

export default function MasterAndApiTab(props: MasterAndApiTabProps) {
  const { t } = useI18n();
  const [subTab, setSubTab] = useState<MasterSubTab>("divisions");
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Simple Master Form State (Divisions / Locations / AssetTypes / Areas)
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemAddress, setItemAddress] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [submittingMaster, setSubmittingMaster] = useState(false);

  // Support Module & Category Form State
  const [newModName, setNewModName] = useState("");
  const [newModGroup, setNewModGroup] = useState("IT Systems");
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatReqArea, setNewCatReqArea] = useState(false);

  // SLA Drafts
  const [slaDrafts, setSlaDrafts] = useState<Record<string, MasterSlaPolicy>>(() =>
    Object.fromEntries(props.slaPolicies.map((p) => [p.id, { ...p }]))
  );
  const [savingSlaId, setSavingSlaId] = useState<string | null>(null);

  // Integrations Diagnostics
  const [diag, setDiag] = useState<IntegrationDiagnostics | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(true);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // External API Key Modal / Creator
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keySourceApp, setKeySourceApp] = useState("");
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/integrations")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: IntegrationDiagnostics | null) => {
        if (active && data) {
          setDiag(data);
          setWebhookUrlInput(data.telegram.webhookUrl || data.telegram.suggestedWebhookUrl);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingDiag(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const resetSimpleForm = () => {
    setItemName("");
    setItemCode("");
    setItemAddress("");
    setEditingItemId(null);
  };

  const handleSaveSimpleMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    setSubmittingMaster(true);
    setBanner(null);

    try {
      const endpointMap: Record<Exclude<MasterSubTab, "supportSla">, string> = {
        divisions: "/api/divisions",
        locations: "/api/locations",
        assetTypes: "/api/asset-types",
        areas: "/api/regional-areas",
      };
      const base = endpointMap[subTab as Exclude<MasterSubTab, "supportSla">];
      const url = editingItemId ? `${base}/${editingItemId}` : base;
      const method = editingItemId ? "PATCH" : "POST";

      const payload: Record<string, unknown> = { name: itemName.trim() };
      if (subTab !== "areas") payload.code = itemCode.trim() || null;
      if (subTab === "locations") payload.address = itemAddress.trim() || null;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      const sortByName = <T extends { name: string }>(arr: T[]) =>
        [...arr].sort((a, b) => a.name.localeCompare(b.name));

      if (subTab === "divisions") {
        props.onDivisionsChange(
          editingItemId
            ? sortByName(props.divisions.map((x) => (x.id === editingItemId ? data : x)))
            : sortByName([...props.divisions, data])
        );
      } else if (subTab === "locations") {
        props.onLocationsChange(
          editingItemId
            ? sortByName(props.locations.map((x) => (x.id === editingItemId ? data : x)))
            : sortByName([...props.locations, data])
        );
      } else if (subTab === "assetTypes") {
        props.onAssetTypesChange(
          editingItemId
            ? sortByName(props.assetTypes.map((x) => (x.id === editingItemId ? data : x)))
            : sortByName([...props.assetTypes, data])
        );
      } else if (subTab === "areas") {
        props.onAreasChange(
          editingItemId
            ? sortByName(props.regionalAreas.map((x) => (x.id === editingItemId ? data : x)))
            : sortByName([...props.regionalAreas, data])
        );
      }

      setBanner({ type: "success", text: `${editingItemId ? "Updated" : "Added"}: ${data.name}` });
      resetSimpleForm();
    } catch (err) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSubmittingMaster(false);
    }
  };

  const handleDeleteSimpleMaster = async (tab: Exclude<MasterSubTab, "supportSla">, id: string, name: string) => {
    setBanner(null);
    const endpointMap: Record<Exclude<MasterSubTab, "supportSla">, string> = {
      divisions: `/api/divisions/${id}`,
      locations: `/api/locations/${id}`,
      assetTypes: `/api/asset-types/${id}`,
      areas: `/api/regional-areas/${id}`,
    };
    try {
      const res = await fetch(endpointMap[tab], { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (tab === "divisions") props.onDivisionsChange(props.divisions.filter((x) => x.id !== id));
      if (tab === "locations") props.onLocationsChange(props.locations.filter((x) => x.id !== id));
      if (tab === "assetTypes") props.onAssetTypesChange(props.assetTypes.filter((x) => x.id !== id));
      if (tab === "areas") props.onAreasChange(props.regionalAreas.filter((x) => x.id !== id));
      if (editingItemId === id) resetSimpleForm();
      setBanner({ type: "success", text: `Deleted ${name}` });
    } catch (err) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Delete failed" });
    }
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModName.trim()) return;
    setBanner(null);
    try {
      const res = await fetch("/api/support-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newModName.trim(), groupName: newModGroup.trim() || "General" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add module");
      props.onModulesChange([...props.supportModules, data]);
      setNewModName("");
      setBanner({ type: "success", text: `Added module ${data.name}` });
    } catch (err) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    }
  };

  const handleCreateCategory = async (moduleId: string) => {
    if (!newCatName.trim()) return;
    setBanner(null);
    try {
      const res = await fetch("/api/support-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, name: newCatName.trim(), requiresArea: newCatReqArea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add category");
      props.onModulesChange(
        props.supportModules.map((m) =>
          m.id === moduleId ? { ...m, categories: [...m.categories, data] } : m
        )
      );
      setNewCatName("");
      setNewCatReqArea(false);
    } catch (err) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    }
  };

  const handleDeleteCategory = async (moduleId: string, catId: string) => {
    try {
      const res = await fetch(`/api/support-categories/${catId}`, { method: "DELETE" });
      if (!res.ok) return;
      props.onModulesChange(
        props.supportModules.map((m) =>
          m.id === moduleId ? { ...m, categories: m.categories.filter((c) => c.id !== catId) } : m
        )
      );
    } catch {
      // Ignore
    }
  };

  const handleSaveSla = async (policyId: string) => {
    const draft = slaDrafts[policyId];
    if (!draft) return;
    setSavingSlaId(policyId);
    setBanner(null);
    try {
      const res = await fetch("/api/sla-policies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update SLA");
      props.onSlaChange(props.slaPolicies.map((p) => (p.id === policyId ? data : p)));
      setSlaDrafts((prev) => ({ ...prev, [policyId]: data }));
      setBanner({ type: "success", text: `Updated SLA policy: ${data.priority}` });
    } catch (err) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Failed to update SLA" });
    } finally {
      setSavingSlaId(null);
    }
  };

  const runIntegrationAction = async (action: "test-telegram" | "run-cron-reminders" | "run-cron-maintenance") => {
    setBusyAction(action);
    setBanner(null);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Integration check failed");
      setBanner({
        type: "success",
        text: data.message || `Executed ${action}: ${JSON.stringify(data.summary || data.counts || data)}`,
      });
    } catch (err) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSyncWebhook = async () => {
    setBusyAction("sync-webhook");
    setBanner(null);
    try {
      const res = await fetch("/api/telegram/set-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrlInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.description || "Webhook sync failed");
      setBanner({ type: "success", text: `Webhook synced: ${webhookUrlInput}` });
    } catch (err) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Webhook sync failed" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim() || !keySourceApp.trim()) return;
    setBusyAction("create-key");
    setBanner(null);
    try {
      const res = await fetch("/api/external-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim(), sourceApp: keySourceApp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create API key");
      const { rawKey, ...masked } = data;
      props.onKeysChange([masked, ...props.externalKeys]);
      setNewlyGeneratedKey(rawKey);
      setCopiedKey(false);
      setKeyName("");
      setKeySourceApp("");
      setShowKeyForm(false);
    } catch (err) {
      setBanner({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleKey = async (key: MaskedExternalKey) => {
    try {
      const res = await fetch(`/api/external-keys/${key.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !key.isActive }),
      });
      const data = await res.json();
      if (!res.ok) return;
      props.onKeysChange(props.externalKeys.map((k) => (k.id === key.id ? data : k)));
    } catch {
      // Ignore
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      const res = await fetch(`/api/external-keys/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      props.onKeysChange(props.externalKeys.filter((k) => k.id !== id));
    } catch {
      // Ignore
    }
  };

  const inputClass =
    "w-full h-9 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl px-3 text-xs text-[var(--text-ink)] placeholder:text-[var(--text-muted)] outline-none focus:bg-[var(--bg-surface)] focus:border-[var(--brand)] transition-colors";

  const simpleRows: Array<{ id: string; name: string; sub: string; locked?: boolean }> =
    subTab === "divisions"
      ? props.divisions.map((d) => ({
          id: d.id,
          name: d.name,
          sub: `${d.code ? `${d.code} · ` : ""}${d._count?.assets ?? 0} assets`,
          locked: (d._count?.assets ?? 0) > 0,
        }))
      : subTab === "locations"
        ? props.locations.map((l) => ({
            id: l.id,
            name: l.name,
            sub: `${l.code ? `${l.code} · ` : ""}${l.address ? `${l.address} · ` : ""}${l._count?.assets ?? 0} assets`,
            locked: (l._count?.assets ?? 0) > 0,
          }))
        : subTab === "assetTypes"
          ? props.assetTypes.map((at) => ({
              id: at.id,
              name: at.name,
              sub: `${at.code ? `${at.code} · ` : ""}${at._count?.assets ?? 0} assets · ${at._count?.templates ?? 0} templates`,
              locked: (at._count?.assets ?? 0) > 0 || (at._count?.templates ?? 0) > 0,
            }))
          : props.regionalAreas.map((ra) => ({
              id: ra.id,
              name: ra.name,
              sub: ra.isActive ? "Active Auto-Assign Area" : "Inactive",
            }));

  return (
    <div className="space-y-4">
      {banner && (
        <div
          className={`px-4 py-3 rounded-2xl border flex items-center gap-2 text-xs font-medium ${
            banner.type === "error"
              ? "bg-[var(--err-bg)] border-[var(--err-st)] text-[var(--err)]"
              : "bg-[var(--ok-bg)] border-[var(--ok-st)] text-[var(--ok)]"
          }`}
        >
          {banner.type === "error" ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span className="break-all">{banner.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-5 items-start">
        {/* LEFT CARD: Master Data Manager */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
            <h2 className="font-heading font-bold text-[17px] text-[var(--text-ink)]">
              {t.settings.masterDataTitle}
            </h2>
            <span className="px-2.5 py-1 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-st)] font-mono-code text-[9.5px] font-bold text-[var(--ok)]">
              {t.settings.noHardcodedBadge}
            </span>
          </div>

          {/* 5 Sub-tabs */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "divisions", label: `${t.settings.subDivisions} (${props.divisions.length})` },
                { id: "locations", label: `${t.settings.subLocations} (${props.locations.length})` },
                { id: "assetTypes", label: `${t.settings.subAssetTypes} (${props.assetTypes.length})` },
                { id: "areas", label: `${t.settings.subAreas} (${props.regionalAreas.length})` },
                { id: "supportSla", label: t.settings.subSupportSla },
              ] as const
            ).map((tab) => {
              const active = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setSubTab(tab.id);
                    resetSimpleForm();
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[var(--brand)] text-white dark:text-[#161A26]"
                      : "bg-[var(--bg-subtle)] text-[var(--text-ink2)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Simple Master CRUD (Divisions / Locations / Asset Types / Areas) */}
          {subTab !== "supportSla" && (
            <div className="space-y-3">
              <form
                onSubmit={handleSaveSimpleMaster}
                className="p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col sm:flex-row gap-2"
              >
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Name..."
                  className={`${inputClass} flex-1`}
                  required
                />
                {subTab !== "areas" && (
                  <input
                    type="text"
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    placeholder={t.settings.codeOptional}
                    className={`${inputClass} sm:w-28`}
                  />
                )}
                {subTab === "locations" && (
                  <input
                    type="text"
                    value={itemAddress}
                    onChange={(e) => setItemAddress(e.target.value)}
                    placeholder={t.settings.addressOptional}
                    className={`${inputClass} sm:w-40`}
                  />
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="submit"
                    disabled={submittingMaster}
                    className="inline-flex items-center justify-center gap-1 px-4 h-9 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold transition-colors disabled:opacity-60"
                  >
                    {submittingMaster ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : editingItemId ? (
                      <Save className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    {editingItemId ? t.common.save : t.settings.addItem.replace(/^\+\s*/, "")}
                  </button>
                  {editingItemId && (
                    <button
                      type="button"
                      onClick={resetSimpleForm}
                      className="px-3 h-9 rounded-full bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--text-ink2)]"
                    >
                      {t.common.cancel}
                    </button>
                  )}
                </div>
              </form>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {simpleRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--text-ink)] truncate">
                        {row.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate">{row.sub}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItemId(row.id);
                          setItemName(row.name);
                          if (subTab === "divisions") {
                            const found = props.divisions.find((d) => d.id === row.id);
                            setItemCode(found?.code || "");
                          } else if (subTab === "locations") {
                            const found = props.locations.find((l) => l.id === row.id);
                            setItemCode(found?.code || "");
                            setItemAddress(found?.address || "");
                          } else if (subTab === "assetTypes") {
                            const found = props.assetTypes.find((a) => a.id === row.id);
                            setItemCode(found?.code || "");
                          }
                        }}
                        className="p-1.5 rounded-lg bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)]"
                        title={t.common.edit}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(row.locked)}
                        onClick={() => handleDeleteSimpleMaster(subTab, row.id, row.name)}
                        className="p-1.5 rounded-lg bg-[var(--err-bg)] border border-[var(--err-st)] text-[var(--err)] disabled:opacity-35"
                        title={row.locked ? "Referenced by assets/templates" : t.common.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Support Modules & Categories + SLA Policies */}
          {subTab === "supportSla" && (
            <div className="space-y-5">
              {/* Support Modules */}
              <div className="space-y-2.5">
                <form
                  onSubmit={handleCreateModule}
                  className="p-3 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="text"
                    value={newModName}
                    onChange={(e) => setNewModName(e.target.value)}
                    placeholder="Module name..."
                    className={`${inputClass} flex-1`}
                    required
                  />
                  <input
                    type="text"
                    value={newModGroup}
                    onChange={(e) => setNewModGroup(e.target.value)}
                    placeholder="Group..."
                    className={`${inputClass} sm:w-36`}
                    required
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1 px-4 h-9 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Module
                  </button>
                </form>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {props.supportModules.map((mod) => {
                    const isOpen = expandedModuleId === mod.id;
                    return (
                      <div
                        key={mod.id}
                        className="rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedModuleId(isOpen ? null : mod.id)}
                          className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-[var(--bg-subtle)]/50"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {isOpen ? (
                              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-[var(--text-ink)] truncate">
                              {mod.name}
                            </span>
                            <span className="font-mono-code text-[10px] text-[var(--text-muted)] shrink-0">
                              ({mod.categories.length})
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono-code text-[9.5px] text-[var(--text-ink2)] max-w-[125px] sm:max-w-[200px] truncate shrink-0">
                            {mod.groupName}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="px-3.5 pb-3 pt-1 border-t border-[var(--border-subtle)] space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              {mod.categories.map((cat) => (
                                <span
                                  key={cat.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-ink)]"
                                >
                                  <span>{cat.name}</span>
                                  {cat.requiresArea && (
                                    <span className="font-mono-code text-[9px] text-[var(--brand)] font-bold">
                                      AREA
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(mod.id, cat.id)}
                                    className="text-[var(--err)] hover:opacity-75"
                                    title="Remove category"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <input
                                type="text"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                placeholder="New category..."
                                className={`${inputClass} flex-1 min-w-[140px]`}
                              />
                              <button
                                type="button"
                                onClick={() => setNewCatReqArea(!newCatReqArea)}
                                className={`px-2.5 h-9 rounded-xl border text-[10px] font-mono-code font-bold ${
                                  newCatReqArea
                                    ? "bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]"
                                    : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)]"
                                }`}
                              >
                                requiresArea: {newCatReqArea ? "ON" : "OFF"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCreateCategory(mod.id)}
                                className="px-3 h-9 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold"
                              >
                                + Cat
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SLA Policies */}
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
                <div className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t.settings.slaPoliciesTitle}
                </div>
                <div className="space-y-2">
                  {props.slaPolicies.map((pol) => {
                    const draft = slaDrafts[pol.id] || pol;
                    const badgeStyle =
                      pol.priority === "Urgent"
                        ? "bg-[var(--err-bg)] border-[var(--err-st)] text-[var(--err)]"
                        : pol.priority === "High"
                          ? "bg-[var(--warn-bg)] border-[var(--warn-st)] text-[var(--warn)]"
                          : pol.priority === "Normal"
                            ? "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]"
                            : "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-ink2)]";
                    return (
                      <div
                        key={pol.id}
                        className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-[90px_1fr_1fr_1fr_auto] gap-2 items-end"
                      >
                        <div className="pb-1">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full border font-mono-code text-[10px] font-bold uppercase ${badgeStyle}`}
                          >
                            {pol.priority}
                          </span>
                        </div>
                        <div>
                          <label className="block font-mono-code text-[9px] text-[var(--text-muted)] mb-1">
                            {t.settings.firstResponseMin}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={draft.firstResponseMinutes}
                            onChange={(e) =>
                              setSlaDrafts((prev) => ({
                                ...prev,
                                [pol.id]: { ...draft, firstResponseMinutes: Number(e.target.value) },
                              }))
                            }
                            className={`${inputClass} h-8 font-mono-code`}
                          />
                        </div>
                        <div>
                          <label className="block font-mono-code text-[9px] text-[var(--text-muted)] mb-1">
                            {t.settings.targetMinutes}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={draft.targetMinutes}
                            onChange={(e) =>
                              setSlaDrafts((prev) => ({
                                ...prev,
                                [pol.id]: { ...draft, targetMinutes: Number(e.target.value) },
                              }))
                            }
                            className={`${inputClass} h-8 font-mono-code`}
                          />
                        </div>
                        <div>
                          <label className="block font-mono-code text-[9px] text-[var(--text-muted)] mb-1">
                            {t.settings.reminderPercent}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={draft.reminderThresholdPercent}
                            onChange={(e) =>
                              setSlaDrafts((prev) => ({
                                ...prev,
                                [pol.id]: { ...draft, reminderThresholdPercent: Number(e.target.value) },
                              }))
                            }
                            className={`${inputClass} h-8 font-mono-code`}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={savingSlaId === pol.id}
                          onClick={() => handleSaveSla(pol.id)}
                          className="h-8 px-3 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-[11px] font-semibold disabled:opacity-60"
                        >
                          {savingSlaId === pol.id ? "..." : t.settings.updateSla}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Integrations, Cron, Storage & External API Keys */}
        <div className="space-y-4 min-w-0">
          {/* Telegram Bot & Webhook Engine */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[22px] p-5 shadow-xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-heading font-bold text-[15px] text-[var(--text-ink)]">
                {t.settings.telegramEngineTitle}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full border font-mono-code text-[9.5px] font-bold ${
                  diag?.telegram.tokenConfigured
                    ? "bg-[var(--ok-bg)] border-[var(--ok-st)] text-[var(--ok)]"
                    : "bg-[var(--warn-bg)] border-[var(--warn-st)] text-[var(--warn)]"
                }`}
              >
                {loadingDiag
                  ? "CHECKING..."
                  : diag?.telegram.tokenConfigured
                    ? "BOT CONFIGURED"
                    : "TOKEN NOT SET"}
              </span>
            </div>

            <div className="space-y-2">
              <label className="block font-mono-code text-[10px] font-bold text-[var(--text-muted)]">
                WEBHOOK ENDPOINT
              </label>
              <input
                type="text"
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
                placeholder="https://projectmng.royalmedicalink.id/api/telegram/webhook"
                className={`${inputClass} font-mono-code`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busyAction === "test-telegram"}
                onClick={() => runIntegrationAction("test-telegram")}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-strong)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)]"
              >
                {busyAction === "test-telegram" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-[var(--brand)]" />
                )}
                {t.settings.testBotMessage}
              </button>
              <button
                type="button"
                disabled={busyAction === "sync-webhook"}
                onClick={handleSyncWebhook}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold"
              >
                {busyAction === "sync-webhook" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {t.settings.syncWebhook}
              </button>
            </div>
          </div>

          {/* Cron Jobs & Queue Radar */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[22px] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--brand)]" />
                <h3 className="font-heading font-bold text-[15px] text-[var(--text-ink)]">
                  {t.settings.cronDiagnosticsTitle}
                </h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full font-mono-code text-[9.5px] font-bold border ${
                  diag?.cron.secretConfigured
                    ? "bg-[var(--ok-bg)] border-[var(--ok-st)] text-[var(--ok)]"
                    : "bg-[var(--warn-bg)] border-[var(--warn-st)] text-[var(--warn)]"
                }`}
              >
                {diag?.cron.secretConfigured ? "CRON_SECRET OK" : "CRON_SECRET UNSET"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "OPEN REQ", val: diag?.cron.openTickets ?? 0, tone: "text-[var(--brand)]" },
                { label: "DUE MAINT", val: diag?.cron.dueSchedules ?? 0, tone: "text-[var(--warn)]" },
                { label: "OVERDUE", val: diag?.cron.overdueSchedules ?? 0, tone: "text-[var(--err)]" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-center"
                >
                  <div className={`font-heading font-bold text-lg ${stat.tone}`}>{stat.val}</div>
                  <div className="font-mono-code text-[9px] text-[var(--text-muted)]">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busyAction === "run-cron-reminders"}
                onClick={() => runIntegrationAction("run-cron-reminders")}
                className="h-9 px-3 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)]"
              >
                {t.settings.runRemindersCron}
              </button>
              <button
                type="button"
                disabled={busyAction === "run-cron-maintenance"}
                onClick={() => runIntegrationAction("run-cron-maintenance")}
                className="h-9 px-3 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)]"
              >
                {t.settings.runMaintCron}
              </button>
            </div>
          </div>

          {/* Storage & Runtime */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[22px] p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[var(--brand)]" />
                <h3 className="font-heading font-bold text-[15px] text-[var(--text-ink)]">
                  {t.settings.storageRuntimeTitle}
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-st)] font-mono-code text-[9.5px] font-bold text-[var(--ok)]">
                {diag?.storage.backend || "Local (.uploads)"}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] font-mono-code">
              Bucket: {diag?.storage.bucket || "ittracker-files"} · Presigned / Proxy `/api/files/[...key]` · Max 10MB
            </p>
          </div>

          {/* ExternalApiKey · Ticket Ingestion */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[22px] p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[var(--brand)]" />
                <h3 className="font-heading font-bold text-[15px] text-[var(--text-ink)]">
                  {t.settings.externalApiKeysTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyForm(!showKeyForm)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-[11px] font-semibold"
              >
                <Plus className="w-3 h-3" />
                {t.settings.generateApiKey.replace(/^\+\s*/, "")}
              </button>
            </div>

            <div className="text-[11px] font-mono-code text-[var(--text-muted)]">
              Endpoint: POST /api/v1/external/tickets (`X-API-Key` · SHA-256)
            </div>

            {newlyGeneratedKey && (
              <div className="p-3 rounded-xl bg-[var(--warn-bg)] border border-[var(--warn-st)] space-y-1.5">
                <div className="text-[11px] font-semibold text-[var(--warn)]">
                  {t.settings.copyKeyWarning}
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono-code text-[11px] text-[var(--text-ink)] break-all">
                    {newlyGeneratedKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(newlyGeneratedKey);
                      setCopiedKey(true);
                    }}
                    className="p-2 rounded-lg bg-[var(--brand)] text-white dark:text-[#161A26] shrink-0"
                    title="Copy API key"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {showKeyForm && (
              <form
                onSubmit={handleCreateApiKey}
                className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2"
              >
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder={t.settings.keyNameLabel}
                  className={inputClass}
                  required
                />
                <input
                  type="text"
                  value={keySourceApp}
                  onChange={(e) => setKeySourceApp(e.target.value)}
                  placeholder={t.settings.sourceAppLabel}
                  className={inputClass}
                  required
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowKeyForm(false)}
                    className="px-3 py-1.5 rounded-full bg-[var(--bg-subtle)] text-xs font-semibold text-[var(--text-ink2)]"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={busyAction === "create-key"}
                    className="px-4 py-1.5 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold"
                  >
                    {t.common.save}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {props.externalKeys.length === 0 ? (
                <div className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] text-center">
                  No external API keys generated yet.
                </div>
              ) : (
                props.externalKeys.map((k) => (
                  <div
                    key={k.id}
                    className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--text-ink)] truncate">
                        {k.name} · <span className="text-[var(--brand)]">{k.sourceApp}</span>
                      </div>
                      <div className="font-mono-code text-[10px] text-[var(--text-muted)] truncate">
                        {k.keyPrefix}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleKey(k)}
                        className={`px-2 py-0.5 rounded-full border font-mono-code text-[9.5px] font-bold ${
                          k.isActive
                            ? "bg-[var(--ok-bg)] border-[var(--ok-st)] text-[var(--ok)]"
                            : "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]"
                        }`}
                      >
                        {k.isActive ? "ACTIVE" : "REVOKED"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteKey(k.id)}
                        className="p-1 rounded-lg bg-[var(--err-bg)] border border-[var(--err-st)] text-[var(--err)]"
                        title={t.common.delete}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
