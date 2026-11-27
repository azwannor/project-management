import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isAdminUser, logSettingsAudit } from "@/lib/settings-helpers";

export async function GET() {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const modules = await prisma.supportModule.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      categories: { orderBy: { name: "asc" } },
    },
  });
  return NextResponse.json(modules);
}

export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const groupName = typeof body.groupName === "string" ? body.groupName.trim() : "General";
    const sortOrder = Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

    if (!name || !groupName) {
      return NextResponse.json({ error: "Module name and group are required" }, { status: 400 });
    }

    const created = await prisma.supportModule.create({
      data: {
        name,
        groupName,
        sortOrder,
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      },
      include: { categories: true },
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "SupportModule",
      entityId: created.id,
      action: "CREATE",
      diffJson: { name: created.name, groupName: created.groupName },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Support module already exists" }, { status: 400 });
    }
    console.error("Create SupportModule Error:", error);
    return NextResponse.json({ error: "Failed to create support module" }, { status: 500 });
  }
}
