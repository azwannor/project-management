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

  const [projects, tasks, supportTickets, users] = await Promise.all([
    prisma.project.findMany(),
    prisma.task.findMany({ include: { project: true } }),
    prisma.supportTicket.findMany({ include: { user: true } }),
    prisma.user.findMany({ select: { id: true, name: true, role: true } }),
  ]);

  return (
    <div className="min-h-screen p-6 md:p-10 text-gray-900">
      {/* Header Panel */}
      <header className="glass-panel p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/30 rounded-xl backdrop-blur-md border border-white/50 shadow-sm">
            <LayoutDashboard className="w-8 h-8 text-blue-800" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 drop-shadow-sm">Dashboard</h1>
            <p className="text-sm text-gray-600 font-medium">Overview of IT tasks and support tickets.</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <DashboardClient 
        currentUser={currentUser}
        projects={projects}
        tasks={tasks}
        supportTickets={supportTickets}
        users={users}
      />
    </div>
  );
}
