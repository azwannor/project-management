import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { isAuthorizedCronRequest } from "@/lib/auth";
import { classifySupportTicketDueState, classifyTaskDueState, type CronDueState } from "@/lib/cron-helpers";

function formatDueBadge(state: CronDueState, targetDate: Date, now: Date): string {
  const diffMins = Math.round((targetDate.getTime() - now.getTime()) / 60_000);
  if (state === "OVERDUE") {
    const absMins = Math.max(1, Math.abs(diffMins));
    if (absMins < 60) return `Overdue ${absMins}m`;
    const hrs = Math.round(absMins / 60);
    return hrs >= 24 ? `Overdue ${Math.round(hrs / 24)}h` : `Overdue ${hrs}j`;
  }
  const remMins = Math.max(1, diffMins);
  if (remMins < 60) return `Sisa ${remMins}m`;
  return `Sisa ${Math.max(1, Math.round(remMins / 60))}j`;
}

export async function GET(req: Request) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const nowMs = now.getTime();

    const [activeSupportTickets, slaPolicies, activeTasks] = await Promise.all([
      prisma.supportTicket.findMany({
        where: {
          ticketType: "REQUEST",
          status: { in: ["Ongoing", "Not Started"] },
        },
        include: { executors: true },
        orderBy: { slaDueAt: "asc" },
      }),
      prisma.slaPolicy.findMany({
        select: {
          priority: true,
          firstResponseMinutes: true,
          targetMinutes: true,
          reminderThresholdPercent: true,
        },
      }),
      prisma.task.findMany({
        where: {
          status: { in: ["Ongoing", "Not Started"] },
        },
        include: {
          project: { select: { name: true } },
          executors: { include: { user: true } },
        },
        orderBy: { endDate: "asc" },
      }),
    ]);

    const supportAlerts = activeSupportTickets
      .map((ticket) => {
        const state = classifySupportTicketDueState(ticket, slaPolicies, nowMs);
        return state ? { ticket, state } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const taskAlerts = activeTasks
      .map((task) => {
        const state = classifyTaskDueState(task, nowMs, 24);
        return state ? { task, state } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (supportAlerts.length === 0 && taskAlerts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No approaching or overdue items",
        counts: { support: 0, tasks: 0, dmsSent: 0 },
      });
    }

    // Resolve legacy comma-separated task executor names when TaskExecutor join table is empty
    const legacyNames = new Set<string>();
    for (const { task } of taskAlerts) {
      if (task.executors.length === 0 && task.executor) {
        task.executor.split(",").forEach((n) => {
          const clean = n.trim();
          if (clean) legacyNames.add(clean);
        });
      }
    }
    const legacyUsers = legacyNames.size
      ? await prisma.user.findMany({
          where: { name: { in: Array.from(legacyNames) } },
          select: { id: true, name: true, telegramUsername: true, telegramChatId: true },
        })
      : [];
    const legacyByName = new Map(legacyUsers.map((u) => [u.name, u]));

    let messageText =
      `⏰ <b>PENGINGAT TASK & SLA MENDEKATI / OVERDUE</b>\n` +
      `Hanya item yang mendekati batas waktu atau sudah overdue dan belum selesai:\n\n`;

    const userDMs = new Map<string, string[]>();

    if (supportAlerts.length > 0) {
      messageText += `🔧 <b>SUPPORT REQUESTS (${supportAlerts.length}):</b>\n`;
      supportAlerts.forEach(({ ticket, state }, idx) => {
        const dueDate = ticket.slaDueAt ? new Date(ticket.slaDueAt) : new Date(ticket.startDate);
        const badge = formatDueBadge(state, dueDate, now);
        const stateTag = state === "OVERDUE" ? "🚨" : "⚠️";
        const mentions =
          ticket.executors
            .map((e) => (e.telegramUsername ? `@${e.telegramUsername.replace(/^@+/, "")}` : e.name))
            .join(", ") || "Belum ada pelaksana";
        const code = ticket.ticketNumber ? `[${ticket.ticketNumber}] ` : "";
        messageText += `${idx + 1}. ${stateTag} ${code}${ticket.taskName} (${badge}) — ${mentions}\n`;

        for (const e of ticket.executors) {
          if (e.telegramChatId) {
            if (!userDMs.has(e.telegramChatId)) userDMs.set(e.telegramChatId, []);
            userDMs
              .get(e.telegramChatId)!
              .push(`${stateTag} Support ${code}<b>${ticket.taskName}</b> (${badge})`);
          }
        }
      });
      messageText += `\n`;
    }

    if (taskAlerts.length > 0) {
      messageText += `📋 <b>PROJECT TASKS (${taskAlerts.length}):</b>\n`;
      taskAlerts.forEach(({ task, state }, idx) => {
        const badge = formatDueBadge(state, new Date(task.endDate), now);
        const stateTag = state === "OVERDUE" ? "🚨" : "⚠️";
        const resolvedUsers =
          task.executors.length > 0
            ? task.executors.map((e) => e.user)
            : (task.executor || "")
                .split(",")
                .map((n) => legacyByName.get(n.trim()))
                .filter((u): u is NonNullable<typeof u> => Boolean(u));

        const mentions =
          resolvedUsers
            .map((u) => (u.telegramUsername ? `@${u.telegramUsername.replace(/^@+/, "")}` : u.name))
            .join(", ") ||
          task.executor ||
          "Belum ada pelaksana";

        const projPrefix = task.project?.name ? `[${task.project.name}] ` : "";
        messageText += `${idx + 1}. ${stateTag} ${projPrefix}${task.title} (${badge}) — ${mentions}\n`;

        for (const u of resolvedUsers) {
          if (u.telegramChatId) {
            if (!userDMs.has(u.telegramChatId)) userDMs.set(u.telegramChatId, []);
            userDMs
              .get(u.telegramChatId)!
              .push(`${stateTag} Task ${projPrefix}<b>${task.title}</b> (${badge})`);
          }
        }
      });
      messageText += `\n`;
    }

    messageText += `<i>Pengingat ini berhenti otomatis setelah status tugas/tiket selesai.</i>`;

    await sendTelegramMessage(messageText);

    for (const [chatId, messages] of userDMs.entries()) {
      const dmText =
        `⏰ <b>PENGINGAT DEADLINE TUGAS & SLA</b>\n\n` +
        `Berikut tugas/tiket Anda yang mendekati overdue atau sudah overdue:\n\n` +
        messages.map((m, i) => `${i + 1}. ${m}`).join("\n") +
        `\n\nMohon segera diselesaikan agar pengingat berhenti otomatis. 🙏`;

      await sendTelegramMessage(dmText, undefined, chatId);
    }

    return NextResponse.json({
      success: true,
      counts: {
        support: supportAlerts.length,
        tasks: taskAlerts.length,
        dmsSent: userDMs.size,
      },
    });
  } catch (error: unknown) {
    console.error("Cron failed:", error);
    const message = error instanceof Error ? error.message : "Cron execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
