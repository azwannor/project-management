import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isMaintenanceAdmin } from "@/lib/auth";
import { logSettingsAudit } from "@/lib/settings-helpers";

// GET /api/locations — List active facility locations
export async function GET() {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { assets: true } } },
  });
  return NextResponse.json(locations);
}

// POST /api/locations — Create new location (Admin only)
export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Location name is required" }, { status: 400 });
    }

    const created = await prisma.location.create({
      data: {
        name,
        code: typeof body.code === "string" ? body.code.trim() || null : null,
        address: typeof body.address === "string" ? body.address.trim() || null : null,
      },
      include: { _count: { select: { assets: true } } },
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "Location",
      entityId: created.id,
      action: "CREATE",
      diffJson: { name: created.name, code: created.code },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Location already exists" }, { status: 400 });
    }
    console.error("Failed to create location:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}
