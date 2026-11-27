import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.timeLog.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Time log not found" }, { status: 404 });
    }

    if (
      existing.userId !== auth.user.id &&
      auth.user.role.toLowerCase() !== "admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.note !== undefined) {
      updateData.note = typeof body.note === "string" ? body.note.trim() || null : null;
    }

    if (body.durationMinutes !== undefined || body.durationSeconds !== undefined) {
      const rawSecs =
        body.durationSeconds !== undefined
          ? Number(body.durationSeconds)
          : Number(body.durationMinutes) * 60;
      if (!Number.isFinite(rawSecs) || rawSecs <= 0) {
        return NextResponse.json(
          { error: "Duration must be a finite number greater than 0" },
          { status: 400 }
        );
      }
      const secs = Math.round(rawSecs);
      updateData.durationSeconds = secs;
      updateData.duration = secs;
      const start = new Date(existing.startTime);
      updateData.endTime = new Date(start.getTime() + secs * 1000);
    }

    const updated = await prisma.timeLog.update({
      where: { id },
      data: updateData,
      include: { user: { select: { id: true, name: true, photo: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update time log:", error);
    return NextResponse.json({ error: "Failed to update time log" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await prisma.timeLog.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Time log not found" }, { status: 404 });
    }

    if (
      existing.userId !== auth.user.id &&
      auth.user.role.toLowerCase() !== "admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.timeLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete time log:", error);
    return NextResponse.json({ error: "Failed to delete time log" }, { status: 500 });
  }
}
