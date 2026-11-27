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
    const data: Prisma.SupportCategoryUpdateInput = {};

    if (typeof body.name === "string") {
      if (!body.name.trim()) return NextResponse.json({ error: "Category name cannot be empty" }, { status: 400 });
      data.name = body.name.trim();
    }
    if (body.requiresArea !== undefined) {
      data.requiresArea = Boolean(body.requiresArea);
    }

    const updated = await prisma.supportCategory.update({ where: { id }, data });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "SupportCategory",
      entityId: id,
      action: "UPDATE",
      diffJson: { name: updated.name, requiresArea: updated.requiresArea },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return NextResponse.json({ error: "Category not found" }, { status: 404 });
      if (error.code === "P2002") return NextResponse.json({ error: "Category name already exists in module" }, { status: 400 });
    }
    console.error("Update SupportCategory Error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
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
    const existing = await prisma.supportCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    await prisma.supportCategory.delete({ where: { id } });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "SupportCategory",
      entityId: id,
      action: "DELETE",
      diffJson: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete SupportCategory Error:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
