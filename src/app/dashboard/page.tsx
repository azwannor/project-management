import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";
import prisma from "@/lib/prisma";
import DashboardClient from "@/components/views/DashboardClient";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = await decrypt(sessionCookie);

  if (!session || !session.userId) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: { id: true, name: true, jobDesk: true, role: true }
  });

  if (!currentUser) redirect("/login");

  const [projects, tasks, supportTickets, users, maintenanceSchedules, assets] = await Promise.all([
    prisma.project.findMany(),
    prisma.task.findMany({ include: { project: true } }),
    prisma.supportTicket.findMany({ include: { user: true, executors: true } }),
    prisma.user.findMany({ select: { id: true, name: true, role: true } }),
    prisma.maintenanceSchedule.findMany({
      include: {
        asset: { select: { assetName: true, assetCode: true, location: true, division: { select: { id: true, name: true } } } },
        template: { select: { templateName: true } },
        logs: { select: { executionDate: true } },
      },
    }),
    prisma.asset.findMany({
      select: { id: true, status: true },
    }),
  ]);

  return (
    <div className="min-h-screen p-6 md:p-10 text-gray-900">
      {/* Main Content Area */}
      <DashboardClient 
        currentUser={currentUser}
        projects={projects}
        tasks={tasks}
        supportTickets={supportTickets}
        users={users}
        maintenanceSchedules={maintenanceSchedules}
        assets={assets}
      />
    </div>
  );
}
