import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { sendTelegramMessage } from "@/lib/telegram";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: taskId } = await params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: true,
        executors: { include: { user: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const executorUsers =
      task.executors.length > 0
        ? task.executors.map((e) => e.user)
        : task.executor
        ? await prisma.user.findMany({
            where: {
              name: {
                in: task.executor
                  .split(",")
                  .map((n) => n.trim())
                  .filter(Boolean),
              },
            },
          })
        : [];

    const mentions = executorUsers
      .map((u) => (u.telegramUsername ? `@${u.telegramUsername.replace("@", "")}` : u.name))
      .join(", ");

    const dateStr = format(new Date(task.endDate), "dd MMM yyyy HH:mm", { locale: idLocale });
    const projectStr = task.project ? `\n📁 <b>Project:</b> ${task.project.name}` : "";

    const text =
      `🚨 <b>PENGINGAT (REMINDER) PROJECT TASK</b> 🚨\n\n` +
      `Task ini membutuhkan perhatian Anda karena status masih <b>${task.status}</b>.\n\n` +
      `📝 <b>Task:</b> ${task.title}${projectStr}\n` +
      `⏰ <b>Target Selesai (End Date):</b> ${dateStr}\n\n` +
      `Mohon segera dicek dan diselesaikan, ${mentions || task.executor || "Tim"}! 🙏`;

    // Create in-app notifications even if Telegram isn't configured in dev
    for (const u of executorUsers) {
      await prisma.notification.create({
        data: {
          userId: u.id,
          title: "Task Reminder",
          message: `Reminder by ${auth.user.name}: "${task.title}" (${task.status})`,
          type: "DEADLINE",
          link: task.projectId ? `/projects?projectId=${task.projectId}` : "/projects",
        },
      });
    }

    let telegramSent = false;
    try {
      await sendTelegramMessage(text);
      for (const u of executorUsers) {
        if (u.telegramChatId) {
          const dmText = `Halo ${u.name},\n\nAnda mendapatkan panggilan manual (PENGINGAT) dari ${auth.user.name} untuk Task berikut:\n\n${text}`;
          await sendTelegramMessage(dmText, undefined, u.telegramChatId);
        }
      }
      telegramSent = Boolean(process.env.TELEGRAM_BOT_TOKEN);
    } catch (tgErr) {
      console.error("Telegram reminder skipped/failed:", tgErr);
    }

    return NextResponse.json({ success: true, notifiedUsers: executorUsers.length, telegramSent });
  } catch (error) {
    console.error("Failed to send reminder:", error);
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}
