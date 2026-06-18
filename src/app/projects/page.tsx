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
  const projects = await prisma.project.findMany({
    include: { tasks: true }
  });
  
  const tasks = await prisma.task.findMany({
    where: {
      projectId: { not: null }
    },
    include: { user: true, project: true }
  });

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  });

  const initialData = {
    projects,
    tasks,
    users
  };

  return (
    <Suspense fallback={<div className="p-10 text-center">Loading dashboard...</div>}>
      <ProjectDashboardClient initialData={initialData} />
    </Suspense>
  );
}
