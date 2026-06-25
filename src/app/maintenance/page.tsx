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
    <div className="min-h-screen p-6 md:p-10 text-gray-900">
      <header className="glass-panel p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/30 rounded-xl backdrop-blur-md border border-white/50 shadow-sm">
            <Wrench className="w-8 h-8 text-blue-800" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 drop-shadow-sm">Infrastructure Maintenance</h1>
            <p className="text-sm text-gray-600 font-medium">Manage IT infrastructure assets, schedules, and routine maintenance checklists.</p>
          </div>
        </div>
      </header>

      <div className="glass-panel flex flex-col overflow-hidden p-6">
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
    </div>
  );
}
