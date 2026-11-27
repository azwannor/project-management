"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import QRCode from "qrcode";
import {
  ArrowRight,
  Check,
  ExternalLink,
  History,
  Loader2,
  MapPin,
  Printer,
  QrCode,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { buildAssetQrUrl } from "@/lib/qr";
import { resolveAssetHolder } from "@/lib/maintenance-helpers";
import type { EnterpriseAssetItem } from "./types";

interface QrCustodyViewProps {
  assets: EnterpriseAssetItem[];
  initialQrSvgMap: Record<string, string>;
  isAdmin: boolean;
  onRefresh: () => Promise<void> | void;
  onNotify: (kind: "ok" | "err", text: string) => void;
}

export default function QrCustodyView({
  assets,
  initialQrSvgMap,
  isAdmin,
  onRefresh,
  onNotify,
}: QrCustodyViewProps) {
  const { t } = useI18n();
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    assets.filter((a) => a.status !== "RETIRED").slice(0, 12).map((a) => a.id)
  );
  const [layoutMode, setLayoutMode] = useState<"thermal" | "a4">("a4");
  const [markingPrinted, setMarkingPrinted] = useState(false);
  const [clientSvgs, setClientSvgs] = useState<Record<string, string>>({});

  // Generate QR SVG on client for any newly registered assets not in initialQrSvgMap
  useEffect(() => {
    const missing = assets.filter((a) => !initialQrSvgMap[a.id] && !clientSvgs[a.id]);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const generated: Record<string, string> = {};
      for (const a of missing) {
        try {
          generated[a.id] = await QRCode.toString(buildAssetQrUrl(a.assetCode, origin), {
            type: "svg",
            margin: 1,
            color: { dark: "#0F172A", light: "#FFFFFF" },
          });
        } catch {
          // ignore per-item fallback
        }
      }
      if (!cancelled && Object.keys(generated).length > 0) {
        setClientSvgs((prev) => ({ ...prev, ...generated }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assets, initialQrSvgMap, clientSvgs]);

  const activeAssets = useMemo(
    () => assets.filter((a) => a.status !== "RETIRED"),
    [assets]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedAssets = useMemo(
    () => activeAssets.filter((a) => selectedSet.has(a.id)),
    [activeAssets, selectedSet]
  );

  const recentCustody = useMemo(() => {
    const all: Array<{
      id: string;
      assetCode: string;
      assetName: string;
      previousPerson: string | null;
      newPerson: string | null;
      previousLocation: string | null;
      newLocation: string | null;
      note: string | null;
      changedAt: string | Date;
      changedByName: string;
    }> = [];

    for (const a of assets) {
      for (const cl of a.custodyLogs || []) {
        all.push({
          id: cl.id,
          assetCode: a.assetCode,
          assetName: a.assetName,
          previousPerson: cl.previousPerson,
          newPerson: cl.newPerson,
          previousLocation: cl.previousLocation,
          newLocation: cl.newLocation,
          note: cl.note,
          changedAt: cl.changedAt,
          changedByName: cl.changedBy?.name || "System",
        });
      }
    }

    all.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
    return all.slice(0, 20);
  }, [assets]);

  const toggleAsset = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleMarkPrinted = async () => {
    if (!isAdmin || selectedIds.length === 0 || markingPrinted) return;
    setMarkingPrinted(true);
    try {
      const res = await fetch("/api/assets/qr-printed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds: selectedIds }),
      });
      if (res.ok) {
        onNotify("ok", `Stamped QR print time for ${selectedIds.length} asset(s)`);
        await onRefresh();
      } else {
        onNotify("err", "Failed to stamp QR print status");
      }
    } finally {
      setMarkingPrinted(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Studio Controls */}
      <div className="no-print bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-full p-0.5 gap-0.5">
            {(
              [
                { id: "a4", label: t.assets.a4Preset },
                { id: "thermal", label: t.assets.thermalPreset },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLayoutMode(opt.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                  layoutMode === opt.id
                    ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                    : "text-[var(--text-ink2)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSelectedIds(activeAssets.map((a) => a.id))}
            className="px-3 py-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
          >
            {t.assets.selectAll} ({activeAssets.length})
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedIds(activeAssets.filter((a) => !a.qrPrintedAt).map((a) => a.id))
            }
            className="px-3 py-1.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] text-xs font-semibold text-[var(--text-ink2)] cursor-pointer"
          >
            {t.assets.selectUnprinted} ({activeAssets.filter((a) => !a.qrPrintedAt).length})
          </button>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--err)] cursor-pointer"
            >
              Clear ({selectedIds.length})
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={handleMarkPrinted}
              disabled={selectedIds.length === 0 || markingPrinted}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--bg-canvas)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] cursor-pointer disabled:opacity-50"
            >
              {markingPrinted ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 text-[var(--ok)]" />
              )}
              <span>{t.assets.markPrinted}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            disabled={selectedAssets.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>
              {t.assets.printStickers} ({selectedAssets.length})
            </span>
          </button>
        </div>
      </div>

      {/* Interactive Selection Strip (hidden when printing) */}
      <div className="no-print bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-3 flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
        {activeAssets.map((a) => {
          const checked = selectedSet.has(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAsset(a.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium cursor-pointer transition-colors ${
                checked
                  ? "bg-[var(--brand-tint)] border-[var(--brand-stroke)] text-[var(--brand)]"
                  : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-ink2)]"
              }`}
            >
              <span className="font-mono-code font-bold">{a.assetCode}</span>
              <span className="truncate max-w-[130px]">{a.assetName}</span>
            </button>
          );
        })}
      </div>

      {/* Main Split: Printable QR Sticker Sheet + Custody Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Printable Sticker Grid */}
        <div className="xl:col-span-8 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4">
          {selectedAssets.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-[var(--text-muted)]">
              <QrCode className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs font-semibold">Select assets above to preview QR stickers.</p>
            </div>
          ) : (
            <div
              className={
                layoutMode === "thermal"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 print:grid-cols-2"
                  : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-3"
              }
            >
              {selectedAssets.map((a) => {
                const svg = initialQrSvgMap[a.id] || clientSvgs[a.id] || "";
                const holder = resolveAssetHolder(a);
                return (
                  <div
                    key={a.id}
                    className={`border border-[var(--border-strong)] rounded-xl bg-white text-slate-900 p-3 flex items-center gap-3 print:break-inside-avoid ${
                      layoutMode === "thermal" ? "max-w-[260px]" : ""
                    }`}
                  >
                    <div className="w-16 h-16 shrink-0 border border-slate-200 rounded-lg p-1 bg-white flex items-center justify-center overflow-hidden">
                      {svg ? (
                        <div
                          className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
                          dangerouslySetInnerHTML={{ __html: svg }}
                        />
                      ) : (
                        <QrCode className="w-8 h-8 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-mono-code text-[9px] font-bold uppercase tracking-widest text-blue-700">
                        ROYAL MEDICA IT
                      </p>
                      <p className="font-mono-code text-xs font-extrabold text-slate-900 truncate">
                        {a.assetCode}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-700 truncate">
                        {a.assetName}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {a.division?.name || a.location || "-"}
                        {holder ? ` · ${holder}` : ""}
                      </p>
                      <Link
                        href={`/assets/q/${encodeURIComponent(a.assetCode)}`}
                        className="no-print inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline pt-0.5"
                      >
                        <span>Scan View</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Custody Handover Feed (hidden in print) */}
        <aside className="no-print xl:col-span-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--brand)]" />
            <h3 className="font-heading font-bold text-sm text-[var(--text-ink)]">
              {t.assets.custodyHistory}
            </h3>
          </div>

          {recentCustody.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-6 text-center">
              No custody handovers recorded yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {recentCustody.map((item) => (
                <div
                  key={item.id}
                  className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-code text-[10.5px] font-bold text-[var(--brand)]">
                      {item.assetCode}
                    </span>
                    <span className="font-mono-code text-[10px] text-[var(--text-muted)] tnum">
                      {format(new Date(item.changedAt), "dd MMM HH:mm")}
                    </span>
                  </div>
                  <p className="font-semibold text-[var(--text-ink)] truncate">
                    {item.assetName}
                  </p>
                  {item.previousPerson !== item.newPerson && (
                    <p className="flex flex-wrap items-center gap-1 text-[11px] text-[var(--text-ink2)]">
                      <span>{item.previousPerson || "—"}</span>
                      <ArrowRight className="w-3 h-3 text-[var(--brand)]" />
                      <span className="font-semibold text-[var(--text-ink)]">
                        {item.newPerson || "Unassigned"}
                      </span>
                    </p>
                  )}
                  {item.previousLocation !== item.newLocation && (
                    <p className="flex flex-wrap items-center gap-1 text-[10.5px] text-[var(--text-muted)]">
                      <MapPin className="w-3 h-3" />
                      <span>{item.previousLocation || "—"}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span>{item.newLocation || "—"}</span>
                    </p>
                  )}
                  {item.note && (
                    <p className="text-[10.5px] text-[var(--text-muted)] italic">{item.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
