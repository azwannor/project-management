import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

// GET /api/maintenance-schedules — List schedules dengan filter (All authenticated)
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const assetId = searchParams.get("assetId");
    const area = searchParams.get("area");
    const scheduleType = searchParams.get("scheduleType");

    const where: any = {};

    if (status) where.status = status;
    if (assetId) where.assetId = assetId;
    if (scheduleType) where.scheduleType = scheduleType;
    if (area) {
      where.asset = { area };
    }

    // Staff hanya bisa lihat schedule yang di-assign ke mereka
    if (session.role !== "Admin") {
      where.assignedExecutors = {
        some: { id: session.userId },
      };
    }

    const schedules = await prisma.maintenanceSchedule.findMany({
      where,
      orderBy: { nextDueDate: "asc" },
      include: {
        asset: {
          select: { id: true, assetCode: true, assetName: true, area: true },
          include: { assetType: { select: { id: true, name: true } } },
        },
        template: { select: { id: true, templateName: true, defaultFrequencyDays: true } },
        assignedExecutors: { select: { id: true, name: true } },
        _count: { select: { logs: true } },
      },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Failed to fetch schedules:", error);
    return NextResponse.json({ error: "Failed to fetch schedules" }, { status: 500 });
  }
}

// POST /api/maintenance-schedules — Create schedule (Admin: semua, Staff: ADHOC saja)
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { scheduleType, assetId, templateId, frequencyDays, nextDueDate, executorIds } = body;

    // Staff hanya boleh buat ADHOC
    if (session.role !== "Admin" && scheduleType !== "ADHOC") {
      return NextResponse.json({ error: "Staff hanya bisa membuat jadwal ad-hoc." }, { status: 403 });
    }

    // Validasi field wajib
    if (!scheduleType || !["RECURRING", "ADHOC"].includes(scheduleType)) {
      return NextResponse.json({ error: "scheduleType harus RECURRING atau ADHOC" }, { status: 400 });
    }
    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }
    if (!nextDueDate) {
      return NextResponse.json({ error: "nextDueDate is required" }, { status: 400 });
    }
    if (scheduleType === "RECURRING" && !templateId) {
      return NextResponse.json({ error: "templateId is required for RECURRING schedules" }, { status: 400 });
    }

    // Ambil asset untuk dapatkan area (digunakan untuk auto-assign)
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, area: true, assetName: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Resolve frequencyDays
    let finalFrequencyDays = frequencyDays || null;
    if (scheduleType === "RECURRING" && !finalFrequencyDays && templateId) {
      const template = await prisma.maintenanceTemplate.findUnique({
        where: { id: templateId },
        select: { defaultFrequencyDays: true },
      });
      if (template) {
        finalFrequencyDays = template.defaultFrequencyDays;
      }
    }

    // Auto-assign executors jika tidak disediakan
    // Reuse logic dari modul Support: cari User yang handledAreas mengandung area asset
    let finalExecutorIds = executorIds || [];
    if (finalExecutorIds.length === 0) {
      const areaExecutors = await prisma.user.findMany({
        where: {
          handledAreas: {
            has: asset.area,
          },
        },
        select: { id: true },
      });
      finalExecutorIds = areaExecutors.map((u: { id: string }) => u.id);
    }

    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        scheduleType,
        assetId,
        templateId: templateId || null,
        frequencyDays: finalFrequencyDays,
        nextDueDate: new Date(nextDueDate),
        assignedExecutors: finalExecutorIds.length > 0
          ? { connect: finalExecutorIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: {
        asset: {
          select: { id: true, assetCode: true, assetName: true, area: true },
        },
        template: { select: { id: true, templateName: true } },
        assignedExecutors: { select: { id: true, name: true } },
      },
    });

    // Buat notifikasi untuk setiap executor yang di-assign
    if (finalExecutorIds.length > 0) {
      await prisma.notification.createMany({
        data: finalExecutorIds.map((userId: string) => ({
          userId,
          title: "Jadwal Maintenance Baru",
          message: `Anda di-assign untuk maintenance "${asset.assetName}" pada ${new Date(nextDueDate).toLocaleDateString("id-ID")}.`,
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
