import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: ticketId } = await params;
    
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: true,
        executors: true,
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Prepare mentions
    const mentions = ticket.executors
      .map(e => e.telegramUsername ? `@${e.telegramUsername.replace('@', '')}` : e.name)
      .join(", ");

    const dateStr = format(new Date(ticket.startDate), "dd MMM yyyy HH:mm", { locale: id });
    const formattedIssue = ticket.issue ? ticket.issue.replace(/<[^>]*>?/gm, '').substring(0, 150) + "..." : "-";

    const text = `🚨 <b>PENGINGAT (REMINDER) SUPPORT TICKET</b> 🚨\n\n` +
      `Tugas ini membutuhkan perhatian Anda karena status masih <b>${ticket.status}</b>.\n\n` +
      `📝 <b>Ticket:</b> ${ticket.taskName}\n` +
      `📁 <b>Modul:</b> ${ticket.module}\n` +
      `⏰ <b>Waktu Dibuat:</b> ${dateStr}\n` +
      `⚠️ <b>Kendala:</b> ${formattedIssue}\n\n` +
      `Mohon segera dicek dan diselesaikan, ${mentions ? mentions : "Tim Support"}! 🙏`;

    await sendTelegramMessage(text);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to send reminder:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
