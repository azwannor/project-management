import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";
import prisma from "@/lib/prisma";
import MaintenanceClient from "@/components/views/MaintenanceClient";
import { Wrench } from "lucide-react";
import { redirect } from "next/navigation";

export default async function MaintenancePage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = await decrypt(sessionCookie);

  if (!session || !session.userId) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { id: true, name: true, jobDesk: true, role: true, handledAreas: true }
  });

  if (!currentUser) redirect("/login");

  const [divisions, assetTypes, assets, templates, schedules, logs, allUsers] = await Promise.all([
    prisma.division.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { assets: true } } },
    }),
    prisma.assetType.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { assets: true, templates: true } } },
    }),
    prisma.asset.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assetType: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        pic: { select: { id: true, name: true } },
        _count: { select: { schedules: true } },
      },
    }),
    prisma.maintenanceTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        assetType: { select: { id: true, name: true } },
        checklistItems: { orderBy: { order: "asc" } },
        _count: { select: { schedules: true } },
      },
    }),
    prisma.maintenanceSchedule.findMany({
      orderBy: { nextDueDate: "asc" },
      include: {
        asset: {
          select: { 
            id: true, 
            assetCode: true, 
            assetName: true, 
            location: true,
            division: { select: { id: true, name: true } },
            assetType: { select: { id: true, name: true } }
          },
        },
        template: { select: { id: true, templateName: true, defaultFrequencyDays: true, reminderOffsetDays: true, checklistItems: { orderBy: { order: "asc" } } } },
        assignedExecutors: { select: { id: true, name: true } },
        _count: { select: { logs: true } },
      },
    }),
    prisma.maintenanceLog.findMany({
      orderBy: { executionDate: "desc" },
      take: 50,
      include: {
        executedBy: { select: { id: true, name: true } },
        schedule: {
          select: {
            id: true, scheduleType: true,
            asset: { select: { id: true, assetCode: true, assetName: true, location: true, division: { select: { id: true, name: true } } } },
          },
        },
        checklistResults: true,
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, role: true, jobDesk: true, handledAreas: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex-1 flex flex-col h-full p-4 md:p-6 overflow-hidden bg-slate-50">
      <MaintenanceClient
        currentUser={currentUser}
        divisions={divisions}
        assetTypes={assetTypes}
        assets={assets}
        templates={templates}
        schedules={schedules}
        logs={logs}
        systemUsers={allUsers}
      />
    </div>
  );
}
