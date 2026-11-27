import Link from "next/link";
import { Building2, LogIn, MapPin, QrCode, ShieldCheck } from "lucide-react";

interface PublicAssetBadgeViewProps {
  assetCode: string;
  assetName: string;
  status: string;
  location: string | null;
  divisionName: string | null;
  assetTypeName: string | null;
  qrSvg: string;
  callbackUrl: string;
}

/**
 * Unauthenticated public QR scan view exposing only safe non-sensitive asset identification
 * and prompting IT staff to sign in for maintenance checklists and custody history.
 */
export default function PublicAssetBadgeView({
  assetCode,
  assetName,
  status,
  location,
  divisionName,
  assetTypeName,
  qrSvg,
  callbackUrl,
}: PublicAssetBadgeViewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-lg p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--brand)]" />
            <span className="font-mono-code text-[10px] font-bold uppercase tracking-widest text-[var(--brand)]">
              ROYAL MEDICA ASSET BADGE
            </span>
          </div>
          <span
            className={`font-mono-code text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              status === "ACTIVE"
                ? "bg-[var(--ok-bg)] border-[var(--ok-stroke)] text-[var(--ok)]"
                : status === "IN_REPAIR"
                  ? "bg-[var(--warn-bg)] border-[var(--warn-stroke)] text-[var(--warn)]"
                  : "bg-[var(--err-bg)] border-[var(--err-stroke)] text-[var(--err)]"
            }`}
          >
            {status.replace("_", " ")}
          </span>
        </div>

        <div className="flex items-start gap-4">
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
          <div className="min-w-0 space-y-1">
            <p className="font-mono-code text-xs font-extrabold text-[var(--brand)]">
              {assetCode}
            </p>
            <h1 className="font-heading font-bold text-base sm:text-lg text-[var(--text-ink)]">
              {assetName}
            </h1>
            {assetTypeName && (
              <p className="text-xs text-[var(--text-muted)]">{assetTypeName}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3">
            <p className="font-mono-code text-[9.5px] font-bold uppercase text-[var(--text-muted)]">
              Division
            </p>
            <p className="text-xs font-semibold text-[var(--text-ink)] mt-0.5 flex items-center gap-1 truncate">
              <Building2 className="w-3.5 h-3.5 text-[var(--brand)] shrink-0" />
              <span className="truncate">{divisionName || "-"}</span>
            </p>
          </div>
          <div className="bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-xl p-3">
            <p className="font-mono-code text-[9.5px] font-bold uppercase text-[var(--text-muted)]">
              Location
            </p>
            <p className="text-xs font-semibold text-[var(--text-ink)] mt-0.5 flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 text-[var(--info)] shrink-0" />
              <span className="truncate">{location || "-"}</span>
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2.5">
          <p className="text-[11px] text-[var(--text-muted)]">
            Sign in with your IT Staff account to execute maintenance checklists, inspect custody logs, or report an issue.
          </p>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In (IT Staff)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
