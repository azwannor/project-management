import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isMaintenanceAdmin } from "@/lib/auth";
import { logSettingsAudit } from "@/lib/settings-helpers";

export async function GET() {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const assetTypes = await prisma.assetType.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { assets: true, templates: true },
        },
      },
    });
    return NextResponse.json(assetTypes);
  } catch (error) {
    console.error("Failed to fetch asset types:", error);
    return NextResponse.json({ error: "Failed to fetch asset types" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json({ error: "Forbidden. Only admins can create asset types." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() || null : null;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const assetType = await prisma.assetType.create({
      data: { name, code },
      include: { _count: { select: { assets: true, templates: true } } },
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "AssetType",
      entityId: assetType.id,
      action: "CREATE",
      diffJson: { name: assetType.name, code: assetType.code },
    });

    return NextResponse.json(assetType, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Asset type with this name already exists" }, { status: 400 });
    }
    console.error("Failed to create asset type:", error);
    return NextResponse.json({ error: "Failed to create asset type" }, { status: 500 });
  }
}
