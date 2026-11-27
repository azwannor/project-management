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
    return NextResponse.json({ error: "Forbidden. Only admins can update asset types." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const assetType = await prisma.assetType.update({
      where: { id },
      data: {
        name,
        ...(body.code !== undefined
          ? { code: typeof body.code === "string" ? body.code.trim() || null : null }
          : {}),
      },
      include: { _count: { select: { assets: true, templates: true } } },
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "AssetType",
      entityId: id,
      action: "UPDATE",
      diffJson: { name: assetType.name, code: assetType.code },
    });

    return NextResponse.json(assetType);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Asset type not found" }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Asset type with this name already exists" }, { status: 400 });
      }
    }
    console.error("Failed to update asset type:", error);
    return NextResponse.json({ error: "Failed to update asset type" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json({ error: "Forbidden. Only admins can delete asset types." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const assetType = await prisma.assetType.findUnique({
      where: { id },
      include: { _count: { select: { assets: true, templates: true } } },
    });

    if (!assetType) {
      return NextResponse.json({ error: "Asset type not found" }, { status: 404 });
    }
    if (assetType._count.assets > 0) {
      return NextResponse.json(
        { error: `Cannot delete. There are still ${assetType._count.assets} assets with this type.` },
        { status: 400 }
      );
    }
    if (assetType._count.templates > 0) {
      return NextResponse.json(
        { error: `Cannot delete. There are still ${assetType._count.templates} maintenance templates with this type.` },
        { status: 400 }
      );
    }

    await prisma.assetType.delete({ where: { id } });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "AssetType",
      entityId: id,
      action: "DELETE",
      diffJson: { name: assetType.name },
    });

    return NextResponse.json({ success: true, message: "Asset type deleted successfully" });
  } catch (error) {
    console.error("Failed to delete asset type:", error);
    return NextResponse.json({ error: "Failed to delete asset type" }, { status: 500 });
  }
}
