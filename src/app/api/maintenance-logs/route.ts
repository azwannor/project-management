import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

// POST /api/maintenance-logs — Submit maintenance log (Assigned executors only)
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { scheduleId, checklistResults, overallCondition, findings, followUpNeeded, attachment } = body;

    // Validasi field wajib
    if (!scheduleId) {
      return NextResponse.json({ error: "scheduleId is required" }, { status: 400 });
    }
    if (!overallCondition || !["BAIK", "PERLU_PERHATIAN", "BERMASALAH"].includes(overallCondition)) {
      return NextResponse.json({ error: "overallCondition harus BAIK, PERLU_PERHATIAN, atau BERMASALAH" }, { status: 400 });
    }

    // Ambil schedule + validasi
    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        assignedExecutors: { select: { id: true } },
        asset: { select: { id: true, assetCode: true, assetName: true, location: true, division: { select: { name: true } } } },
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
      return NextResponse.json({ error: "Schedule is already DONE. Cannot submit log anymore." }, { status: 400 });
    }

    // Cek apakah user adalah salah satu assigned executor
    const isAssigned = schedule.assignedExecutors.some(e => e.id === session.userId);
    if (!isAssigned && session.role !== "Admin") {
      return NextResponse.json(
        { error: "You are not assigned as an executor for this maintenance schedule." },
        { status: 403 }
      );
    }

    // Siapkan checklist results sebagai snapshot
    // Jika checklistResults disediakan dari frontend, gunakan itu
    // Jika tidak, buat snapshot dari template checklist items
    let finalChecklistResults = checklistResults || [];
    if (finalChecklistResults.length === 0 && schedule.template?.checklistItems) {
      finalChecklistResults = schedule.template.checklistItems.map(item => ({
        itemText: item.itemText,
        checked: false,
        note: null,
      }));
    }

    const executionDate = new Date();

    // Jalankan semua operasi dalam transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create MaintenanceLog + ChecklistResult (snapshot)
      const log = await tx.maintenanceLog.create({
        data: {
          scheduleId,
          executedById: session.userId as string,
          executionDate,
          overallCondition,
          findings: findings || null,
          followUpNeeded: followUpNeeded || false,
          attachment: attachment || null,
          checklistResults: {
            create: finalChecklistResults.map((item: any) => ({
              itemText: item.itemText,       // Snapshot text — bukan relasi ke master
              checked: item.checked ?? false,
              note: item.note || null,
            })),
          },
        },
        include: {
          executedBy: { select: { id: true, name: true } },
          checklistResults: true,
        },
      });

      // 2. Update schedule status ke DONE
      await tx.maintenanceSchedule.update({
        where: { id: scheduleId },
        data: { status: "DONE" },
      });

      // 3. Auto-generate next schedule jika RECURRING
      let nextSchedule: any = null;
      if (schedule.scheduleType === "RECURRING") {
        const freqDays = schedule.frequencyDays || schedule.template?.defaultFrequencyDays || 30;
        const nextDueDate = new Date(executionDate);
        nextDueDate.setDate(nextDueDate.getDate() + freqDays);

        // Copy executor assignment yang sama
        const executorConnections = schedule.assignedExecutors.map(e => ({ id: e.id }));

        nextSchedule = await tx.maintenanceSchedule.create({
          data: {
            scheduleType: "RECURRING",
            assetId: schedule.asset.id,
            templateId: schedule.template?.id || null,
            frequencyDays: schedule.frequencyDays,
            nextDueDate,
            status: "UPCOMING",
            assignedExecutors: executorConnections.length > 0
              ? { connect: executorConnections }
              : undefined,
          },
          include: {
            assignedExecutors: { select: { id: true, name: true } },
          },
        });

        // Buat notifikasi untuk executor tentang jadwal berikutnya
        if (executorConnections.length > 0) {
          await tx.notification.createMany({
            data: executorConnections.map(e => ({
              userId: e.id,
              title: "Jadwal Maintenance Berikutnya",
              message: `Jadwal maintenance "${schedule.asset.assetName}" berikutnya: ${nextDueDate.toLocaleDateString("id-ID")}.`,
              type: "SYSTEM",
              link: `/maintenance/schedules/${nextSchedule.id}`,
            })),
          });
        }
      }

      return { log, nextSchedule };
    });

    // 4. Siapkan follow-up data jika followUpNeeded
    let followUpData = null;
    if (followUpNeeded) {
      followUpData = {
        suggestedTicket: {
          taskName: `[Follow-up Maintenance] ${schedule.asset.assetName} - ${schedule.asset.assetCode}`,
          supportType: "Maintenance & Server Check",
          module: "IT Asset Management",
          area: schedule.asset.location,
          issue: findings || `Issue found during routine maintenance. Condition: ${overallCondition}`,
          priority: overallCondition === "BERMASALAH" ? "High" : "Normal",
          ticketType: "REQUEST",
          requesterName: session.name,
          maintenanceLogId: result.log.id,
        },
        message: "Maintenance memerlukan follow-up. Gunakan data di atas untuk membuat Support Ticket.",
      };
    }

    return NextResponse.json({
      log: result.log,
      scheduleStatus: "DONE",
      nextSchedule: result.nextSchedule,
      followUp: followUpData,
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to submit maintenance log:", error);
    return NextResponse.json({ error: "Failed to submit maintenance log" }, { status: 500 });
  }
}

// GET /api/maintenance-logs — List logs (All authenticated, filtered)
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get("scheduleId");
    const assetId = searchParams.get("assetId");
    const executedById = searchParams.get("executedById");
    const overallCondition = searchParams.get("overallCondition");

    const where: any = {};
    if (scheduleId) where.scheduleId = scheduleId;
    if (executedById) where.executedById = executedById;
    if (overallCondition) where.overallCondition = overallCondition;
    if (assetId) {
      where.schedule = { assetId };
    }

    // Staff hanya bisa lihat log dari schedule mereka
    if (session.role !== "Admin") {
      where.schedule = {
        ...where.schedule,
        assignedExecutors: { some: { id: session.userId } },
      };
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
            asset: { select: { id: true, assetCode: true, assetName: true, location: true, division: { select: { name: true } } } },
          },
        },
        checklistResults: true,
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to fetch maintenance logs:", error);
    return NextResponse.json({ error: "Failed to fetch maintenance logs" }, { status: 500 });
  }
}
