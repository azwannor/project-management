import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { generateExternalApiKey, isAdminUser, logSettingsAudit } from "@/lib/settings-helpers";

export async function GET() {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keys = await prisma.externalApiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      sourceApp: true,
      keyPrefix: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json(keys);
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
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const sourceApp = typeof body.sourceApp === "string" ? body.sourceApp.trim() : "";

    if (!name || !sourceApp) {
      return NextResponse.json({ error: "Key name and sourceApp are required" }, { status: 400 });
    }

    const { rawKey, keyPrefix, keyHash } = generateExternalApiKey();

    const created = await prisma.externalApiKey.create({
      data: {
        name,
        sourceApp,
        keyPrefix,
        keyHash,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sourceApp: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "ExternalApiKey",
      entityId: created.id,
      action: "CREATE",
      diffJson: { name: created.name, sourceApp: created.sourceApp, keyPrefix: created.keyPrefix },
    });

    return NextResponse.json({ ...created, rawKey }, { status: 201 });
  } catch (error) {
    console.error("Create ExternalApiKey Error:", error);
    return NextResponse.json({ error: "Failed to generate API key" }, { status: 500 });
  }
}
