import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";
import prisma from "@/lib/prisma";
import SupportClient from "@/components/views/SupportClient";
import { Headset } from "lucide-react";
import { redirect } from "next/navigation";

export default async function SupportPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = await decrypt(sessionCookie);

  if (!session || !session.userId) {
    redirect("/login");
  }

  const [currentUser, tickets, allUsers] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId as string },
      select: { id: true, name: true, jobDesk: true, role: true }
    }),
    prisma.supportTicket.findMany({
      include: { 
        user: true,
        executors: { select: { id: true, name: true } },
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        commentReadStatuses: {
          where: { userId: session.userId as string }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.findMany({
      select: { id: true, name: true, role: true, jobDesk: true, handledAreas: true },
      orderBy: { name: 'asc' }
    })
  ]);

  if (!currentUser) redirect("/login");

  return (
    <div className="min-h-screen p-6 md:p-10 text-gray-900">
      {/* Header Panel */}
      <header className="glass-panel p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/30 rounded-xl backdrop-blur-md border border-white/50 shadow-sm">
            <Headset className="w-8 h-8 text-blue-800" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 drop-shadow-sm">Support & Operasional</h1>
            <p className="text-sm text-gray-600 font-medium">Manage daily IT support tickets and tasks outside main projects.</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="glass-panel flex flex-col h-[calc(100vh-200px)] overflow-hidden p-6">
        <SupportClient tickets={tickets} currentUser={currentUser} systemUsers={allUsers} />
      </div>
    </div>
  );
}
