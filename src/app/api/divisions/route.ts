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
    const divisions = await prisma.division.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { assets: true } } },
    });
    return NextResponse.json(divisions);
  } catch (error) {
    console.error("Fetch Divisions Error:", error);
    return NextResponse.json({ error: "Failed to fetch divisions" }, { status: 500 });
  }
}

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
    const code = typeof body.code === "string" ? body.code.trim() || null : null;

    if (!name) {
      return NextResponse.json({ error: "Division name is required" }, { status: 400 });
    }

    const newDivision = await prisma.division.create({
      data: { name, code },
      include: { _count: { select: { assets: true } } },
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "Division",
      entityId: newDivision.id,
      action: "CREATE",
      diffJson: { name: newDivision.name, code: newDivision.code },
    });

    return NextResponse.json(newDivision, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Division name already exists" }, { status: 400 });
    }
    console.error("Create Division Error:", error);
    return NextResponse.json({ error: "Failed to create division" }, { status: 500 });
  }
}
