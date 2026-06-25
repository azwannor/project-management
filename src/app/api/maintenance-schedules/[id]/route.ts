import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

// GET /api/maintenance-schedules/[id] — Detail schedule (All authenticated)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        asset: {
          select: { id: true, assetCode: true, assetName: true, location: true, division: { select: { id: true, name: true } } },
          include: { assetType: { select: { id: true, name: true } } },
        },
        template: {
          select: {
            id: true, templateName: true, defaultFrequencyDays: true, reminderOffsetDays: true,
            checklistItems: { orderBy: { order: "asc" } },
          },
        },
        assignedExecutors: { select: { id: true, name: true } },
        logs: {
          orderBy: { executionDate: "desc" },
          include: {
            executedBy: { select: { id: true, name: true } },
            checklistResults: true,
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    // Staff hanya bisa lihat schedule mereka sendiri
    if (session.role !== "Admin") {
      const isAssigned = schedule.assignedExecutors.some(e => e.id === session.userId);
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
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden. Only admins can update schedules." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { frequencyDays, nextDueDate, status, executorIds, templateId } = body;

    const updateData: any = {};
    if (frequencyDays !== undefined) updateData.frequencyDays = frequencyDays;
    if (nextDueDate !== undefined) updateData.nextDueDate = new Date(nextDueDate);
    if (status !== undefined) updateData.status = status;
    if (templateId !== undefined) updateData.templateId = templateId;

    if (executorIds !== undefined) {
      updateData.assignedExecutors = {
        set: executorIds.map((uid: string) => ({ id: uid })),
      };
    }

    const schedule = await prisma.maintenanceSchedule.update({
      where: { id },
      data: updateData,
      include: {
        asset: { select: { id: true, assetCode: true, assetName: true, location: true, division: { select: { id: true, name: true } } } },
        template: { select: { id: true, templateName: true } },
        assignedExecutors: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(schedule);
  } catch (error: any) {
    console.error("Failed to update schedule:", error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update schedule" }, { status: 500 });
  }
}

// DELETE /api/maintenance-schedules/[id] — Delete schedule (Admin only, hanya jika belum ada log)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden. Only admins can delete schedules." }, { status: 403 });
    }

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
        { error: `Cannot delete. There are already ${schedule._count.logs} maintenance logs recorded.` },
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
