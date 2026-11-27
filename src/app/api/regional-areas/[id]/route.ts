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
    const data: Prisma.RegionalAreaUpdateInput = {};

    if (typeof body.name === "string") {
      const normalized = body.name.trim().toUpperCase();
      if (!normalized) {
        return NextResponse.json({ error: "Area name cannot be empty" }, { status: 400 });
      }
      data.name = normalized;
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const updated = await prisma.regionalArea.update({ where: { id }, data });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "RegionalArea",
      entityId: id,
      action: "UPDATE",
      diffJson: { name: updated.name, isActive: updated.isActive },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Regional area not found" }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Regional area already exists" }, { status: 400 });
      }
    }
    console.error("Update RegionalArea Error:", error);
    return NextResponse.json({ error: "Failed to update regional area" }, { status: 500 });
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
    const existing = await prisma.regionalArea.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Regional area not found" }, { status: 404 });
    }

    await prisma.regionalArea.delete({ where: { id } });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "RegionalArea",
      entityId: id,
      action: "DELETE",
      diffJson: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete RegionalArea Error:", error);
    return NextResponse.json({ error: "Failed to delete regional area" }, { status: 500 });
  }
}
