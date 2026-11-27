import { Prisma, ScheduleStatus, ScheduleType } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isMaintenanceAdmin } from "@/lib/auth";

const SCHEDULE_INCLUDE = {
  asset: {
    select: {
      id: true,
      assetCode: true,
      assetName: true,
      location: true,
      detailedLocation: true,
      division: { select: { id: true, name: true } },
      assetType: { select: { id: true, name: true } },
    },
  },
  template: {
    select: {
      id: true,
      templateName: true,
      defaultFrequencyDays: true,
      reminderOffsetDays: true,
      checklistItems: { orderBy: { order: "asc" as const } },
    },
  },
  assignedExecutors: { select: { id: true, name: true, photo: true } },
  _count: { select: { logs: true } },
};

// GET /api/maintenance-schedules — List schedules with optional filters
export async function GET(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const assetId = searchParams.get("assetId");
    const divisionId = searchParams.get("divisionId");
    const scheduleType = searchParams.get("scheduleType");

    const where: Prisma.MaintenanceScheduleWhereInput = {};
    if (status && ["UPCOMING", "DUE", "OVERDUE", "DONE"].includes(status)) {
      where.status = status as ScheduleStatus;
    }
    if (assetId) where.assetId = assetId;
    if (scheduleType && ["RECURRING", "ADHOC"].includes(scheduleType)) {
      where.scheduleType = scheduleType as ScheduleType;
    }
    if (divisionId) {
      where.asset = { divisionId };
    }

    if (!isMaintenanceAdmin(auth.user)) {
      where.assignedExecutors = {
        some: { id: auth.user.id },
      };
    }

    const schedules = await prisma.maintenanceSchedule.findMany({
      where,
      orderBy: { nextDueDate: "asc" },
      include: SCHEDULE_INCLUDE,
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Failed to fetch schedules:", error);
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}

// POST /api/maintenance-schedules — Create schedule (Admin: RECURRING/ADHOC, Staff: ADHOC)
export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { scheduleType, assetId, templateId, frequencyDays, nextDueDate, executorIds } = body;

    if (!isMaintenanceAdmin(auth.user) && scheduleType !== "ADHOC") {
      return NextResponse.json(
        { error: "Staff hanya bisa membuat jadwal ad-hoc." },
        { status: 403 }
      );
    }

    if (!scheduleType || !["RECURRING", "ADHOC"].includes(scheduleType)) {
      return NextResponse.json(
        { error: "scheduleType must be RECURRING or ADHOC" },
        { status: 400 }
      );
    }
    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }
    if (!nextDueDate) {
      return NextResponse.json({ error: "nextDueDate is required" }, { status: 400 });
    }
    const parsedDue = new Date(nextDueDate);
    if (Number.isNaN(parsedDue.getTime())) {
      return NextResponse.json({ error: "Invalid nextDueDate" }, { status: 400 });
    }
    if (scheduleType === "RECURRING" && !templateId) {
      return NextResponse.json(
        { error: "templateId is required for RECURRING schedules" },
        { status: 400 }
      );
    }

    const asset = await prisma.asset.findUnique({
      where: { id: String(assetId) },
      select: { id: true, location: true, detailedLocation: true, assetName: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    let finalFrequencyDays: number | null = null;
    if (scheduleType === "RECURRING") {
      if (frequencyDays !== undefined && frequencyDays !== null && frequencyDays !== "") {
        const parsedFreq = Number(frequencyDays);
        if (!Number.isInteger(parsedFreq) || parsedFreq < 1 || parsedFreq > 730) {
          return NextResponse.json(
            { error: "frequencyDays must be an integer between 1 and 730" },
            { status: 400 }
          );
        }
        finalFrequencyDays = parsedFreq;
      } else if (templateId) {
        const template = await prisma.maintenanceTemplate.findUnique({
          where: { id: String(templateId) },
          select: { defaultFrequencyDays: true },
        });
        if (!template) {
          return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }
        finalFrequencyDays = template.defaultFrequencyDays;
      }
    } else if (templateId) {
      const template = await prisma.maintenanceTemplate.findUnique({
        where: { id: String(templateId) },
        select: { id: true },
      });
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
    }

    if (Array.isArray(executorIds) && executorIds.length > 0) {
      const cleanIds = Array.from(
        new Set(
          executorIds.filter((eid: unknown): eid is string => typeof eid === "string" && eid.trim().length > 0)
        )
      );
      const validUsers = await prisma.user.findMany({
        where: { id: { in: cleanIds }, isActive: true },
        select: { id: true },
      });
      if (validUsers.length !== cleanIds.length) {
        return NextResponse.json(
          { error: "One or more selected executors are invalid or inactive" },
          { status: 400 }
        );
      }
    }

    const rawExecutors: string[] = Array.isArray(executorIds)
      ? Array.from(
          new Set(
            executorIds.filter(
              (eid: unknown): eid is string => typeof eid === "string" && eid.trim().length > 0
            )
          )
        )
      : [];
    let finalExecutorIds = rawExecutors;

    if (finalExecutorIds.length === 0) {
      const areaCandidates = [asset.detailedLocation, asset.location].filter(
        (v): v is string => Boolean(v && v.trim())
      );
      if (areaCandidates.length > 0) {
        const locationExecutors = await prisma.user.findMany({
          where: {
            isActive: true,
            handledAreas: { hasSome: areaCandidates },
          },
          select: { id: true },
        });
        finalExecutorIds = locationExecutors.map((u) => u.id);
      }
    }

    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        scheduleType: scheduleType as ScheduleType,
        assetId: asset.id,
        templateId: templateId ? String(templateId) : null,
        frequencyDays: finalFrequencyDays,
        nextDueDate: parsedDue,
        assignedExecutors:
          finalExecutorIds.length > 0
            ? { connect: finalExecutorIds.map((uid) => ({ id: uid })) }
            : undefined,
      },
      include: SCHEDULE_INCLUDE,
    });

    if (finalExecutorIds.length > 0) {
      await prisma.notification.createMany({
        data: finalExecutorIds.map((userId) => ({
          userId,
          title: "Jadwal Maintenance Baru",
          message: `Anda ditugaskan untuk maintenance "${asset.assetName}" pada ${parsedDue.toLocaleDateString("id-ID")}.`,
          type: "ASSIGNMENT",
          link: `/maintenance/schedules/${schedule.id}`,
        })),
      });
    }

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    console.error("Failed to create schedule:", error);
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }
}
