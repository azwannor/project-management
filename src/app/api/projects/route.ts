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

  if (explicitIds.length > 0) {
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
    where: {
      name: { in: names, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });

  return {
    userIds: users.map((u) => u.id),
    displayNames: names.join(", "),
  };
}

export async function GET() {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await prisma.project.findMany({
      include: {
        projectMembers: {
          include: { user: { select: { id: true, name: true, role: true, jobDesk: true } } },
        },
        tasks: {
          select: { id: true, status: true, parentId: true },
        },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const endDate = data.endDate
      ? new Date(data.endDate)
      : new Date(startDate.getTime() + 30 * 86_400_000);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid project dates" }, { status: 400 });
    }

    const status = typeof data.status === "string" && data.status.trim() ? data.status.trim() : "Not Started";
    const { userIds, displayNames } = await resolveProjectMemberIdsAndNames(
      data.memberIds,
      data.members
    );

    const project = await prisma.project.create({
      data: {
        name,
        description: typeof data.description === "string" ? data.description.trim() || null : null,
        objective: typeof data.objective === "string" ? data.objective.trim() || null : null,
        members: displayNames,
        startDate,
        endDate,
        actualEndDate: status === "Completed" ? new Date() : null,
        status,
        ...(userIds.length > 0
          ? {
              projectMembers: {
                create: userIds.map((userId) => ({ userId })),
              },
            }
          : {}),
      },
      include: {
        projectMembers: {
          include: { user: { select: { id: true, name: true, role: true, jobDesk: true } } },
        },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
