import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { sendTelegramMessage } from "@/lib/telegram";
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

    const mentions = schedule.assignedExecutors
      .map((e) => (e.telegramUsername ? `@${e.telegramUsername.replace("@", "")}` : e.name))
      .join(", ");

    const dateStr = format(new Date(schedule.nextDueDate), "dd MMM yyyy", { locale: idLocale });

    const text =
      `🚨 <b>PENGINGAT (REMINDER) MAINTENANCE RUTIN</b> 🚨\n\n` +
      `Jadwal maintenance ini membutuhkan perhatian Anda karena status <b>${schedule.status}</b>.\n\n` +
      `📦 <b>Aset:</b> ${schedule.asset?.assetCode} - ${schedule.asset?.assetName}\n` +
      `📍 <b>Lokasi:</b> ${schedule.asset?.division?.name || schedule.asset?.location || "-"}\n` +
      `⏰ <b>Jatuh Tempo:</b> ${dateStr}\n\n` +
      `Mohon segera dicek dan diselesaikan, ${mentions || "Tim Support"}! 🙏`;

    await sendTelegramMessage(text);

    for (const u of schedule.assignedExecutors) {
      if (u.telegramChatId) {
        try {
          const dmText = `Halo ${u.name},\n\nAnda mendapatkan panggilan manual (PENGINGAT) dari ${auth.user.name} untuk Jadwal Maintenance berikut:\n\n${text}`;
          await sendTelegramMessage(dmText, undefined, u.telegramChatId);
        } catch (err) {
          console.error(`Gagal mengirim DM manual ke chat ID ${u.telegramChatId}`, err);
        }
      }
    }

    if (schedule.assignedExecutors.length > 0) {
      await prisma.notification.createMany({
        data: schedule.assignedExecutors.map((u) => ({
          userId: u.id,
          title: `Reminder Maintenance: ${schedule.asset?.assetCode || "Asset"}`,
          message: `${schedule.asset?.assetName || "Asset"} (${schedule.status}) jatuh tempo ${dateStr}.`,
          type: "MAINTENANCE",
          link: `/maintenance/schedules/${schedule.id}`,
        })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send reminder:", error);
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}
