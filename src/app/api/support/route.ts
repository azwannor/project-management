import { NextResponse } from "next/server";
import { TicketSource } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { openAutoTimeLogForTicket } from "@/lib/timelog";
import { fetchTicketTimeLogs, validateSupportRefs } from "@/lib/support-validation";
import {
  computeSlaDueAt,
  formatNextTicketNumber,
  normalizeSupportPriority,
  resolveSlaPolicy,
} from "@/lib/support-helpers";

const VALID_SOURCES = new Set<TicketSource>(["MANUAL", "EXTERNAL_APP", "QR_SCAN", "MAINTENANCE"]);

export async function GET() {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tickets = await prisma.supportTicket.findMany({
      include: {
        user: { select: { id: true, name: true, jobDesk: true, photo: true } },
        executors: { select: { id: true, name: true, jobDesk: true, photo: true } },
        asset: { select: { id: true, assetCode: true, assetName: true, location: true } },
        timeLogs: {
          include: { user: { select: { id: true, name: true, photo: true } } },
          orderBy: { startTime: "desc" },
        },
        promotedTasks: {
          select: {
            id: true,
            title: true,
            status: true,
            project: { select: { id: true, name: true } },
          },
        },
        comments: {
          select: { id: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        commentReadStatuses: {
          where: { userId: auth.user.id },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tickets);
  } catch (error) {
    console.error("Failed to fetch tickets:", error);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const taskName = typeof body.taskName === "string" ? body.taskName.trim() : "";
    if (!taskName) {
      return NextResponse.json({ error: "Ticket title is required" }, { status: 400 });
    }

    const supportType =
      typeof body.supportType === "string" && body.supportType.trim()
        ? body.supportType.trim()
        : "Lainnya...";
    const ticketModule =
      typeof body.module === "string" && body.module.trim()
        ? body.module.trim()
        : "General IT / Lainnya...";
    const ticketType = body.ticketType === "REQUEST" ? "REQUEST" : "DAILY_ACTIVITY";
    const status =
      typeof body.status === "string" && body.status.trim()
        ? body.status.trim()
        : ticketType === "REQUEST"
          ? "Not Started"
          : "Ongoing";
    const priority = normalizeSupportPriority(body.priority);

    const now = new Date();
    const startDate = body.startDate ? new Date(body.startDate) : now;
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }

    const endDate =
      ticketType === "REQUEST"
        ? status === "Done"
          ? now
          : null
        : body.endDate
          ? new Date(body.endDate)
          : status === "Done"
            ? now
            : null;
    if (endDate && Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
    }

    const area = typeof body.area === "string" && body.area.trim() ? body.area.trim() : null;
    const explicitExecutorIds: string[] = Array.isArray(body.executorIds)
      ? body.executorIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

    // Check DB SupportCategory requiresArea or legacy "Master Data" auto-assignment
    let finalExecutorIds = explicitExecutorIds;
    if (ticketType === "REQUEST" && area && finalExecutorIds.length === 0) {
      const cat = await prisma.supportCategory.findFirst({
        where: { name: supportType, module: { name: ticketModule } },
        select: { requiresArea: true },
      });
      if (cat?.requiresArea || supportType === "Master Data") {
        const areaExecutors = await prisma.user.findMany({
          where: { isActive: true, handledAreas: { has: area } },
          select: { id: true },
        });
        if (areaExecutors.length > 0) {
          finalExecutorIds = areaExecutors.map((u) => u.id);
        }
      }
    }

    // Generate next sequential ticketNumber SUP-YYYY-XXXX & resolve SLA policy
    const currentYear = now.getFullYear();
    const yearPrefix = `SUP-${currentYear}-`;
    const [latestTicket, slaPolicies] = await Promise.all([
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

    const ticketNumber = formatNextTicketNumber(latestTicket?.ticketNumber, currentYear);
    const matchedPolicy = ticketType === "REQUEST" ? resolveSlaPolicy(priority, slaPolicies) : null;
    const slaTargetMinutes = matchedPolicy?.targetMinutes ?? null;
    const slaDueAt = matchedPolicy ? computeSlaDueAt(startDate, slaTargetMinutes) : null;

    const rawSource = typeof body.sourceType === "string" ? body.sourceType.toUpperCase() : "MANUAL";
    const sourceType: TicketSource = VALID_SOURCES.has(rawSource as TicketSource)
      ? (rawSource as TicketSource)
      : TicketSource.MANUAL;

    const assetId =
      typeof body.assetId === "string" && body.assetId.trim() ? body.assetId.trim() : null;

    const validation = await validateSupportRefs({
      assetId,
      executorIds: finalExecutorIds,
    });
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: auth.user.id,
        taskName,
        supportType,
        module: ticketModule,
        area,
        startDate,
        startedAt: status === "Ongoing" ? now : null,
        endDate,
        slaTargetMinutes,
        slaDueAt,
        issue: typeof body.issue === "string" ? body.issue.trim() || null : null,
        solution: typeof body.solution === "string" ? body.solution.trim() || null : null,
        status,
        priority,
        attachment: typeof body.attachment === "string" ? body.attachment.trim() || null : null,
        attachmentKey:
          typeof body.attachmentKey === "string" ? body.attachmentKey.trim() || null : null,
        link: typeof body.link === "string" ? body.link.trim() || null : null,
        ticketType,
        requesterName:
          typeof body.requesterName === "string" ? body.requesterName.trim() || null : null,
        requesterEmail:
          typeof body.requesterEmail === "string" ? body.requesterEmail.trim() || null : null,
        sourceType,
        sourceApp: typeof body.sourceApp === "string" ? body.sourceApp.trim() || null : null,
        sourceMenu: typeof body.sourceMenu === "string" ? body.sourceMenu.trim() || null : null,
        sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl.trim() || null : null,
        assetId,
        ...(finalExecutorIds.length > 0
          ? { executors: { connect: finalExecutorIds.map((id) => ({ id })) } }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, jobDesk: true, photo: true } },
        executors: {
          select: { id: true, name: true, jobDesk: true, photo: true, telegramUsername: true },
        },
        asset: { select: { id: true, assetCode: true, assetName: true, location: true } },
        timeLogs: true,
        promotedTasks: {
          select: { id: true, title: true, status: true, project: { select: { id: true, name: true } } },
        },
        comments: { select: { id: true, createdAt: true }, take: 1 },
        commentReadStatuses: { where: { userId: auth.user.id } },
      },
    });

    let freshTimeLogs = ticket.timeLogs;
    if (status === "Ongoing") {
      await openAutoTimeLogForTicket(ticket.id, auth.user.id, now);
      freshTimeLogs = await fetchTicketTimeLogs(ticket.id);
    }

    // In-app assignment notifications + Telegram alert for REQUEST queue tickets
    if (ticketType === "REQUEST") {
      if (ticket.executors.length > 0) {
        await prisma.notification.createMany({
          data: ticket.executors.map((u) => ({
            userId: u.id,
            title: `Support Ticket: ${ticket.ticketNumber || "New"}`,
            message: `${ticket.taskName} (${ticket.module} · ${ticket.priority})`,
            type: "ASSIGNMENT",
            link: `/support?ticket=${ticket.id}`,
          })),
        });
      }
    }

    return NextResponse.json({ ...ticket, timeLogs: freshTimeLogs }, { status: 201 });
  } catch (error) {
    console.error("Failed to create ticket:", error);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
