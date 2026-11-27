import {
  computeSlaDueAt,
  evaluateTicketSla,
  formatCompactMinutes,
  formatNextTicketNumber,
  formatSafeCsvCell,
  normalizeSupportPriority,
  stripRichHtml,
  type SlaPolicyInput,
} from "../src/lib/support-helpers";

const SAMPLE_POLICIES: SlaPolicyInput[] = [
  { priority: "Urgent", firstResponseMinutes: 15, targetMinutes: 120, reminderThresholdPercent: 75 },
  { priority: "High", firstResponseMinutes: 30, targetMinutes: 240, reminderThresholdPercent: 75 },
  { priority: "Normal", firstResponseMinutes: 120, targetMinutes: 1440, reminderThresholdPercent: 75 },
  { priority: "Low", firstResponseMinutes: 240, targetMinutes: 2880, reminderThresholdPercent: 75 },
];

describe("Phase 4 Support Helpers", () => {
  it("normalizes legacy URGENT and mixed-case priorities consistently", () => {
    expect(normalizeSupportPriority("URGENT")).toBe("Urgent");
    expect(normalizeSupportPriority("urgent")).toBe("Urgent");
    expect(normalizeSupportPriority("High")).toBe("High");
    expect(normalizeSupportPriority("low")).toBe("Low");
    expect(normalizeSupportPriority(null)).toBe("Normal");
  });

  it("generates sequential SUP-YYYY-XXXX ticket numbers cleanly", () => {
    expect(formatNextTicketNumber(null, 2026)).toBe("SUP-2026-0001");
    expect(formatNextTicketNumber("SUP-2026-0262", 2026)).toBe("SUP-2026-0263");
    expect(formatNextTicketNumber("SUP-2025-0999", 2026)).toBe("SUP-2026-0001");
    expect(formatNextTicketNumber("INVALID", 2026)).toBe("SUP-2026-0001");
  });

  it("evaluates SLA ON_TRACK, AT_RISK, BREACHED, MET, and MISSED states accurately", () => {
    const baseStart = new Date("2026-11-25T08:00:00.000Z");
    const dueAt = computeSlaDueAt(baseStart, 120)!; // +2h -> 10:00Z

    const onTrack = evaluateTicketSla(
      {
        ticketType: "REQUEST",
        status: "Ongoing",
        priority: "URGENT",
        startDate: baseStart,
        slaDueAt: dueAt,
        slaTargetMinutes: 120,
      },
      SAMPLE_POLICIES,
      new Date("2026-11-25T08:30:00.000Z").getTime()
    );
    expect(onTrack.state).toBe("ON_TRACK");
    expect(onTrack.remainingMinutes).toBe(90);

    const atRisk = evaluateTicketSla(
      {
        ticketType: "REQUEST",
        status: "Ongoing",
        priority: "Urgent",
        startDate: baseStart,
        slaDueAt: dueAt,
        slaTargetMinutes: 120,
      },
      SAMPLE_POLICIES,
      new Date("2026-11-25T09:35:00.000Z").getTime()
    );
    expect(atRisk.state).toBe("AT_RISK");
    expect(atRisk.remainingMinutes).toBe(25);

    const breached = evaluateTicketSla(
      {
        ticketType: "REQUEST",
        status: "Not Started",
        priority: "Urgent",
        startDate: baseStart,
        slaDueAt: dueAt,
        slaTargetMinutes: 120,
      },
      SAMPLE_POLICIES,
      new Date("2026-11-25T10:20:00.000Z").getTime()
    );
    expect(breached.state).toBe("BREACHED");
    expect(breached.remainingMinutes).toBe(-20);

    const met = evaluateTicketSla(
      {
        ticketType: "REQUEST",
        status: "Done",
        priority: "Urgent",
        startDate: baseStart,
        endDate: new Date("2026-11-25T09:15:00.000Z"),
        slaDueAt: dueAt,
        slaTargetMinutes: 120,
      },
      SAMPLE_POLICIES
    );
    expect(met.state).toBe("MET");
    expect(met.elapsedMinutes).toBe(75);

    const missed = evaluateTicketSla(
      {
        ticketType: "REQUEST",
        status: "Done",
        priority: "Urgent",
        startDate: baseStart,
        endDate: new Date("2026-11-25T11:00:00.000Z"),
        slaDueAt: dueAt,
        slaTargetMinutes: 120,
      },
      SAMPLE_POLICIES
    );
    expect(missed.state).toBe("MISSED");
    expect(missed.remainingMinutes).toBe(-60);
  });

  it("strips HTML safely, formats compact minutes, and escapes CSV formula prefixes", () => {
    expect(stripRichHtml("<p>Printer&nbsp;error &amp; jam</p>")).toBe("Printer error & jam");
    expect(formatCompactMinutes(135)).toBe("2h 15m");
    expect(formatCompactMinutes(-45)).toBe("45m");
    expect(formatSafeCsvCell("=CMD('calc')")).toBe(`"'=CMD('calc')"`);
    expect(formatSafeCsvCell("  =SUM(A1:A2)")).toBe(`"'  =SUM(A1:A2)"`);
    expect(formatSafeCsvCell('He said "Hi"')).toBe(`"He said ""Hi"""`);
  });
});
