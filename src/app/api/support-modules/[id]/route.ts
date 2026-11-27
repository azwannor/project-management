import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isAdminUser, logSettingsAudit } from "@/lib/settings-helpers";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const data: Prisma.SupportModuleUpdateInput = {};

    if (typeof body.name === "string") {
      if (!body.name.trim()) return NextResponse.json({ error: "Module name cannot be empty" }, { status: 400 });
      data.name = body.name.trim();
    }
    if (typeof body.groupName === "string") {
      if (!body.groupName.trim()) return NextResponse.json({ error: "Group name cannot be empty" }, { status: 400 });
      data.groupName = body.groupName.trim();
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const updated = await prisma.supportModule.update({
      where: { id },
      data,
      include: { categories: { orderBy: { name: "asc" } } },
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "SupportModule",
      entityId: id,
      action: "UPDATE",
      diffJson: { name: updated.name, isActive: updated.isActive },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return NextResponse.json({ error: "Support module not found" }, { status: 404 });
      if (error.code === "P2002") return NextResponse.json({ error: "Support module name already exists" }, { status: 400 });
    }
    console.error("Update SupportModule Error:", error);
    return NextResponse.json({ error: "Failed to update support module" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.supportModule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Support module not found" }, { status: 404 });
    }

    const ticketCount = await prisma.supportTicket.count({ where: { module: existing.name } });
    if (ticketCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete module linked to ${ticketCount} support tickets. Deactivate it instead.` },
        { status: 400 }
      );
    }

    await prisma.supportModule.delete({ where: { id } });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "SupportModule",
      entityId: id,
      action: "DELETE",
      diffJson: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete SupportModule Error:", error);
    return NextResponse.json({ error: "Failed to delete support module" }, { status: 500 });
  }
}
