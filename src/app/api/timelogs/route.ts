import { NextRequest, NextResponse } from "next/server";
import { TimeLogSource } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { toggleManualTaskTimer, toggleManualTicketTimer } from "@/lib/timelog";

export async function GET(req: NextRequest) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const taskId = req.nextUrl.searchParams.get("taskId");
    const supportTicketId = req.nextUrl.searchParams.get("supportTicketId");

    if (!taskId && !supportTicketId) {
      return NextResponse.json({ error: "Missing taskId or supportTicketId" }, { status: 400 });
    }

    const logs = await prisma.timeLog.findMany({
      where: taskId ? { taskId } : { supportTicketId: supportTicketId! },
      include: {
        user: { select: { id: true, name: true, photo: true } },
      },
      orderBy: { startTime: "desc" },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to fetch timelogs:", error);
    return NextResponse.json({ error: "Failed to fetch time logs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const taskId = typeof body.taskId === "string" && body.taskId.trim() ? body.taskId.trim() : null;
    const supportTicketId =
      typeof body.supportTicketId === "string" && body.supportTicketId.trim()
        ? body.supportTicketId.trim()
        : null;

    if (!taskId && !supportTicketId) {
      return NextResponse.json({ error: "taskId or supportTicketId is required" }, { status: 400 });
    }

    if (taskId) {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      if (body.action === "START" || body.action === "PAUSE") {
        const result = await toggleManualTaskTimer(taskId, auth.user.id, body.action);
        return NextResponse.json(result);
      }
    } else if (supportTicketId) {
      const ticket = await prisma.supportTicket.findUnique({ where: { id: supportTicketId } });
      if (!ticket) {
        return NextResponse.json({ error: "Support ticket not found" }, { status: 404 });
      }
      if (body.action === "START" || body.action === "PAUSE") {
        const result = await toggleManualTicketTimer(supportTicketId, auth.user.id, body.action);
        return NextResponse.json(result);
      }
    }

    // Manual duration logging (override / manual entry)
    const rawDuration =
      body.durationSeconds !== undefined
        ? Number(body.durationSeconds)
        : Number(body.durationMinutes) * 60;

    if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
      return NextResponse.json(
        { error: "Duration must be a finite number greater than 0" },
        { status: 400 }
      );
    }

    const durationSeconds = Math.round(rawDuration);
    const endTime = body.endTime ? new Date(body.endTime) : new Date();
    if (Number.isNaN(endTime.getTime())) {
      return NextResponse.json({ error: "Invalid endTime" }, { status: 400 });
    }
    const startTime = body.startTime
      ? new Date(body.startTime)
      : new Date(endTime.getTime() - durationSeconds * 1000);
    if (Number.isNaN(startTime.getTime())) {
      return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
    }

    const log = await prisma.timeLog.create({
      data: {
        taskId,
        supportTicketId,
        userId: auth.user.id,
        startTime,
        endTime,
        durationSeconds,
        duration: durationSeconds,
        source: TimeLogSource.MANUAL,
        note: typeof body.note === "string" ? body.note.trim() || null : null,
      },
      include: {
        user: { select: { id: true, name: true, photo: true } },
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Failed to save time log:", error);
    return NextResponse.json({ error: "Failed to save time log" }, { status: 500 });
  }
}
