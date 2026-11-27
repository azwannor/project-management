import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import SupportClient from "@/components/views/SupportClient";

export const dynamic = "force-dynamic";

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const auth = await requireActiveSession();
  if (!auth) {
    redirect("/login");
  }

  const sp = await searchParams;
  const initialTicketId = typeof sp.ticket === "string" ? sp.ticket : null;

  const [tickets, allUsers, modules, regionalAreas, slaPolicies, assets, projects] =
    await Promise.all([
      prisma.supportTicket.findMany({
        include: {
          user: { select: { id: true, name: true, jobDesk: true, photo: true } },
          executors: { select: { id: true, name: true, jobDesk: true, photo: true } },
          asset: { select: { id: true, assetCode: true, assetName: true, location: true } },
          timeLogs: {
            include: { user: { select: { id: true, name: true, photo: true } } },
            orderBy: { startTime: "desc" },
          },
          promotedTasks: {
            select: {
              id: true,
              title: true,
              status: true,
              project: { select: { id: true, name: true } },
            },
          },
          comments: {
            select: { id: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          commentReadStatuses: {
            where: { userId: auth.user.id },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
          jobDesk: true,
          photo: true,
          handledAreas: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.supportModule.findMany({
        where: { isActive: true },
        include: {
          categories: {
            orderBy: { name: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.regionalArea.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { name: true },
      }),
      prisma.slaPolicy.findMany({
        orderBy: { targetMinutes: "asc" },
      }),
      prisma.asset.findMany({
        where: { status: { in: ["ACTIVE", "IN_REPAIR", "SPARE"] } },
        select: { id: true, assetCode: true, assetName: true, location: true },
        orderBy: { assetCode: "asc" },
      }),
      prisma.project.findMany({
        select: { id: true, name: true, status: true },
        orderBy: { startDate: "asc" },
      }),
    ]);

  return (
    <SupportClient
      initialTickets={tickets}
      currentUser={{
        id: auth.user.id,
        name: auth.user.name,
        role: auth.user.role,
        photo: auth.user.photo,
        canViewTeamLogs: auth.user.canViewTeamLogs,
      }}
      systemUsers={allUsers}
      modules={modules}
      areas={regionalAreas.map((a) => a.name)}
      slaPolicies={slaPolicies}
      assets={assets}
      projects={projects}
      initialTicketId={initialTicketId}
    />
  );
}
