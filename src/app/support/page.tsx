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
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header Panel */}
      <header className="bg-white border-b border-slate-200 px-4 py-5 md:px-6 md:py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shadow-sm border border-blue-100">
            <Headset className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 drop-shadow-sm">Support & Operasional</h1>
            <p className="text-sm text-gray-500 font-medium mt-1">Manage daily IT support tickets and tasks outside main projects.</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-[calc(100vh-100px)] p-4 md:p-6 overflow-hidden">
        <SupportClient tickets={tickets} currentUser={currentUser} systemUsers={allUsers} />
      </div>
    </div>
  );
}
