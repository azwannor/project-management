import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { collectDescendantTaskIds, wouldCreateTaskCycle } from "@/lib/project-helpers";
import { closeOpenTimeLogsForTask, openAutoTimeLogForTask } from "@/lib/timelog";

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
    return { users, text: users.map((u) => u.name).join(", ") || null };
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: { executors: true },
    });
    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Cycle validation before re-parenting
    if (body.parentId !== undefined && body.parentId !== existingTask.parentId) {
      const candidateParentId =
        typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;
      if (candidateParentId) {
        const allTasks = await prisma.task.findMany({
          select: { id: true, parentId: true },
        });
        if (!allTasks.some((t) => t.id === candidateParentId)) {
          return NextResponse.json({ error: "Target parent task not found" }, { status: 404 });
        }
        if (wouldCreateTaskCycle(id, candidateParentId, allTasks)) {
          return NextResponse.json(
            { error: "Circular parent-child dependency is not allowed" },
            { status: 400 }
          );
        }
      }
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {};

    if (typeof body.title === "string" && body.title.trim()) updateData.title = body.title.trim();
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.issue !== undefined) {
      updateData.issue = typeof body.issue === "string" ? body.issue.trim() || null : null;
    }
    if (body.solution !== undefined) {
      updateData.solution = typeof body.solution === "string" ? body.solution.trim() || null : null;
    }
    if (body.documentation !== undefined) {
      updateData.documentation =
        typeof body.documentation === "string" ? body.documentation.trim() || null : null;
    }
    if (body.attachment !== undefined) {
      updateData.attachment =
        typeof body.attachment === "string" ? body.attachment.trim() || null : null;
    }
    if (body.attachmentKey !== undefined) {
      updateData.attachmentKey =
        typeof body.attachmentKey === "string" ? body.attachmentKey.trim() || null : null;
    }
    if (body.startDate !== undefined) {
      const d = new Date(body.startDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
      }
      updateData.startDate = d;
    }
    if (body.endDate !== undefined) {
      const d = new Date(body.endDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
      }
      updateData.endDate = d;
    }
    if (body.projectId !== undefined) updateData.projectId = body.projectId || null;
    if (body.parentId !== undefined) updateData.parentId = body.parentId || null;

    let parsedActualEndDate: Date | null = null;
    if (body.actualEndDate) {
      parsedActualEndDate = new Date(body.actualEndDate);
      if (Number.isNaN(parsedActualEndDate.getTime())) {
        return NextResponse.json({ error: "Invalid actualEndDate" }, { status: 400 });
      }
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === "Ongoing") {
        updateData.startedAt = existingTask.startedAt || now;
        updateData.actualEndDate = null;
      } else if (body.status === "Completed" || body.status === "Done") {
        updateData.actualEndDate = parsedActualEndDate || now;
      } else {
        updateData.actualEndDate = parsedActualEndDate;
      }
    } else if (body.actualEndDate !== undefined) {
      updateData.actualEndDate = parsedActualEndDate;
    }

    const hasExecutorUpdate = body.executorIds !== undefined || body.executor !== undefined;
    let resolvedExecutors: { users: Array<{ id: string; name: string }>; text: string | null } | null = null;
    if (hasExecutorUpdate) {
      resolvedExecutors = await resolveExecutorUsers(body.executorIds, body.executor);
      updateData.executor = resolvedExecutors.text;
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      if (resolvedExecutors) {
        await tx.taskExecutor.deleteMany({ where: { taskId: id } });
        if (resolvedExecutors.users.length > 0) {
          await tx.taskExecutor.createMany({
            data: resolvedExecutors.users.map((u) => ({ taskId: id, userId: u.id })),
            skipDuplicates: true,
          });
        }
      }

      return tx.task.update({
        where: { id },
        data: updateData,
        include: {
          project: true,
          user: { select: { id: true, name: true, photo: true } },
          executors: { include: { user: { select: { id: true, name: true, photo: true } } } },
        },
      });
    });

    // Hybrid TimeLog Automation on status transition
    if (existingTask.status !== updatedTask.status) {
      if (updatedTask.status === "Ongoing") {
        await openAutoTimeLogForTask(updatedTask.id, auth.user.id, now);
      } else {
        await closeOpenTimeLogsForTask(updatedTask.id, now);
      }

      // Multi-level ancestor auto-complete / reopen automation
      const isDoneStatus = (s: string) => s === "Completed" || s === "Done";
      if (updatedTask.parentId) {
        if (isDoneStatus(updatedTask.status)) {
          const visited = new Set<string>([updatedTask.id]);
          let currentParentId: string | null = updatedTask.parentId;

          while (currentParentId && !visited.has(currentParentId)) {
            visited.add(currentParentId);
            const siblingTasks = await prisma.task.findMany({
              where: { parentId: currentParentId },
              select: { id: true, status: true },
            });
            if (siblingTasks.length === 0 || !siblingTasks.every((t) => isDoneStatus(t.status))) {
              break;
            }
            const parentTask: {
              id: string;
              parentId: string | null;
              title: string;
              executor: string | null;
              project: { name: string } | null;
            } = await prisma.task.update({
              where: { id: currentParentId },
              data: { status: "Completed", actualEndDate: now },
              include: { project: { select: { name: true } } },
            });
            await closeOpenTimeLogsForTask(parentTask.id, now);
            currentParentId = parentTask.parentId;
          }
        } else {
          const visited = new Set<string>([updatedTask.id]);
          let currentParentId: string | null = updatedTask.parentId;

          while (currentParentId && !visited.has(currentParentId)) {
            visited.add(currentParentId);
            const parentTask: {
              id: string;
              status: string;
              parentId: string | null;
            } | null = await prisma.task.findUnique({
              where: { id: currentParentId },
              select: { id: true, status: true, parentId: true },
            });
            if (!parentTask) break;
            if (isDoneStatus(parentTask.status)) {
              await prisma.task.update({
                where: { id: parentTask.id },
                data: { status: "Ongoing", actualEndDate: null },
              });
            }
            currentParentId = parentTask.parentId;
          }
        }
      }
    }

    // Notify newly assigned executors
    if (resolvedExecutors) {
      const prevIds = new Set(existingTask.executors.map((e) => e.userId));
      for (const u of resolvedExecutors.users) {
        if (!prevIds.has(u.id)) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              title: "Tugas Dialokasikan",
              message: `Anda ditugaskan pada task: "${updatedTask.title}"`,
              type: "ASSIGNMENT",
              link: updatedTask.projectId ? `/projects?projectId=${updatedTask.projectId}` : "/projects",
            },
          });
        }
      }
    }

    const timeLogs = await prisma.timeLog.findMany({
      where: { taskId: updatedTask.id },
      include: { user: { select: { id: true, name: true, photo: true } } },
      orderBy: { startTime: "desc" },
    });

    return NextResponse.json({ ...updatedTask, timeLogs });
  } catch (error) {
    console.error("Failed to update task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const allTasks = await prisma.task.findMany({
      select: { id: true, parentId: true },
    });

    if (!allTasks.some((t) => t.id === id)) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const descendantIds = collectDescendantTaskIds(id, allTasks);
    const idsToDelete = [...descendantIds, id];

    await prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { id: { in: idsToDelete } },
        data: { parentId: null },
      });
      await tx.task.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    });

    return NextResponse.json({ message: "Task deleted successfully", deletedCount: idsToDelete.length });
  } catch (error) {
    console.error("Failed to delete task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
