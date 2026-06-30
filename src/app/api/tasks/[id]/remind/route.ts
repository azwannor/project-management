import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: taskId } = await params;
    
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Resolve executors to telegram usernames
    const executorNames = task.executor ? task.executor.split(",").map(n => n.trim()).filter(Boolean) : [];
    
    const users = await prisma.user.findMany({
      where: { name: { in: executorNames } }
    });

    const mentions = users
      .map(u => u.telegramUsername ? `@${u.telegramUsername.replace('@', '')}` : u.name)
      .join(", ");

    const dateStr = format(new Date(task.endDate), "dd MMM yyyy HH:mm", { locale: id });
    const projectStr = task.project ? `\n📁 <b>Project:</b> ${task.project.name}` : "";

    const text = `🚨 <b>PENGINGAT (REMINDER) PROJECT TASK</b> 🚨\n\n` +
      `Task ini membutuhkan perhatian Anda karena status masih <b>${task.status}</b>.\n\n` +
      `📝 <b>Task:</b> ${task.title}${projectStr}\n` +
      `⏰ <b>Target Selesai (End Date):</b> ${dateStr}\n\n` +
      `Mohon segera dicek dan diselesaikan, ${mentions ? mentions : task.executor || "Tim"}! 🙏`;

    await sendTelegramMessage(text);

    // Send direct messages to executors if they have a chat ID
    for (const u of users) {
      if (u.telegramChatId) {
        try {
          const dmText = `Halo ${u.name},\n\nAnda mendapatkan panggilan manual (PENGINGAT) dari Admin untuk Task berikut:\n\n${text}`;
          await sendTelegramMessage(dmText, undefined, u.telegramChatId);
        } catch (err) {
          console.error(`Gagal mengirim DM manual ke chat ID ${u.telegramChatId}`, err);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to send reminder:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
