import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: scheduleId } = await params;
    
    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        asset: { include: { division: true } },
        template: true,
        assignedExecutors: true,
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    // Prepare mentions
    const mentions = schedule.assignedExecutors
      .map(e => e.telegramUsername ? `@${e.telegramUsername.replace('@', '')}` : e.name)
      .join(", ");

    const dateStr = format(new Date(schedule.nextDueDate), "dd MMM yyyy", { locale: id });

    const text = `🚨 <b>PENGINGAT (REMINDER) MAINTENANCE RUTIN</b> 🚨\n\n` +
      `Jadwal maintenance ini membutuhkan perhatian Anda karena status <b>${schedule.status}</b>.\n\n` +
      `📦 <b>Aset:</b> ${schedule.asset?.assetCode} - ${schedule.asset?.assetName}\n` +
      `📍 <b>Lokasi:</b> ${schedule.asset?.division?.name || schedule.asset?.location || "-"}\n` +
      `⏰ <b>Jatuh Tempo:</b> ${dateStr}\n\n` +
      `Mohon segera dicek dan diselesaikan, ${mentions ? mentions : "Tim Support"}! 🙏`;

    await sendTelegramMessage(text);

    // Send direct messages to executors if they have a chat ID
    for (const u of schedule.assignedExecutors) {
      if (u.telegramChatId) {
        try {
          const dmText = `Halo ${u.name},\n\nAnda mendapatkan panggilan manual (PENGINGAT) dari Admin untuk Jadwal Maintenance berikut:\n\n${text}`;
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
