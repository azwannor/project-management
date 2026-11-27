import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isMaintenanceAdmin } from "@/lib/auth";
import { logSettingsAudit } from "@/lib/settings-helpers";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Division name is required" }, { status: 400 });
    }

    const updated = await prisma.division.update({
      where: { id },
      data: {
        name,
        ...(body.code !== undefined
          ? { code: typeof body.code === "string" ? body.code.trim() || null : null }
          : {}),
      },
      include: { _count: { select: { assets: true } } },
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "Division",
      entityId: id,
      action: "UPDATE",
      diffJson: { name: updated.name, code: updated.code },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Division not found" }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Division name already exists" }, { status: 400 });
      }
    }
    console.error("Update Division Error:", error);
    return NextResponse.json({ error: "Failed to update division" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.division.findUnique({
      where: { id },
      include: { _count: { select: { assets: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Division not found" }, { status: 404 });
    }
    if (existing._count.assets > 0) {
      return NextResponse.json(
        { error: `Cannot delete division still assigned to ${existing._count.assets} assets` },
        { status: 400 }
      );
    }

    await prisma.division.delete({ where: { id } });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "Division",
      entityId: id,
      action: "DELETE",
      diffJson: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Division Error:", error);
    return NextResponse.json({ error: "Failed to delete division" }, { status: 500 });
  }
}
