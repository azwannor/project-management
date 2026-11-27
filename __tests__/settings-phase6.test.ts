jest.mock("jose", () => ({
  SignJWT: jest.fn(),
  jwtVerify: jest.fn(),
}));

import {
  generateExternalApiKey,
  hashApiKey,
  isAdminUser,
  validateSlaPolicyInput,
} from "../src/lib/settings-helpers";
import { classifySupportTicketDueState, classifyTaskDueState } from "../src/lib/cron-helpers";
import { isAuthorizedCronRequest } from "../src/lib/auth";
import prisma from "../src/lib/prisma";

describe("Phase 6 Settings, Master Data & Integrations Helpers", () => {
  it("validates admin role check case-insensitively", () => {
    expect(isAdminUser({ role: "Admin" })).toBe(true);
    expect(isAdminUser({ role: "admin" })).toBe(true);
    expect(isAdminUser({ role: "Staff" })).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });

  it("generates unique rm_live API keys and deterministic SHA-256 hashes", () => {
    const a = generateExternalApiKey();
    const b = generateExternalApiKey();

    expect(a.rawKey.startsWith("rm_live_")).toBe(true);
    expect(a.keyPrefix).toContain("rm_live_");
    expect(a.keyHash).toHaveLength(64);
    expect(a.keyHash).toBe(hashApiKey(a.rawKey));
    expect(a.rawKey).not.toBe(b.rawKey);
    expect(a.keyHash).not.toBe(b.keyHash);
  });

  it("enforces strict integer constraints on SLA Policy updates", () => {
    expect(
      validateSlaPolicyInput({
        firstResponseMinutes: 15,
        targetMinutes: 120,
        reminderThresholdPercent: 75,
      })
    ).toEqual({
      valid: true,
      firstResponseMinutes: 15,
      targetMinutes: 120,
      reminderThresholdPercent: 75,
    });

    expect(
      validateSlaPolicyInput({
        firstResponseMinutes: 180,
        targetMinutes: 120,
        reminderThresholdPercent: 75,
      }).valid
    ).toBe(false);

    expect(
      validateSlaPolicyInput({
        firstResponseMinutes: -5,
        targetMinutes: 120,
        reminderThresholdPercent: 75,
      }).valid
    ).toBe(false);

    expect(
      validateSlaPolicyInput({
        firstResponseMinutes: 15,
        targetMinutes: 120,
        reminderThresholdPercent: 120,
      }).valid
    ).toBe(false);
  });

  it("checks Cron authorization header strictly when CRON_SECRET is set", () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "phase6-cron-secret-value";

    const okBearer = new Request("http://localhost:7070/api/cron/maintenance", {
      headers: { authorization: "Bearer phase6-cron-secret-value" },
    });
    const okHeader = new Request("http://localhost:7070/api/cron/maintenance", {
      headers: { "x-cron-secret": "phase6-cron-secret-value" },
    });
    const badReq = new Request("http://localhost:7070/api/cron/maintenance", {
      headers: { authorization: "Bearer wrong" },
    });

    expect(isAuthorizedCronRequest(okBearer)).toBe(true);
    expect(isAuthorizedCronRequest(okHeader)).toBe(true);
    expect(isAuthorizedCronRequest(badReq)).toBe(false);

    if (prev === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = prev;
    }
  });

  it("confirms DB-backed SLA Policies and Regional Areas exist cleanly", async () => {
    const [policies, areasCount, modulesCount] = await Promise.all([
      prisma.slaPolicy.findMany({ select: { priority: true, targetMinutes: true } }),
      prisma.regionalArea.count(),
      prisma.supportModule.count(),
    ]);

    expect(policies.length).toBeGreaterThanOrEqual(4);
    expect(areasCount).toBeGreaterThanOrEqual(27);
    expect(modulesCount).toBeGreaterThanOrEqual(16);
  });

  it("alerts Telegram cron ONLY for approaching-overdue or overdue active items until finished", () => {
    const nowMs = new Date("2026-11-26T09:00:00.000Z").getTime();

    // Tasks
    expect(classifyTaskDueState({ status: "Completed", endDate: "2026-11-25T09:00:00.000Z" }, nowMs)).toBeNull();
    expect(classifyTaskDueState({ status: "Ongoing", endDate: "2026-11-28T09:00:00.000Z" }, nowMs)).toBeNull();
    expect(classifyTaskDueState({ status: "Ongoing", endDate: "2026-11-26T20:00:00.000Z" }, nowMs)).toBe("APPROACHING");
    expect(classifyTaskDueState({ status: "Not Started", endDate: "2026-11-26T08:00:00.000Z" }, nowMs)).toBe("OVERDUE");

    // Support tickets
    const policies = [{ priority: "Urgent", firstResponseMinutes: 15, targetMinutes: 120, reminderThresholdPercent: 75 }];
    expect(
      classifySupportTicketDueState(
        { ticketType: "DAILY_ACTIVITY", status: "Ongoing", priority: "Urgent", startDate: "2026-11-26T06:00:00.000Z" },
        policies,
        nowMs
      )
    ).toBeNull();
    expect(
      classifySupportTicketDueState(
        { ticketType: "REQUEST", status: "Done", priority: "Urgent", startDate: "2026-11-26T06:00:00.000Z", slaDueAt: "2026-11-26T08:00:00.000Z" },
        policies,
        nowMs
      )
    ).toBeNull();
    expect(
      classifySupportTicketDueState(
        { ticketType: "REQUEST", status: "Ongoing", priority: "Urgent", startDate: "2026-11-26T08:40:00.000Z", slaDueAt: "2026-11-26T10:40:00.000Z" },
        policies,
        nowMs
      )
    ).toBeNull();
    expect(
      classifySupportTicketDueState(
        { ticketType: "REQUEST", status: "Ongoing", priority: "Urgent", startDate: "2026-11-26T07:15:00.000Z", slaDueAt: "2026-11-26T09:15:00.000Z" },
        policies,
        nowMs
      )
    ).toBe("APPROACHING");
    expect(
      classifySupportTicketDueState(
        { ticketType: "REQUEST", status: "Not Started", priority: "Urgent", startDate: "2026-11-26T06:00:00.000Z", slaDueAt: "2026-11-26T08:00:00.000Z" },
        policies,
        nowMs
      )
    ).toBe("OVERDUE");
  });
});
