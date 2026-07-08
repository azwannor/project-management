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
      select: { id: true, name: true, jobDesk: true, role: true, canViewTeamLogs: true }
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
    <div className="flex-1 flex flex-col h-full p-4 md:p-6 overflow-hidden bg-slate-50">
      <SupportClient tickets={tickets} currentUser={currentUser} systemUsers={allUsers} />
    </div>
  );
}
