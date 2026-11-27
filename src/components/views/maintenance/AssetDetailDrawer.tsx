"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Check,
  ExternalLink,
  History,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  Save,
  ShieldAlert,
  Ticket,
  UserCheck,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import { ThemedDatePicker } from "@/components/ui/ThemedDatePicker";
import {
  ASSET_STATUS_VALUES,
  computeWarrantyHealth,
  resolveAssetHolder,
} from "@/lib/maintenance-helpers";
import type {
  AssetTypeOption,
  DivisionOption,
  EnterpriseAssetItem,
  LocationOption,
  MaintUserOption,
} from "./types";

interface AssetDetailDrawerProps {
  isOpen: boolean;
  asset: EnterpriseAssetItem | null;
  qrSvgMap: Record<string, string>;
  assetTypes: AssetTypeOption[];
  divisions: DivisionOption[];
  locations: LocationOption[];
  users: MaintUserOption[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onNotify: (kind: "ok" | "err", text: string) => void;
  onQuickMasterCreated: () => Promise<void> | void;
}

function toDateStr(value?: string | Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
}

export default function AssetDetailDrawer(props: AssetDetailDrawerProps) {
  if (!props.isOpen) return null;
  const key = props.asset ? `${props.asset.id}-${props.asset.status}` : "new-asset";
  return <AssetDetailDrawerInner key={key} {...props} />;
}

function AssetDetailDrawerInner({
  asset,
  qrSvgMap,
  assetTypes,
  divisions,
  locations,
  users,
  isAdmin,
  onClose,
  onSaved,
  onNotify,
  onQuickMasterCreated,
}: AssetDetailDrawerProps) {
  const { locale, t } = useI18n();

  const [assetCode, setAssetCode] = useState(() => asset?.assetCode || "");
  const [assetName, setAssetName] = useState(() => asset?.assetName || "");
  const [assetTypeId, setAssetTypeId] = useState(
    () => asset?.assetTypeId || assetTypes[0]?.id || ""
  );
  const [divisionId, setDivisionId] = useState(
    () => asset?.divisionId || divisions[0]?.id || ""
  );
  const [locationId, setLocationId] = useState(() => asset?.locationId || "");
  const [locationText, setLocationText] = useState(() => asset?.location || locations[0]?.name || "");
  const [detailedLocation, setDetailedLocation] = useState(() => asset?.detailedLocation || "");
  const [status, setStatus] = useState(() => asset?.status || "ACTIVE");
  const [assignedPerson, setAssignedPerson] = useState(() =>
    asset ? resolveAssetHolder(asset) || "" : ""
  );
  const [picUserId, setPicUserId] = useState(() => asset?.picUserId || "");
  const [brand, setBrand] = useState(() => asset?.brand || "");
  const [model, setModel] = useState(() => asset?.model || "");
  const [serialNumber, setSerialNumber] = useState(() => asset?.serialNumber || "");
  const [vendor, setVendor] = useState(() => asset?.vendor || "");
  const [purchaseDate, setPurchaseDate] = useState(() => toDateStr(asset?.purchaseDate));
  const [warrantyEndDate, setWarrantyEndDate] = useState(() => toDateStr(asset?.warrantyEndDate));
  const [purchasePrice, setPurchasePrice] = useState(() =>
    asset?.purchasePrice !== null && asset?.purchasePrice !== undefined
      ? String(asset.purchasePrice)
      : ""
  );
  const [notes, setNotes] = useState(() => asset?.notes || "");
  const [custodyNote, setCustodyNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Quick master data creation (Division / Asset Type / Location) without prompt()
  const [quickAddKind, setQuickAddKind] = useState<"division" | "assetType" | "location" | null>(
    null
  );
  const [quickAddValue, setQuickAddValue] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);

  const warranty = computeWarrantyHealth(warrantyEndDate || asset?.warrantyEndDate);
  const qrSvg = asset ? qrSvgMap[asset.id] || "" : "";

  const handleQuickAdd = async () => {
    if (!quickAddKind || !quickAddValue.trim() || quickAdding) return;
    setQuickAdding(true);
    setError("");
    const endpoint =
      quickAddKind === "division"
        ? "/api/divisions"
        : quickAddKind === "assetType"
          ? "/api/asset-types"
          : "/api/locations";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: quickAddValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add item");
        return;
      }
      if (quickAddKind === "division") setDivisionId(data.id);
      if (quickAddKind === "assetType") setAssetTypeId(data.id);
      if (quickAddKind === "location") {
        setLocationId(data.id);
        setLocationText(data.name);
      }
      setQuickAddValue("");
      setQuickAddKind(null);
      await onQuickMasterCreated();
      onNotify("ok", `${data.name} added`);
    } finally {
      setQuickAdding(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !assetCode.trim() || !assetName.trim()) return;
    setSaving(true);
    setError("");

    const matchedLoc = locations.find((l) => l.id === locationId);
    const payload = {
      assetCode: assetCode.trim(),
      assetName: assetName.trim(),
      assetTypeId,
      divisionId,
      locationId: locationId || null,
      location: matchedLoc?.name || locationText.trim() || null,
      detailedLocation: detailedLocation.trim() || null,
      status,
      assignedPerson: assignedPerson.trim() || null,
      person: assignedPerson.trim() || null,
      picUserId: picUserId || null,
      brand: brand.trim() || null,
      model: model.trim() || null,
      serialNumber: serialNumber.trim() || null,
      vendor: vendor.trim() || null,
      purchaseDate: purchaseDate || null,
      warrantyEndDate: warrantyEndDate || null,
      purchasePrice: purchasePrice.trim() ? Number(purchasePrice.trim()) : null,
      notes: notes.trim() || null,
      custodyNote: custodyNote.trim() || null,
    };

    try {
      const res = await fetch(asset ? `/api/assets/${asset.id}` : "/api/assets", {
        method: asset ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save asset");
        return;
      }
      onNotify("ok", asset ? "Asset updated" : "Asset registered");
      await onSaved();
      onClose();
    } catch {
      setError("Network error while saving asset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-2xl h-full bg-[var(--bg-surface)] border-l border-[var(--border-strong)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <h3 className="font-heading font-bold text-sm sm:text-base text-[var(--text-ink)] truncate">
                {asset ? t.assets.editAsset : t.assets.newAsset}
              </h3>
              {asset && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] whitespace-nowrap">
                    {asset.assetCode}
                  </span>
                  {warranty.state !== "UNTRACKED" && (
                    <span
                      className={`font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                        warranty.state === "EXPIRED"
                          ? "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]"
                          : warranty.state === "EXPIRING_SOON"
                            ? "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]"
                            : "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]"
                      }`}
                    >
                      {warranty.state === "EXPIRED"
                        ? t.assets.warrantyExpired
                        : warranty.state === "EXPIRING_SOON"
                          ? t.assets.warrantyExpiring
                          : t.assets.warrantyActive}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {error && (
            <div className="text-xs font-semibold text-[var(--err)] bg-[var(--err-bg)] border border-[var(--err-stroke)] rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}

          {/* QR Field Scan Preview Banner (Existing Asset) */}
          {asset && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-2xl p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-16 h-16 rounded-xl bg-white p-1 border border-[var(--border-subtle)] shrink-0 flex items-center justify-center overflow-hidden">
                  {qrSvg ? (
                    <div
                      className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  ) : (
                    <QrCode className="w-8 h-8 text-slate-700" />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t.assets.scanPreview}
                  </p>
                  <p className="font-mono-code text-xs font-bold text-[var(--text-ink)] truncate">
                    /assets/q/{asset.assetCode}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {asset.qrPrintedAt
                      ? `${t.assets.qrPrintedLabel}: ${format(new Date(asset.qrPrintedAt), "dd MMM yyyy")}`
                      : t.assets.qrNotPrinted}
                  </p>
                </div>
              </div>

              <Link
                href={`/assets/q/${encodeURIComponent(asset.assetCode)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--brand-stroke)] text-[var(--brand)] text-xs font-semibold hover:bg-[var(--brand-tint)] shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t.assets.openScanPage}</span>
              </Link>
            </div>
          )}

          {/* Core Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Asset Code <span className="text-[var(--err)]">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value)}
                placeholder="e.g. INV-LTP-128"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] font-mono-code text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Asset Name <span className="text-[var(--err)]">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="e.g. DELL LATITUDE 5430"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)] disabled:opacity-60"
              />
            </div>
          </div>

          {/* Classification: Type / Division / Location / Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Asset Type
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddKind(quickAddKind === "assetType" ? null : "assetType");
                      setQuickAddValue("");
                    }}
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--brand)] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
              <ThemedSelect
                value={assetTypeId}
                onChange={setAssetTypeId}
                options={assetTypes.map((at) => ({ value: at.id, label: at.name }))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Division
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddKind(quickAddKind === "division" ? null : "division");
                      setQuickAddValue("");
                    }}
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--brand)] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
              <ThemedSelect
                value={divisionId}
                onChange={setDivisionId}
                options={divisions.map((d) => ({ value: d.id, label: d.name }))}
                className="w-full"
              />
            </div>
          </div>

          {/* Inline Quick-Add Master Entry */}
          {quickAddKind && (
            <div className="flex items-center gap-2 bg-[var(--brand-tint)] border border-[var(--brand-stroke)] rounded-xl p-2.5">
              <input
                type="text"
                value={quickAddValue}
                onChange={(e) => setQuickAddValue(e.target.value)}
                placeholder={`New ${quickAddKind === "division" ? "Division" : quickAddKind === "assetType" ? "Asset Type" : "Location"} name...`}
                className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={quickAdding || !quickAddValue.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {quickAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Add</span>
              </button>
            </div>
          )}

          {/* Location, Detailed Location, Holder, PIC, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Site / Location
                  </span>
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddKind(quickAddKind === "location" ? null : "location");
                      setQuickAddValue("");
                    }}
                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[var(--brand)] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
              <ThemedSelect
                value={locationId || locationText}
                onChange={(val) => {
                  const found = locations.find((l) => l.id === val || l.name === val);
                  if (found) {
                    setLocationId(found.id);
                    setLocationText(found.name);
                  } else {
                    setLocationId("");
                    setLocationText(val);
                  }
                }}
                options={[
                  { value: "", label: "— Select Site —" },
                  ...locations.map((l) => ({ value: l.id, label: l.name })),
                ]}
                className="w-full"
              />
            </div>

            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Area / Room / Rack
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={detailedLocation}
                onChange={(e) => setDetailedLocation(e.target.value)}
                placeholder="e.g. Ruang Server / JATENG 1"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                <span className="inline-flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Assigned Holder
                </span>
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={assignedPerson}
                onChange={(e) => setAssignedPerson(e.target.value)}
                placeholder="e.g. HERI SUSANTO"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Status
              </label>
              <ThemedSelect
                value={status}
                onChange={setStatus}
                options={ASSET_STATUS_VALUES.map((s) => ({
                  value: s,
                  label: s.replace("_", " "),
                }))}
                className="w-full"
              />
            </div>
          </div>

          {asset && isAdmin && (
            <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-1.5">
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Custody Handover Note
              </label>
              <input
                type="text"
                value={custodyNote}
                onChange={(e) => setCustodyNote(e.target.value)}
                placeholder={t.assets.custodyNotePlaceholder}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)] focus:outline-none focus:border-[var(--brand)]"
              />
              <p className="text-[10.5px] text-[var(--text-muted)]">{t.assets.handoverMoved}</p>
            </div>
          )}

          {/* Specs & Procurement */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Brand
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)]"
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Model
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)]"
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Serial Number
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] font-mono-code text-xs text-[var(--text-ink)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                IT PIC
              </label>
              <ThemedSelect
                value={picUserId}
                onChange={setPicUserId}
                options={[
                  { value: "", label: "— Unassigned —" },
                  ...users.map((u) => ({ value: u.id, label: u.name })),
                ]}
                className="w-full"
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Vendor
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)]"
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Purchase Date
              </label>
              <ThemedDatePicker
                value={purchaseDate}
                onChange={setPurchaseDate}
                locale={locale}
                allowClear
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Warranty End Date
              </label>
              <ThemedDatePicker
                value={warrantyEndDate}
                onChange={setWarrantyEndDate}
                locale={locale}
                allowClear
                menuAlign="right"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Purchase Price (IDR)
              </label>
              <input
                type="number"
                min={0}
                disabled={!isAdmin}
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] font-mono-code text-xs text-[var(--text-ink)] tnum"
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Notes
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-ink)]"
              />
            </div>
          </div>

          {/* Custody Handover Audit Timeline */}
          {asset && asset.custodyLogs && asset.custodyLogs.length > 0 && (
            <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[var(--brand)]" />
                <h4 className="font-mono-code text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-ink)]">
                  {t.assets.custodyHistory} ({asset.custodyLogs.length})
                </h4>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {asset.custodyLogs.map((cl) => (
                  <div
                    key={cl.id}
                    className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-[10.5px] text-[var(--text-muted)] font-mono-code">
                      <span>{format(new Date(cl.changedAt), "dd MMM yyyy HH:mm")}</span>
                      <span>{cl.changedBy?.name || "System"}</span>
                    </div>
                    {(cl.previousPerson !== cl.newPerson) && (
                      <p className="flex flex-wrap items-center gap-1 font-medium text-[var(--text-ink)]">
                        <span className="text-[var(--text-muted)]">{cl.previousPerson || "—"}</span>
                        <ArrowRight className="w-3 h-3 text-[var(--brand)]" />
                        <span>{cl.newPerson || "Unassigned"}</span>
                      </p>
                    )}
                    {(cl.previousLocation !== cl.newLocation) && (
                      <p className="flex flex-wrap items-center gap-1 text-[11px] text-[var(--text-ink2)]">
                        <MapPin className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>{cl.previousLocation || "—"}</span>
                        <ArrowRight className="w-3 h-3 text-[var(--brand)]" />
                        <span>{cl.newLocation || "—"}</span>
                      </p>
                    )}
                    {cl.note && <p className="text-[11px] text-[var(--text-muted)] italic">{cl.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked Support Tickets */}
          {asset && asset.supportTickets && asset.supportTickets.length > 0 && (
            <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-[var(--warn)]" />
                <h4 className="font-mono-code text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-ink)]">
                  Linked Support Tickets ({asset.supportTickets.length})
                </h4>
              </div>
              <div className="space-y-1.5">
                {asset.supportTickets.map((tk) => (
                  <Link
                    key={tk.id}
                    href={`/support?ticket=${tk.id}`}
                    className="flex items-center justify-between gap-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] rounded-xl px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono-code text-[10px] font-bold text-[var(--brand)] shrink-0">
                        {tk.ticketNumber || tk.id.slice(0, 8)}
                      </span>
                      <span className="font-medium text-[var(--text-ink)] truncate">
                        {tk.taskName}
                      </span>
                    </div>
                    <span className="font-mono-code text-[10px] font-bold text-[var(--text-muted)] shrink-0">
                      {tk.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
            >
              {t.common.cancel}
            </button>
            {isAdmin ? (
              <button
                type="submit"
                disabled={saving || !assetCode.trim() || !assetName.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{t.common.save}</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <ShieldAlert className="w-3.5 h-3.5" /> Read-only
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
