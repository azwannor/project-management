import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export function isAdminUser(
  user: { role?: string | null } | null | undefined
): boolean {
  return user?.role?.toLowerCase() === "admin";
}

/**
 * Compute deterministic SHA-256 hex digest for an external API key.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey.trim()).digest("hex");
}

/**
 * Generate a Royal Medica external ingestion API key and its masked prefix + hash.
 */
export function generateExternalApiKey(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const randomHex = crypto.randomBytes(20).toString("hex");
  const rawKey = `rm_live_${randomHex}`;
  const keyPrefix = `${rawKey.slice(0, 14)}...${rawKey.slice(-4)}`;
  return {
    rawKey,
    keyPrefix,
    keyHash: hashApiKey(rawKey),
  };
}

export interface SlaPolicyValidationResult {
  valid: boolean;
  error?: string;
  firstResponseMinutes?: number;
  targetMinutes?: number;
  reminderThresholdPercent?: number;
}

/**
 * Validate SLA policy numeric thresholds (positive integers, firstResponse <= target, 1..100%).
 */
export function validateSlaPolicyInput(input: {
  firstResponseMinutes: unknown;
  targetMinutes: unknown;
  reminderThresholdPercent: unknown;
}): SlaPolicyValidationResult {
  const first = Number(input.firstResponseMinutes);
  const target = Number(input.targetMinutes);
  const threshold = Number(input.reminderThresholdPercent);

  if (!Number.isInteger(first) || first < 1 || first > 60 * 24 * 30) {
    return { valid: false, error: "First response minutes must be an integer between 1 and 43200" };
  }
  if (!Number.isInteger(target) || target < 1 || target > 60 * 24 * 90) {
    return { valid: false, error: "Target resolution minutes must be an integer between 1 and 129600" };
  }
  if (first > target) {
    return { valid: false, error: "First response minutes cannot exceed target resolution minutes" };
  }
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) {
    return { valid: false, error: "Reminder threshold percent must be an integer between 1 and 100" };
  }

  return {
    valid: true,
    firstResponseMinutes: first,
    targetMinutes: target,
    reminderThresholdPercent: threshold,
  };
}

/**
 * Record non-blocking administrative audit log in PostgreSQL.
 */
export async function logSettingsAudit(params: {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  diffJson?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        ...(params.diffJson !== undefined ? { diffJson: params.diffJson } : {}),
      },
    });
  } catch (err) {
    console.warn("AuditLog write skipped:", err);
  }
}
