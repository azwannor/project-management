import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { closeOpenTimeLogsForTicket, openAutoTimeLogForTicket } from "@/lib/timelog";
import { fetchTicketTimeLogs, validateSupportRefs } from "@/lib/support-validation";
import {
  computeSlaDueAt,
  normalizeSupportPriority,
  resolveSlaPolicy,
} from "@/lib/support-helpers";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const existingTicket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        executors: { select: { id: true, name: true } },
      },
    });
    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const now = new Date();
    const nextTicketType =
      body.ticketType === "REQUEST" || body.ticketType === "DAILY_ACTIVITY"
        ? body.ticketType
        : existingTicket.ticketType;
    const nextStatus =
      typeof body.status === "string" && body.status.trim()
        ? body.status.trim()
        : existingTicket.status;
    const nextPriority =
      body.priority !== undefined
        ? normalizeSupportPriority(body.priority)
        : normalizeSupportPriority(existingTicket.priority);
    const nextStartDate = body.startDate ? new Date(body.startDate) : existingTicket.startDate;
    if (Number.isNaN(nextStartDate.getTime())) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }

    // Handle endDate semantics safely
    let nextEndDate: Date | null = existingTicket.endDate;
    if (nextTicketType === "REQUEST") {
      if (nextStatus === "Done") {
        nextEndDate = existingTicket.status !== "Done" ? now : existingTicket.endDate || now;
      } else {
        nextEndDate = null;
      }
    } else if (body.endDate !== undefined) {
      nextEndDate = body.endDate ? new Date(body.endDate) : null;
      if (nextEndDate && Number.isNaN(nextEndDate.getTime())) {
        return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
      }
    } else if (nextStatus === "Done" && existingTicket.status !== "Done" && !existingTicket.endDate) {
      nextEndDate = now;
    }

    // Recompute SLA targets when priority, start date, or type changes for REQUEST tickets
    let nextSlaTargetMinutes = existingTicket.slaTargetMinutes;
    let nextSlaDueAt = existingTicket.slaDueAt;
    if (nextTicketType === "REQUEST") {
      if (
        body.priority !== undefined ||
        body.startDate !== undefined ||
        body.ticketType !== undefined ||
        !existingTicket.slaDueAt
      ) {
        const policies = await prisma.slaPolicy.findMany({
          select: {
            priority: true,
            firstResponseMinutes: true,
            targetMinutes: true,
            reminderThresholdPercent: true,
          },
        });
        const matched = resolveSlaPolicy(nextPriority, policies);
        if (matched) {
          nextSlaTargetMinutes = matched.targetMinutes;
          nextSlaDueAt = computeSlaDueAt(nextStartDate, matched.targetMinutes);
        }
      }
    } else {
      nextSlaTargetMinutes = null;
      nextSlaDueAt = null;
    }

    const executorIds: string[] | undefined = Array.isArray(body.executorIds)
      ? body.executorIds.filter((eid: unknown): eid is string => typeof eid === "string" && eid.trim().length > 0)
      : undefined;

    const candidateAssetId =
      body.assetId !== undefined
        ? typeof body.assetId === "string" && body.assetId.trim()
          ? body.assetId.trim()
          : null
        : undefined;

    const validation = await validateSupportRefs({
      assetId: candidateAssetId,
      executorIds,
    });
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        taskName:
          typeof body.taskName === "string" && body.taskName.trim()
            ? body.taskName.trim()
            : existingTicket.taskName,
        supportType:
          typeof body.supportType === "string" && body.supportType.trim()
            ? body.supportType.trim()
            : existingTicket.supportType,
        module:
          typeof body.module === "string" && body.module.trim()
            ? body.module.trim()
            : existingTicket.module,
        area:
          body.area !== undefined
            ? typeof body.area === "string"
              ? body.area.trim() || null
              : null
            : existingTicket.area,
        startDate: nextStartDate,
        startedAt:
          nextStatus === "Ongoing" && !existingTicket.startedAt ? now : existingTicket.startedAt,
        endDate: nextEndDate,
        slaTargetMinutes: nextSlaTargetMinutes,
        slaDueAt: nextSlaDueAt,
        issue:
          body.issue !== undefined
            ? typeof body.issue === "string"
              ? body.issue.trim() || null
              : null
            : existingTicket.issue,
        solution:
          body.solution !== undefined
            ? typeof body.solution === "string"
              ? body.solution.trim() || null
              : null
            : existingTicket.solution,
        status: nextStatus,
        priority: nextPriority,
        attachment:
          body.attachment !== undefined
            ? typeof body.attachment === "string"
              ? body.attachment.trim() || null
              : null
            : existingTicket.attachment,
        attachmentKey:
          body.attachmentKey !== undefined
            ? typeof body.attachmentKey === "string"
              ? body.attachmentKey.trim() || null
              : null
            : existingTicket.attachmentKey,
        link:
          body.link !== undefined
            ? typeof body.link === "string"
              ? body.link.trim() || null
              : null
            : existingTicket.link,
        ticketType: nextTicketType,
        requesterName:
          body.requesterName !== undefined
            ? typeof body.requesterName === "string"
              ? body.requesterName.trim() || null
              : null
            : existingTicket.requesterName,
        requesterEmail:
          body.requesterEmail !== undefined
            ? typeof body.requesterEmail === "string"
              ? body.requesterEmail.trim() || null
              : null
            : existingTicket.requesterEmail,
        assetId:
          body.assetId !== undefined
            ? typeof body.assetId === "string" && body.assetId.trim()
              ? body.assetId.trim()
              : null
            : existingTicket.assetId,
        ...(executorIds !== undefined
          ? { executors: { set: executorIds.map((uId) => ({ id: uId })) } }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, jobDesk: true, photo: true } },
        executors: { select: { id: true, name: true, jobDesk: true, photo: true } },
        asset: { select: { id: true, assetCode: true, assetName: true, location: true } },
        timeLogs: {
          include: { user: { select: { id: true, name: true, photo: true } } },
          orderBy: { startTime: "desc" },
        },
        promotedTasks: {
          select: { id: true, title: true, status: true, project: { select: { id: true, name: true } } },
        },
        comments: { select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        commentReadStatuses: { where: { userId: auth.user.id } },
      },
    });

    // Hybrid time tracking sync on status transition
    let timeLogMutated = false;
    if (nextStatus === "Ongoing" && existingTicket.status !== "Ongoing") {
      await openAutoTimeLogForTicket(ticket.id, auth.user.id, now);
      timeLogMutated = true;
    } else if (
      (nextStatus === "Done" || nextStatus === "Suspended" || nextStatus === "Not Started") &&
      existingTicket.status === "Ongoing"
    ) {
      await closeOpenTimeLogsForTicket(ticket.id, now);
      timeLogMutated = true;
    } else if (nextStatus === "Done") {
      const closed = await closeOpenTimeLogsForTicket(ticket.id, now);
      timeLogMutated = closed > 0;
    }
    const freshTimeLogs = timeLogMutated
      ? await fetchTicketTimeLogs(ticket.id)
      : ticket.timeLogs;

    return NextResponse.json({ ...ticket, timeLogs: freshTimeLogs });
  } catch (error) {
    console.error("Failed to update ticket:", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    await prisma.supportTicket.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete ticket:", error);
    return NextResponse.json({ error: "Failed to delete ticket" }, { status: 500 });
  }
}
