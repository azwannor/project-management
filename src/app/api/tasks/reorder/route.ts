import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import {
  computeSiblingReorderUpdates,
  type ReorderDropMode,
} from "@/lib/project-helpers";

const VALID_MODES = new Set<ReorderDropMode>(["before", "after", "inside", "root"]);

export async function POST(request: NextRequest) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
    const targetTaskId =
      typeof body.targetTaskId === "string" && body.targetTaskId.trim()
        ? body.targetTaskId.trim()
        : null;
    const mode = body.mode as ReorderDropMode;
    const targetProjectId =
      body.targetProjectId === undefined
        ? undefined
        : typeof body.targetProjectId === "string" && body.targetProjectId.trim()
          ? body.targetProjectId.trim()
          : null;

    if (!taskId || !VALID_MODES.has(mode)) {
      return NextResponse.json(
        { error: "taskId and valid mode (before|after|inside|root) are required" },
        { status: 400 }
      );
    }

    const allTasks = await prisma.task.findMany({
      select: {
        id: true,
        parentId: true,
        projectId: true,
        sortOrder: true,
        startDate: true,
      },
    });

    const result = computeSiblingReorderUpdates(allTasks, {
      taskId,
      targetTaskId,
      mode,
      targetProjectId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.updates.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0 });
    }

    await prisma.$transaction(async (tx) => {
      for (const u of result.updates) {
        const data: Record<string, unknown> = { sortOrder: u.sortOrder };
        if (u.id === taskId) {
          if (u.parentId !== undefined) data.parentId = u.parentId;
          if (u.projectId !== undefined) data.projectId = u.projectId;
        }
        await tx.task.update({
          where: { id: u.id },
          data,
        });
      }

      if (result.descendantIds.length > 0) {
        await tx.task.updateMany({
          where: { id: { in: result.descendantIds } },
          data: { projectId: result.nextProjectId },
        });
      }
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.updates.length + result.descendantIds.length,
    });
  } catch (error) {
    console.error("Failed to reorder tasks:", error);
    return NextResponse.json({ error: "Failed to reorder tasks" }, { status: 500 });
  }
}
