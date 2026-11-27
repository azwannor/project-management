import { Suspense } from "react";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import ProjectDashboardClient from "@/components/views/ProjectDashboardClient";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const auth = await requireActiveSession();
  if (!auth) {
    redirect("/login");
  }

  const [projects, tasks, users] = await Promise.all([
    prisma.project.findMany({
      include: {
        projectMembers: {
          include: {
            user: { select: { id: true, name: true, jobDesk: true, role: true } },
          },
        },
        tasks: {
          select: { id: true, status: true, parentId: true },
        },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.task.findMany({
      where: {
        projectId: { not: null },
      },
      include: {
        user: { select: { id: true, name: true, photo: true } },
        project: { select: { id: true, name: true, status: true } },
        executors: {
          include: {
            user: { select: { id: true, name: true, photo: true, jobDesk: true, role: true } },
          },
        },
        timeLogs: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { startTime: "desc" },
        },
        comments: {
          select: { id: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        commentReadStatuses: {
          where: { userId: auth.user.id },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }, { id: "asc" }],
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true, jobDesk: true, photo: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const initialData = {
    projects,
    tasks,
    users,
    currentUser: {
      id: auth.user.id,
      name: auth.user.name,
      role: auth.user.role,
      photo: auth.user.photo,
    },
    generatedAtIso: new Date().toISOString(),
  };

  return (
    <Suspense fallback={<div className="p-8 text-xs text-[var(--text-muted)]">Loading...</div>}>
      <ProjectDashboardClient initialData={initialData} />
    </Suspense>
  );
}
