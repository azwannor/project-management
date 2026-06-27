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
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-5 md:px-6 md:py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shadow-sm border border-blue-100">
            <Wrench className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 drop-shadow-sm">Infrastructure Maintenance</h1>
            <p className="text-sm text-gray-500 font-medium mt-1">Manage IT infrastructure assets, schedules, and routine maintenance checklists.</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-[calc(100vh-100px)] p-4 md:p-6 overflow-hidden">
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
