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

  const areas = await prisma.regionalArea.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(areas);
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
    const name = typeof body.name === "string" ? body.name.trim().toUpperCase() : "";
    if (!name) {
      return NextResponse.json({ error: "Area name is required" }, { status: 400 });
    }

    const created = await prisma.regionalArea.create({
      data: {
        name,
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      },
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "RegionalArea",
      entityId: created.id,
      action: "CREATE",
      diffJson: { name: created.name },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Regional area already exists" }, { status: 400 });
    }
    console.error("Create RegionalArea Error:", error);
    return NextResponse.json({ error: "Failed to create regional area" }, { status: 500 });
  }
}
