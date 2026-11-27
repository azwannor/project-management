import { OverallCondition, Prisma, TicketSource } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isMaintenanceAdmin } from "@/lib/auth";
import {
  computeSlaDueAt,
  formatNextTicketNumber,
  resolveSlaPolicy,
} from "@/lib/support-helpers";

// POST /api/maintenance-logs — Submit checklist log + auto-recur + optional linked follow-up SupportTicket
export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      scheduleId,
      checklistResults,
      overallCondition,
      findings,
      followUpNeeded,
      createFollowUpTicket,
      attachment,
      attachmentKey,
    } = body;

    if (!scheduleId) {
      return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
    }
    if (
      !overallCondition ||
      !["BAIK", "PERLU_PERHATIAN", "BERMASALAH"].includes(String(overallCondition))
    ) {
      return NextResponse.json(
        { error: "overallCondition must be BAIK, PERLU_PERHATIAN, or BERMASALAH" },
        { status: 400 }
      );
    }

    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id: String(scheduleId) },
      include: {
        assignedExecutors: { select: { id: true } },
        asset: {
          select: {
            id: true,
            assetCode: true,
            assetName: true,
            location: true,
            division: { select: { name: true } },
          },
        },
        template: {
          select: {
            id: true,
            templateName: true,
            defaultFrequencyDays: true,
            checklistItems: { orderBy: { order: "asc" } },
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    if (schedule.status === "DONE") {
      return NextResponse.json(
        { error: "Schedule is already DONE. Cannot submit log anymore." },
        { status: 400 }
      );
    }

    const isAssigned = schedule.assignedExecutors.some((e) => e.id === auth.user.id);
    if (!isAssigned && !isMaintenanceAdmin(auth.user)) {
      return NextResponse.json(
        { error: "You are not assigned as an executor for this maintenance schedule." },
        { status: 403 }
      );
    }

    let finalChecklistResults = Array.isArray(checklistResults) ? checklistResults : [];
    if (finalChecklistResults.length === 0 && schedule.template?.checklistItems) {
      finalChecklistResults = schedule.template.checklistItems.map((item) => ({
        itemText: item.itemText,
        checked: false,
        note: null,
      }));
    }

    const executionDate = new Date();
    const shouldFollowUp = Boolean(followUpNeeded);
    const shouldCreateTicket = shouldFollowUp && Boolean(createFollowUpTicket);

    // Preload SLA policies & latest ticket number cleanly before transaction if follow-up ticket requested
    let nextTicketNumber: string | null = null;
    let ticketSlaTargetMinutes: number | null = null;
    let ticketSlaDueAt: Date | null = null;
    const ticketPriority = overallCondition === "BERMASALAH" ? "High" : "Normal";

    if (shouldCreateTicket) {
      const year = executionDate.getFullYear();
      const yearPrefix = `SUP-${year}-`;
      const [latestTicket, policies] = await Promise.all([
        prisma.supportTicket.findFirst({
          where: { ticketNumber: { startsWith: yearPrefix } },
          orderBy: { ticketNumber: "desc" },
          select: { ticketNumber: true },
        }),
        prisma.slaPolicy.findMany({
          select: {
            priority: true,
            firstResponseMinutes: true,
            targetMinutes: true,
            reminderThresholdPercent: true,
          },
        }),
      ]);
      nextTicketNumber = formatNextTicketNumber(latestTicket?.ticketNumber, year);
      const matched = resolveSlaPolicy(ticketPriority, policies);
      if (matched) {
        ticketSlaTargetMinutes = matched.targetMinutes;
        ticketSlaDueAt = computeSlaDueAt(executionDate, matched.targetMinutes);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let createdTicket: {
        id: string;
        ticketNumber: string | null;
        status: string;
      } | null = null;

      if (shouldCreateTicket && nextTicketNumber) {
        const executorConnections = schedule.assignedExecutors.map((e) => ({ id: e.id }));
        const createdTicketData = await tx.supportTicket.create({
          data: {
            ticketNumber: nextTicketNumber,
            userId: auth.user.id,
            taskName: `[Follow-up Maintenance] ${schedule.asset.assetName} (${schedule.asset.assetCode})`,
            supportType: "Maintenance & Server Check",
            module: "IT Asset Management",
            area: schedule.asset.location || null,
            startDate: executionDate,
            slaTargetMinutes: ticketSlaTargetMinutes,
            slaDueAt: ticketSlaDueAt,
            issue:
              (typeof findings === "string" && findings.trim()) ||
              `Issue found during routine maintenance. Condition: ${overallCondition}`,
            status: "Not Started",
            priority: ticketPriority,
            ticketType: "REQUEST",
            requesterName: auth.user.name,
            sourceType: TicketSource.MAINTENANCE,
            assetId: schedule.asset.id,
            ...(executorConnections.length > 0
              ? { executors: { connect: executorConnections } }
              : {}),
          },
          select: {
            id: true,
            ticketNumber: true,
            status: true,
            taskName: true,
            priority: true,
          },
        });
        createdTicket = createdTicketData;

        if (executorConnections.length > 0) {
          await tx.notification.createMany({
            data: executorConnections.map((e) => ({
              userId: e.id,
              title: `Follow-Up Support: ${createdTicketData.ticketNumber || "New"}`,
              message: `${createdTicketData.taskName} (${createdTicketData.priority})`,
              type: "ASSIGNMENT",
              link: `/support?ticket=${createdTicketData.id}`,
            })),
          });
        }
      }

      const log = await tx.maintenanceLog.create({
        data: {
          scheduleId: schedule.id,
          executedById: auth.user.id,
          executionDate,
          overallCondition: overallCondition as OverallCondition,
          findings: typeof findings === "string" ? findings.trim() || null : null,
          followUpNeeded: shouldFollowUp,
          supportTicketId: createdTicket?.id || null,
          attachment: typeof attachment === "string" ? attachment.trim() || null : null,
          attachmentKey:
            typeof attachmentKey === "string" ? attachmentKey.trim() || null : null,
          checklistResults: {
            create: finalChecklistResults.map(
              (item: { itemText?: string; checked?: boolean; note?: string | null }) => ({
                itemText: String(item.itemText || "Check item"),
                checked: Boolean(item.checked),
                note: typeof item.note === "string" ? item.note.trim() || null : null,
              })
            ),
          },
        },
        include: {
          executedBy: { select: { id: true, name: true } },
          checklistResults: true,
          supportTicket: { select: { id: true, ticketNumber: true, status: true } },
        },
      });

      await tx.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: { status: "DONE" },
      });

      let nextSchedule = null;
      if (schedule.scheduleType === "RECURRING") {
        const freqDays =
          schedule.frequencyDays || schedule.template?.defaultFrequencyDays || 30;
        const nextDueDate = new Date(executionDate);
        nextDueDate.setDate(nextDueDate.getDate() + freqDays);

        const executorConnections = schedule.assignedExecutors.map((e) => ({ id: e.id }));

        nextSchedule = await tx.maintenanceSchedule.create({
          data: {
            scheduleType: "RECURRING",
            assetId: schedule.asset.id,
            templateId: schedule.template?.id || null,
            frequencyDays: schedule.frequencyDays,
            nextDueDate,
            status: "UPCOMING",
            assignedExecutors:
              executorConnections.length > 0 ? { connect: executorConnections } : undefined,
          },
          include: {
            assignedExecutors: { select: { id: true, name: true } },
          },
        });

        if (executorConnections.length > 0) {
          await tx.notification.createMany({
            data: executorConnections.map((e) => ({
              userId: e.id,
              title: "Jadwal Maintenance Berikutnya",
              message: `Jadwal maintenance "${schedule.asset.assetName}" berikutnya: ${nextDueDate.toLocaleDateString("id-ID")}.`,
              type: "MAINTENANCE",
              link: `/maintenance/schedules/${nextSchedule!.id}`,
            })),
          });
        }
      }

      return { log, nextSchedule, createdTicket };
    });

    const followUpData = shouldFollowUp
      ? {
          createdTicket: result.createdTicket,
          suggestedTicket: {
            taskName: `[Follow-up Maintenance] ${schedule.asset.assetName} - ${schedule.asset.assetCode}`,
            supportType: "Maintenance & Server Check",
            module: "IT Asset Management",
            area: schedule.asset.location,
            issue:
              findings ||
              `Issue found during routine maintenance. Condition: ${overallCondition}`,
            priority: ticketPriority,
            ticketType: "REQUEST",
            requesterName: auth.user.name,
            maintenanceLogId: result.log.id,
          },
        }
      : null;

    return NextResponse.json(
      {
        log: result.log,
        scheduleStatus: "DONE",
        nextSchedule: result.nextSchedule,
        followUp: followUpData,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to submit maintenance log:", error);
    return NextResponse.json(
      { error: "Failed to submit maintenance log" },
      { status: 500 }
    );
  }
}

// GET /api/maintenance-logs — List maintenance logs (scoped by Admin vs Staff)
export async function GET(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get("scheduleId");
    const assetId = searchParams.get("assetId");
    const executedById = searchParams.get("executedById");
    const overallCondition = searchParams.get("overallCondition");

    const where: Prisma.MaintenanceLogWhereInput = {};
    if (scheduleId) where.scheduleId = scheduleId;
    if (executedById) where.executedById = executedById;
    if (
      overallCondition &&
      ["BAIK", "PERLU_PERHATIAN", "BERMASALAH"].includes(overallCondition)
    ) {
      where.overallCondition = overallCondition as OverallCondition;
    }

    const scheduleFilter: Prisma.MaintenanceScheduleWhereInput = {};
    if (assetId) scheduleFilter.assetId = assetId;
    if (!isMaintenanceAdmin(auth.user)) {
      scheduleFilter.assignedExecutors = { some: { id: auth.user.id } };
    }
    if (Object.keys(scheduleFilter).length > 0) {
      where.schedule = scheduleFilter;
    }

    const logs = await prisma.maintenanceLog.findMany({
      where,
      orderBy: { executionDate: "desc" },
      include: {
        executedBy: { select: { id: true, name: true } },
        schedule: {
          select: {
            id: true,
            scheduleType: true,
            asset: {
              select: {
                id: true,
                assetCode: true,
                assetName: true,
                location: true,
                division: { select: { name: true } },
              },
            },
          },
        },
        supportTicket: { select: { id: true, ticketNumber: true, status: true } },
        checklistResults: true,
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to fetch maintenance logs:", error);
    return NextResponse.json({ error: "Failed to fetch maintenance logs" }, { status: 500 });
  }
}
