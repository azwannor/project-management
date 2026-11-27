import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { sendTelegramMessage, formatHtmlForTelegram } from "@/lib/telegram";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    const mentions = ticket.executors
      .map((e) => (e.telegramUsername ? `@${e.telegramUsername.replace("@", "")}` : e.name))
      .join(", ");

    const dateStr = format(new Date(ticket.startDate), "dd MMM yyyy HH:mm", { locale: idLocale });
    const cleanedIssue = formatHtmlForTelegram(ticket.issue);
    const formattedIssue =
      cleanedIssue.length > 150 ? `${cleanedIssue.substring(0, 150)}...` : cleanedIssue || "-";

    const text =
      `🚨 <b>PENGINGAT (REMINDER) SUPPORT TICKET</b> 🚨\n\n` +
      `Tugas ini membutuhkan perhatian Anda karena status masih <b>${ticket.status}</b>.\n\n` +
      `📝 <b>Ticket:</b> ${ticket.ticketNumber ? `${ticket.ticketNumber} · ` : ""}${ticket.taskName}\n` +
      `📁 <b>Modul:</b> ${ticket.module}\n` +
      `⏰ <b>Waktu Dibuat:</b> ${dateStr}\n` +
      `⚠️ <b>Kendala:</b> ${formattedIssue}\n\n` +
      `Mohon segera dicek dan diselesaikan, ${mentions || "Tim Support"}! 🙏`;

    await sendTelegramMessage(text, {
      inline_keyboard: [[{ text: "✅ Tandai Selesai", callback_data: `done_support_${ticket.id}` }]],
    });

    for (const u of ticket.executors) {
      if (u.telegramChatId) {
        try {
          const dmText = `Halo ${u.name},\n\nAnda mendapatkan panggilan manual (PENGINGAT) dari ${auth.user.name} untuk Tiket berikut:\n\n${text}`;
          await sendTelegramMessage(dmText, undefined, u.telegramChatId);
        } catch (err) {
          console.error(`Gagal mengirim DM manual ke chat ID ${u.telegramChatId}`, err);
        }
      }
    }

    // Also record in-app reminder notifications for assigned executors
    const notifyUsers = ticket.executors.length > 0 ? ticket.executors : ticket.user ? [ticket.user] : [];
    if (notifyUsers.length > 0) {
      await prisma.notification.createMany({
        data: notifyUsers.map((u) => ({
          userId: u.id,
          title: `Reminder: ${ticket.ticketNumber || "Support Ticket"}`,
          message: `${ticket.taskName} (${ticket.status}) requires your attention.`,
          type: "DEADLINE",
          link: `/support?ticket=${ticket.id}`,
        })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send reminder:", error);
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}
