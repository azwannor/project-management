import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { openAutoTimeLogForTask } from "@/lib/timelog";

async function resolveExecutorUsers(executorIdsInput: unknown, executorTextInput: unknown) {
  const explicitIds = Array.isArray(executorIdsInput)
    ? executorIdsInput.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  if (Array.isArray(executorIdsInput)) {
    if (explicitIds.length === 0) return { users: [], text: null };
    const users = await prisma.user.findMany({
      where: { id: { in: explicitIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return {
      users,
      text: users.map((u) => u.name).join(", ") || null,
    };
  }

  const rawText = typeof executorTextInput === "string" ? executorTextInput : "";
  const names = rawText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.length === 0) return { users: [], text: null };

  const users = await prisma.user.findMany({
    where: { name: { in: names, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  return { users, text: names.join(", ") };
}

export async function GET(request: NextRequest) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    const tasks = await prisma.task.findMany({
      where: projectId && projectId !== "all" ? { projectId } : undefined,
      include: {
        project: true,
        user: { select: { id: true, name: true, photo: true } },
        executors: {
          include: { user: { select: { id: true, name: true, photo: true } } },
        },
        timeLogs: { orderBy: { startTime: "desc" } },
      },
      orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }, { id: "asc" }],
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    const parentId = typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;
    let projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;

    if (parentId) {
      const parent = await prisma.task.findUnique({ where: { id: parentId } });
      if (!parent) {
        return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
      }
      if (!projectId && parent.projectId) {
        projectId = parent.projectId;
      }
    }

    const now = new Date();
    const startDate = body.startDate ? new Date(body.startDate) : now;
    const endDate = body.endDate
      ? new Date(body.endDate)
      : new Date(startDate.getTime() + 7 * 86_400_000);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid task dates" }, { status: 400 });
    }

    const status = typeof body.status === "string" && body.status.trim() ? body.status.trim() : "Not Started";
    const priority = typeof body.priority === "string" && body.priority.trim() ? body.priority.trim() : "Normal";
    const { users: executorUsers, text: executorText } = await resolveExecutorUsers(
      body.executorIds,
      body.executor
    );

    const isCompleted = status === "Completed" || status === "Done";
    const isOngoing = status === "Ongoing";

    const newTask = await prisma.task.create({
      data: {
        title,
        parentId,
        projectId,
        userId: auth.user.id,
        startDate,
        endDate,
        startedAt: isOngoing ? now : null,
        actualEndDate: isCompleted ? (body.actualEndDate ? new Date(body.actualEndDate) : now) : null,
        priority,
        status,
        issue: typeof body.issue === "string" ? body.issue.trim() || null : null,
        solution: typeof body.solution === "string" ? body.solution.trim() || null : null,
        documentation:
          typeof body.documentation === "string" ? body.documentation.trim() || null : null,
        attachment: typeof body.attachment === "string" ? body.attachment.trim() || null : null,
        attachmentKey:
          typeof body.attachmentKey === "string" ? body.attachmentKey.trim() || null : null,
        executor: executorText,
        ...(executorUsers.length > 0
          ? {
              executors: {
                create: executorUsers.map((u) => ({ userId: u.id })),
              },
            }
          : {}),
      },
      include: {
        project: true,
        user: { select: { id: true, name: true, photo: true } },
        executors: { include: { user: { select: { id: true, name: true, photo: true } } } },
        timeLogs: true,
      },
    });

    if (isOngoing) {
      await openAutoTimeLogForTask(newTask.id, auth.user.id, now);
    }

    // Reopen completed parent task if a new non-completed subtask is attached
    if (newTask.parentId && !isCompleted) {
      const parentTask = await prisma.task.findUnique({ where: { id: newTask.parentId } });
      if (parentTask && (parentTask.status === "Completed" || parentTask.status === "Done")) {
        await prisma.task.update({
          where: { id: parentTask.id },
          data: { status: "Ongoing", actualEndDate: null },
        });
      }
    }

    // Assignment notifications
    for (const u of executorUsers) {
      await prisma.notification.create({
        data: {
          userId: u.id,
          title: "Tugas Baru",
          message: `Anda telah ditugaskan pada task baru: "${newTask.title}"`,
          type: "ASSIGNMENT",
          link: newTask.projectId ? `/projects?projectId=${newTask.projectId}` : "/projects",
        },
      });
    }

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error("Failed to create task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
