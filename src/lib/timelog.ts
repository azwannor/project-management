import { Prisma, TimeLogSource } from "@prisma/client";
import prisma from "@/lib/prisma";

async function closeOpenLogsWhere(where: Prisma.TimeLogWhereInput, now: Date): Promise<number> {
  const openLogs = await prisma.timeLog.findMany({ where });
  if (openLogs.length === 0) return 0;

  let closed = 0;
  for (const log of openLogs) {
    const secs = Math.max(
      0,
      Math.round((now.getTime() - new Date(log.startTime).getTime()) / 1000)
    );
    await prisma.timeLog.update({
      where: { id: log.id },
      data: {
        endTime: now,
        durationSeconds: secs,
        duration: secs,
      },
    });
    closed += 1;
  }
  return closed;
}

/**
 * Close all active (`endTime: null`) TimeLog entries for a task and persist computed durations.
 */
export async function closeOpenTimeLogsForTask(
  taskId: string,
  now: Date = new Date()
): Promise<number> {
  return closeOpenLogsWhere({ taskId, endTime: null }, now);
}

/**
 * Close all active (`endTime: null`) TimeLog entries for a support ticket and persist computed durations.
 */
export async function closeOpenTimeLogsForTicket(
  supportTicketId: string,
  now: Date = new Date()
): Promise<number> {
  return closeOpenLogsWhere({ supportTicketId, endTime: null }, now);
}

/**
 * Open an automatic TimeLog session (`source = AUTO`) for a task if none is currently running.
 */
export async function openAutoTimeLogForTask(
  taskId: string,
  userId: string,
  now: Date = new Date()
) {
  const existing = await prisma.timeLog.findFirst({
    where: { taskId, endTime: null },
  });
  if (existing) return existing;

  return prisma.timeLog.create({
    data: {
      taskId,
      userId,
      startTime: now,
      source: TimeLogSource.AUTO,
    },
  });
}

/**
 * Open an automatic TimeLog session (`source = AUTO`) for a support ticket if none is currently running.
 */
export async function openAutoTimeLogForTicket(
  supportTicketId: string,
  userId: string,
  now: Date = new Date()
) {
  const existing = await prisma.timeLog.findFirst({
    where: { supportTicketId, endTime: null },
  });
  if (existing) return existing;

  return prisma.timeLog.create({
    data: {
      supportTicketId,
      userId,
      startTime: now,
      source: TimeLogSource.AUTO,
    },
  });
}

/**
 * Start or pause a manual focus timer (`source = MANUAL`) for a task.
 */
export async function toggleManualTaskTimer(
  taskId: string,
  userId: string,
  action: "START" | "PAUSE",
  now: Date = new Date()
) {
  if (action === "PAUSE") {
    const closed = await closeOpenTimeLogsForTask(taskId, now);
    return { action: "PAUSED" as const, closed };
  }

  // Pause any other open timer owned by this user (either on another task or a support ticket)
  await closeOpenLogsWhere(
    {
      userId,
      endTime: null,
      OR: [{ taskId: { not: taskId } }, { taskId: null }],
    },
    now
  );

  const existingOpen = await prisma.timeLog.findFirst({
    where: { taskId, endTime: null },
  });
  if (existingOpen) {
    return { action: "RUNNING" as const, timeLog: existingOpen };
  }

  const created = await prisma.timeLog.create({
    data: {
      taskId,
      userId,
      startTime: now,
      source: TimeLogSource.MANUAL,
    },
  });

  // Ensure task is Ongoing while focus timer runs
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (task && task.status !== "Ongoing") {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "Ongoing",
        startedAt: task.startedAt || now,
        actualEndDate: null,
      },
    });
  }

  return { action: "STARTED" as const, timeLog: created };
}

/**
 * Start or pause a manual focus timer (`source = MANUAL`) for a support ticket.
 */
export async function toggleManualTicketTimer(
  supportTicketId: string,
  userId: string,
  action: "START" | "PAUSE",
  now: Date = new Date()
) {
  if (action === "PAUSE") {
    const closed = await closeOpenTimeLogsForTicket(supportTicketId, now);
    return { action: "PAUSED" as const, closed };
  }

  // Pause any other open timer owned by this user (either on another ticket or a task)
  await closeOpenLogsWhere(
    {
      userId,
      endTime: null,
      OR: [{ supportTicketId: { not: supportTicketId } }, { supportTicketId: null }],
    },
    now
  );

  const existingOpen = await prisma.timeLog.findFirst({
    where: { supportTicketId, endTime: null },
  });
  if (existingOpen) {
    return { action: "RUNNING" as const, timeLog: existingOpen };
  }

  const created = await prisma.timeLog.create({
    data: {
      supportTicketId,
      userId,
      startTime: now,
      source: TimeLogSource.MANUAL,
    },
  });

  const ticket = await prisma.supportTicket.findUnique({ where: { id: supportTicketId } });
  if (ticket && ticket.status !== "Ongoing") {
    await prisma.supportTicket.update({
      where: { id: supportTicketId },
      data: {
        status: "Ongoing",
        startedAt: ticket.startedAt || now,
        ...(ticket.ticketType === "REQUEST" ? { endDate: null } : {}),
      },
    });
  }

  return { action: "STARTED" as const, timeLog: created };
}
