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
    const data: Prisma.ExternalApiKeyUpdateInput = {};

    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const updated = await prisma.externalApiKey.update({
      where: { id },
      data,
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
      entityId: id,
      action: updated.isActive ? "ACTIVATE" : "REVOKE",
      diffJson: { name: updated.name, isActive: updated.isActive },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "API Key not found" }, { status: 404 });
    }
    console.error("Update ExternalApiKey Error:", error);
    return NextResponse.json({ error: "Failed to update API key" }, { status: 500 });
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
    const existing = await prisma.externalApiKey.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) {
      return NextResponse.json({ error: "API Key not found" }, { status: 404 });
    }

    await prisma.externalApiKey.delete({ where: { id } });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "ExternalApiKey",
      entityId: id,
      action: "DELETE",
      diffJson: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete ExternalApiKey Error:", error);
    return NextResponse.json({ error: "Failed to delete API key" }, { status: 500 });
  }
}
