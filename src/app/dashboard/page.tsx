import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import DashboardClient from "@/components/views/DashboardClient";
import type { DashboardDataset } from "@/lib/kpi-engine";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = await decrypt(sessionCookie);

  if (!session || !session.userId) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, jobDesk: true, role: true, isActive: true },
  });

  if (!currentUser || currentUser.isActive === false) {
    redirect("/login");
  }

  const [
    users,
    projects,
    tasks,
    supportTickets,
    timeLogs,
    assets,
    maintenanceSchedules,
    maintenanceLogs,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        jobDesk: true,
        photo: true,
        isActive: true,
        canManageMaintenance: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      include: {
        projectMembers: { select: { userId: true } },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.task.findMany({
      select: {
        id: true,
        projectId: true,
        parentId: true,
        title: true,
        issue: true,
        executor: true,
        userId: true,
        status: true,
        priority: true,
        startDate: true,
        endDate: true,
        actualEndDate: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
        executors: {
          select: {
            userId: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.supportTicket.findMany({
      select: {
        id: true,
        ticketNumber: true,
        userId: true,
        taskName: true,
        issue: true,
        supportType: true,
        module: true,
        priority: true,
        status: true,
        ticketType: true,
        startDate: true,
        endDate: true,
        slaTargetMinutes: true,
        slaDueAt: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, name: true } },
        executors: { select: { id: true, name: true } },
      },
    }),
    prisma.timeLog.findMany({
      select: {
        id: true,
        userId: true,
        taskId: true,
        supportTicketId: true,
        startTime: true,
        endTime: true,
        duration: true,
        durationSeconds: true,
      },
    }),
    prisma.asset.findMany({
      select: {
        id: true,
        assetCode: true,
        assetName: true,
        status: true,
        location: true,
        warrantyEndDate: true,
        qrPrintedAt: true,
        division: { select: { id: true, name: true } },
        locationRef: { select: { id: true, name: true } },
      },
    }),
    prisma.maintenanceSchedule.findMany({
      select: {
        id: true,
        assetId: true,
        status: true,
        nextDueDate: true,
        scheduleType: true,
        asset: {
          select: {
            id: true,
            assetCode: true,
            assetName: true,
            location: true,
            division: { select: { id: true, name: true } },
          },
        },
        template: { select: { templateName: true } },
        assignedExecutors: { select: { id: true, name: true } },
      },
      orderBy: { nextDueDate: "asc" },
    }),
    prisma.maintenanceLog.findMany({
      select: {
        id: true,
        scheduleId: true,
        executedById: true,
        executionDate: true,
        overallCondition: true,
        findings: true,
        schedule: { select: { assetId: true } },
      },
    }),
  ]);

  const dataset: DashboardDataset = {
    users,
    projects,
    tasks: tasks.map((t) => ({
      ...t,
      taskExecutors: t.executors,
    })),
    supportTickets,
    timeLogs,
    assets,
    maintenanceSchedules,
    maintenanceLogs: maintenanceLogs.map((ml) => ({
      id: ml.id,
      assetId: ml.schedule.assetId,
      scheduleId: ml.scheduleId,
      executedById: ml.executedById,
      executionDate: ml.executionDate,
      overallCondition: ml.overallCondition,
      findings: ml.findings,
    })),
  };

  return (
    <DashboardClient
      currentUser={{
        id: currentUser.id,
        name: currentUser.name,
        jobDesk: currentUser.jobDesk,
        role: currentUser.role,
      }}
      dataset={dataset}
      generatedAtIso={new Date().toISOString()}
    />
  );
}
