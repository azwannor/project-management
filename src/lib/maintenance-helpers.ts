export type WarrantyHealthState = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "UNTRACKED";

export type ScheduleUrgencyState = "OVERDUE" | "DUE_SOON" | "UPCOMING" | "DONE";

export interface CustodySnapshot {
  assignedPerson?: string | null;
  person?: string | null;
  location?: string | null;
  detailedLocation?: string | null;
  divisionName?: string | null;
}

export interface CustodyDiff {
  previousPerson: string | null;
  newPerson: string | null;
  previousLocation: string | null;
  newLocation: string | null;
  previousDivision: string | null;
  newDivision: string | null;
}

export const ASSET_STATUS_VALUES = [
  "ACTIVE",
  "IN_REPAIR",
  "SPARE",
  "INACTIVE",
  "RETIRED",
  "LOST",
] as const;

export type CanonicalAssetStatus = (typeof ASSET_STATUS_VALUES)[number];

/**
 * Normalize an asset holder label preferring `assignedPerson`, falling back to legacy `person`.
 */
export function resolveAssetHolder(snap: CustodySnapshot): string | null {
  const raw = snap.assignedPerson ?? snap.person ?? null;
  const clean = typeof raw === "string" ? raw.trim() : "";
  return clean || null;
}

/**
 * Combine base location and detailed room/area into a concise custody location label.
 */
export function resolveAssetLocationLabel(snap: CustodySnapshot): string | null {
  const base = typeof snap.location === "string" ? snap.location.trim() : "";
  const detail = typeof snap.detailedLocation === "string" ? snap.detailedLocation.trim() : "";
  if (base && detail && detail.toLowerCase() !== base.toLowerCase()) {
    return `${base} · ${detail}`;
  }
  return base || detail || null;
}

/**
 * Detect whether custody attributes (holder, location, division) changed between two asset snapshots.
 * Returns null if no custody-relevant value changed.
 */
export function computeAssetCustodyDiff(
  prev: CustodySnapshot,
  next: CustodySnapshot
): CustodyDiff | null {
  const prevPerson = resolveAssetHolder(prev);
  const nextPerson = resolveAssetHolder(next);
  const prevLoc = resolveAssetLocationLabel(prev);
  const nextLoc = resolveAssetLocationLabel(next);
  const prevDiv = typeof prev.divisionName === "string" ? prev.divisionName.trim() || null : null;
  const nextDiv = typeof next.divisionName === "string" ? next.divisionName.trim() || null : null;

  if (prevPerson === nextPerson && prevLoc === nextLoc && prevDiv === nextDiv) {
    return null;
  }

  return {
    previousPerson: prevPerson,
    newPerson: nextPerson,
    previousLocation: prevLoc,
    newLocation: nextLoc,
    previousDivision: prevDiv,
    newDivision: nextDiv,
  };
}

/**
 * Evaluate warranty status relative to `nowMs`. Marks expiring within 30 days as `EXPIRING_SOON`.
 */
export function computeWarrantyHealth(
  warrantyEndDate?: string | Date | null,
  nowMs: number = Date.now()
): { state: WarrantyHealthState; daysRemaining: number | null } {
  if (!warrantyEndDate) return { state: "UNTRACKED", daysRemaining: null };
  const endMs = new Date(warrantyEndDate).getTime();
  if (Number.isNaN(endMs)) return { state: "UNTRACKED", daysRemaining: null };

  const daysRemaining = Math.ceil((endMs - nowMs) / 86_400_000);
  if (daysRemaining < 0) {
    return { state: "EXPIRED", daysRemaining };
  }
  if (daysRemaining <= 30) {
    return { state: "EXPIRING_SOON", daysRemaining };
  }
  return { state: "ACTIVE", daysRemaining };
}

/**
 * Evaluate live maintenance schedule urgency from `status` and `nextDueDate`.
 */
export function computeScheduleUrgency(
  status: string,
  nextDueDate: string | Date,
  nowMs: number = Date.now()
): { state: ScheduleUrgencyState; daysDelta: number } {
  if (status === "DONE") {
    return { state: "DONE", daysDelta: 0 };
  }

  const dueMs = new Date(nextDueDate).getTime();
  if (Number.isNaN(dueMs)) {
    return { state: "UPCOMING", daysDelta: 0 };
  }

  const daysDelta = Math.ceil((dueMs - nowMs) / 86_400_000);
  if (daysDelta < 0 || status === "OVERDUE") {
    return { state: "OVERDUE", daysDelta };
  }
  if (daysDelta <= 7 || status === "DUE") {
    return { state: "DUE_SOON", daysDelta };
  }
  return { state: "UPCOMING", daysDelta };
}
