import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

export async function GET(req: Request) {
  try {
    const now = new Date();

    // 1. Process Support Tickets (Overdue if > 2 hours from startDate)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    const overdueSupport = await prisma.supportTicket.findMany({
      where: {
        status: { in: ["Ongoing", "Not Started"] },
        startDate: { lt: twoHoursAgo }
      },
      include: { executors: true }
    });

    // 2. Process Project Tasks (Overdue if > endDate)
    const overdueTasks = await prisma.task.findMany({
      where: {
        status: { in: ["Ongoing", "Not Started"] },
        endDate: { lt: now }
      },
      include: { project: true }
    });

    if (overdueSupport.length === 0 && overdueTasks.length === 0) {
      return NextResponse.json({ success: true, message: "No overdue items" });
    }

    // Build message
    let messageText = `🚨 <b>REKAP TUGAS & TIKET OVERDUE</b> 🚨\n\nHalo tim, berikut adalah daftar tugas dan tiket yang melewati batas waktu penyelesaian dan belum selesai:\n\n`;
    
    let hasContent = false;

    if (overdueSupport.length > 0) {
      messageText += `🔧 <b>SUPPORT TICKETS (> 2 Jam):</b>\n`;
      overdueSupport.forEach((ticket, idx) => {
        const mentions = ticket.executors
          .map(e => e.telegramUsername ? `@${e.telegramUsername.replace('@', '')}` : e.name)
          .join(", ");
        messageText += `${idx + 1}. ${ticket.taskName} - ${mentions || "Belum ada pelaksana"}\n`;
      });
      messageText += `\n`;
      hasContent = true;
    }

    if (overdueTasks.length > 0) {
      messageText += `📋 <b>PROJECT TASKS (Melewati End Date):</b>\n`;
      
      // Need to resolve task executors to telegram usernames
      // We will do it in bulk
      const allExecutorNames = new Set<string>();
      overdueTasks.forEach(t => {
        if (t.executor) {
          t.executor.split(",").forEach(n => allExecutorNames.add(n.trim()));
        }
      });
      
      const users = await prisma.user.findMany({
        where: { name: { in: Array.from(allExecutorNames) } }
      });
      
      const userMap = new Map();
      users.forEach(u => userMap.set(u.name, u.telegramUsername ? `@${u.telegramUsername.replace('@', '')}` : u.name));

      overdueTasks.forEach((task, idx) => {
        const executorNames = task.executor ? task.executor.split(",").map(n => n.trim()).filter(Boolean) : [];
        const mentions = executorNames.map(n => userMap.get(n) || n).join(", ");
        
        messageText += `${idx + 1}. ${task.title} - ${mentions || "Belum ada pelaksana"}\n`;
      });
      hasContent = true;
    }

    messageText += `\nMohon segera ditindaklanjuti. Terima kasih! 🙏`;

    if (hasContent) {
      await sendTelegramMessage(messageText);
    }

    return NextResponse.json({ success: true, counts: { support: overdueSupport.length, tasks: overdueTasks.length } });
  } catch (error: any) {
    console.error("Cron failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
