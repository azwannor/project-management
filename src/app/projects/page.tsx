import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import ProjectDashboardClient from "@/components/views/ProjectDashboardClient";
import { Suspense } from "react";

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = await decrypt(sessionCookie);

  if (!session || !session.userId) {
    redirect("/login");
  }

  // Server-side data fetching for project tasks
  const [projects, tasks, users, currentUser] = await Promise.all([
    prisma.project.findMany({
      include: { tasks: true }
    }),
    prisma.task.findMany({
      where: {
        projectId: { not: null }
      },
      include: { 
        user: true, 
        project: true,
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        commentReadStatuses: {
          where: { userId: session.userId as string }
        }
      }
    }),
    prisma.user.findMany({
      orderBy: { name: 'asc' }
    }),
    prisma.user.findUnique({
      where: { id: session.userId as string },
      select: { id: true, name: true, photo: true }
    })
  ]);

  const initialData = {
    projects,
    tasks,
    users,
    currentUser
  };

  return (
    <Suspense fallback={<div className="p-10 text-center">Loading dashboard...</div>}>
      <ProjectDashboardClient initialData={initialData} />
    </Suspense>
  );
}
