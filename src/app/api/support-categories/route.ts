import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isAdminUser, logSettingsAudit } from "@/lib/settings-helpers";

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
    const moduleId = typeof body.moduleId === "string" ? body.moduleId.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const requiresArea = Boolean(body.requiresArea);

    if (!moduleId || !name) {
      return NextResponse.json({ error: "moduleId and category name are required" }, { status: 400 });
    }

    const parentModule = await prisma.supportModule.findUnique({ where: { id: moduleId }, select: { id: true } });
    if (!parentModule) {
      return NextResponse.json({ error: "Parent support module not found" }, { status: 400 });
    }

    const created = await prisma.supportCategory.create({
      data: { moduleId, name, requiresArea },
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "SupportCategory",
      entityId: created.id,
      action: "CREATE",
      diffJson: { moduleId, name: created.name, requiresArea },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Category already exists under this module" }, { status: 400 });
    }
    console.error("Create SupportCategory Error:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
