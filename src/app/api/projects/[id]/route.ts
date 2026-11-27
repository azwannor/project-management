import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";

async function resolveProjectMemberIdsAndNames(
  memberIdsInput: unknown,
  membersTextInput: unknown
): Promise<{ userIds: string[]; displayNames: string | null }> {
  const explicitIds = Array.isArray(memberIdsInput)
    ? memberIdsInput.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  if (Array.isArray(memberIdsInput)) {
    if (explicitIds.length === 0) {
      return { userIds: [], displayNames: null };
    }
    const users = await prisma.user.findMany({
      where: { id: { in: explicitIds } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return {
      userIds: users.map((u) => u.id),
      displayNames: users.map((u) => u.name).join(", ") || null,
    };
  }

  const rawText = typeof membersTextInput === "string" ? membersTextInput : "";
  const names = rawText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (names.length === 0) {
    return { userIds: [], displayNames: null };
  }

  const users = await prisma.user.findMany({
    where: { name: { in: names, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  return {
    userIds: users.map((u) => u.id),
    displayNames: names.join(", "),
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const data = await req.json();

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof data.name === "string" && data.name.trim()) updateData.name = data.name.trim();
    if (data.description !== undefined) {
      updateData.description =
        typeof data.description === "string" ? data.description.trim() || null : null;
    }
    if (data.objective !== undefined) {
      updateData.objective =
        typeof data.objective === "string" ? data.objective.trim() || null : null;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "Completed" && !existing.actualEndDate) {
        updateData.actualEndDate = new Date();
      } else if (data.status !== "Completed" && existing.actualEndDate) {
        updateData.actualEndDate = null;
      }
    }
    if (data.startDate !== undefined) {
      const d = new Date(data.startDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
      }
      updateData.startDate = d;
    }
    if (data.endDate !== undefined) {
      const d = new Date(data.endDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
      }
      updateData.endDate = d;
    }

    const hasMemberUpdate = data.memberIds !== undefined || data.members !== undefined;
    let memberSync: { userIds: string[]; displayNames: string | null } | null = null;
    if (hasMemberUpdate) {
      memberSync = await resolveProjectMemberIdsAndNames(data.memberIds, data.members);
      updateData.members = memberSync.displayNames;
    }

    const project = await prisma.$transaction(async (tx) => {
      if (memberSync) {
        await tx.projectMember.deleteMany({ where: { projectId: id } });
        if (memberSync.userIds.length > 0) {
          await tx.projectMember.createMany({
            data: memberSync.userIds.map((userId) => ({ projectId: id, userId })),
            skipDuplicates: true,
          });
        }
      }

      return tx.project.update({
        where: { id },
        data: updateData,
        include: {
          projectMembers: {
            include: { user: { select: { id: true, name: true, role: true, jobDesk: true } } },
          },
        },
      });
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Clear parentId links within the project first, then remove project tasks cleanly
      await tx.task.updateMany({
        where: { projectId: id },
        data: { parentId: null },
      });
      await tx.task.deleteMany({
        where: { projectId: id },
      });
      await tx.project.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
