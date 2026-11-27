import { Prisma, ScheduleStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isMaintenanceAdmin } from "@/lib/auth";

// GET /api/maintenance-schedules/[id] — Schedule detail & checklist logs
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
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
            checklistItems: { orderBy: { order: "asc" } },
          },
        },
        assignedExecutors: { select: { id: true, name: true, photo: true } },
        logs: {
          orderBy: { executionDate: "desc" },
          include: {
            executedBy: { select: { id: true, name: true } },
            checklistResults: true,
            supportTicket: { select: { id: true, ticketNumber: true, status: true } },
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    if (!isMaintenanceAdmin(auth.user)) {
      const isAssigned = schedule.assignedExecutors.some((e) => e.id === auth.user.id);
      if (!isAssigned) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error("Failed to fetch schedule:", error);
    return NextResponse.json({ error: "Failed to fetch schedule" }, { status: 500 });
  }
}

// PATCH /api/maintenance-schedules/[id] — Update schedule (Admin only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json(
      { error: "Forbidden. Only maintenance admins can update schedules." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { frequencyDays, nextDueDate, status, executorIds, templateId } = body;

    const updateData: Prisma.MaintenanceScheduleUncheckedUpdateInput = {};
    if (frequencyDays !== undefined) {
      if (frequencyDays === null || frequencyDays === "") {
        updateData.frequencyDays = null;
      } else {
        const parsedFreq = Number(frequencyDays);
        if (!Number.isInteger(parsedFreq) || parsedFreq < 1 || parsedFreq > 730) {
          return NextResponse.json(
            { error: "frequencyDays must be an integer between 1 and 730" },
            { status: 400 }
          );
        }
        updateData.frequencyDays = parsedFreq;
      }
    }
    if (nextDueDate !== undefined) {
      const d = new Date(nextDueDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid nextDueDate" }, { status: 400 });
      }
      updateData.nextDueDate = d;
    }
    if (status !== undefined) {
      if (!["UPCOMING", "DUE", "OVERDUE", "DONE"].includes(String(status))) {
        return NextResponse.json({ error: "Invalid schedule status" }, { status: 400 });
      }
      updateData.status = status as ScheduleStatus;
    }
    if (templateId !== undefined) {
      if (templateId) {
        const tpl = await prisma.maintenanceTemplate.findUnique({
          where: { id: String(templateId) },
          select: { id: true },
        });
        if (!tpl) {
          return NextResponse.json({ error: "Template not found" }, { status: 400 });
        }
        updateData.templateId = tpl.id;
      } else {
        updateData.templateId = null;
      }
    }

    if (Array.isArray(executorIds)) {
      const cleanIds = Array.from(
        new Set(
          executorIds.filter((uid: unknown): uid is string => typeof uid === "string" && uid.trim().length > 0)
        )
      );
      if (cleanIds.length > 0) {
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
      updateData.assignedExecutors = {
        set: cleanIds.map((uid) => ({ id: uid })),
      };
    }

    const schedule = await prisma.maintenanceSchedule.update({
      where: { id },
      data: updateData,
      include: {
        asset: {
          select: {
            id: true,
            assetCode: true,
            assetName: true,
            location: true,
            division: { select: { id: true, name: true } },
            assetType: { select: { id: true, name: true } },
          },
        },
        template: { select: { id: true, templateName: true } },
        assignedExecutors: { select: { id: true, name: true, photo: true } },
      },
    });

    return NextResponse.json(schedule);
  } catch (error: unknown) {
    console.error("Failed to update schedule:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

// DELETE /api/maintenance-schedules/[id] — Delete schedule when it has no logs (Admin only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json(
      { error: "Forbidden. Only maintenance admins can delete schedules." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: { _count: { select: { logs: true } } },
    });
    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    if (schedule._count.logs > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete. There are already ${schedule._count.logs} maintenance logs recorded.`,
        },
        { status: 400 }
      );
    }

    await prisma.maintenanceSchedule.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Failed to delete schedule:", error);
    return NextResponse.json({ error: "Failed to delete schedule" }, { status: 500 });
  }
}
