import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAuthorizedCronRequest } from "@/lib/auth";

function isSameCalendarDay(a: Date | null | undefined, b: Date): boolean {
  if (!a) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// GET /api/cron/maintenance — Cron job harian: mendekati due & overdue sampai status DONE
export async function GET(req: Request) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    let overdueCount = 0;
    let dueCount = 0;
    let notificationCount = 0;
    let telegramCount = 0;

    const { sendTelegramMessage } = await import("@/lib/telegram");
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:7070").replace(/\/$/, "");

    const activeSchedules = await prisma.maintenanceSchedule.findMany({
      where: {
        status: { not: "DONE" },
      },
      include: {
        asset: {
          select: {
            id: true,
            assetCode: true,
            assetName: true,
            location: true,
            division: { select: { name: true } },
          },
        },
        template: { select: { reminderOffsetDays: true, templateName: true } },
        assignedExecutors: {
          select: { id: true, name: true, telegramUsername: true, telegramChatId: true },
        },
      },
    });

    for (const schedule of activeSchedules) {
      const dueDate = new Date(schedule.nextDueDate);
      dueDate.setHours(0, 0, 0, 0);

      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const reminderOffset = schedule.template?.reminderOffsetDays || 3;
      const alreadyRemindedToday = isSameCalendarDay(schedule.lastRemindedAt, now);

      const formUrl = `${appUrl}/maintenance?tab=execute`;
      const replyMarkup = {
        inline_keyboard: [[{ text: "📝 Open Maintenance Form", url: formUrl }]],
      };

      if (daysUntilDue < 0) {
        if (schedule.status !== "OVERDUE") {
          await prisma.maintenanceSchedule.update({
            where: { id: schedule.id },
            data: { status: "OVERDUE" },
          });
        }

        if (!alreadyRemindedToday) {
          const daysOverdue = Math.abs(daysUntilDue);
          for (const executor of schedule.assignedExecutors) {
            await prisma.notification.create({
              data: {
                userId: executor.id,
                title: "⚠️ Maintenance OVERDUE",
                message: `Maintenance "${schedule.asset.assetName}" (${schedule.asset.assetCode}) terlambat ${daysOverdue} hari!`,
                type: "DEADLINE",
                link: `/maintenance/schedules/${schedule.id}`,
              },
            });
            notificationCount++;
          }

          const mentionList =
            schedule.assignedExecutors
              .map((e) => (e.telegramUsername ? `@${e.telegramUsername.replace(/^@+/, "")}` : e.name))
              .join(", ") || "Tim IT";

          const tgMessage =
            `⚠️ <b>MAINTENANCE OVERDUE!</b> ⚠️\n\n` +
            `📌 <b>Asset:</b> ${schedule.asset.assetName} (${schedule.asset.assetCode})\n` +
            `🏢 <b>Location:</b> ${schedule.asset.location || "-"} (${schedule.asset.division?.name || "-"})\n` +
            `⏳ <b>Overdue:</b> ${daysOverdue} Hari (Due: ${dueDate.toLocaleDateString("id-ID")})\n` +
            `👤 <b>Executor:</b> ${mentionList}\n\n` +
            `<i>Pengingat ini berjalan harian sampai maintenance diselesaikan.</i>`;
          await sendTelegramMessage(tgMessage, replyMarkup);
          telegramCount++;

          await prisma.maintenanceSchedule.update({
            where: { id: schedule.id },
            data: { lastRemindedAt: now },
          });
        }
        overdueCount++;
      } else if (daysUntilDue <= reminderOffset && daysUntilDue >= 0) {
        if (schedule.status === "UPCOMING") {
          await prisma.maintenanceSchedule.update({
            where: { id: schedule.id },
            data: { status: "DUE" },
          });
        }

        if (!alreadyRemindedToday) {
          for (const executor of schedule.assignedExecutors) {
            await prisma.notification.create({
              data: {
                userId: executor.id,
                title: "🔔 Reminder Maintenance",
                message:
                  daysUntilDue === 0
                    ? `Maintenance "${schedule.asset.assetName}" jatuh tempo HARI INI!`
                    : `Maintenance "${schedule.asset.assetName}" (${schedule.asset.assetCode}) jatuh tempo dalam ${daysUntilDue} hari.`,
                type: "DEADLINE",
                link: `/maintenance/schedules/${schedule.id}`,
              },
            });
            notificationCount++;
          }

          const mentionList =
            schedule.assignedExecutors
              .map((e) => (e.telegramUsername ? `@${e.telegramUsername.replace(/^@+/, "")}` : e.name))
              .join(", ") || "Tim IT";
          const dueText = daysUntilDue === 0 ? "HARI INI" : `dalam ${daysUntilDue} hari`;
          const tgMessage =
            `🔔 <b>REMINDER MAINTENANCE (MENDEKATI DUE)</b> 🔔\n\n` +
            `📌 <b>Aset:</b> ${schedule.asset.assetName} (${schedule.asset.assetCode})\n` +
            `🏢 <b>Location:</b> ${schedule.asset.location || "-"} (${schedule.asset.division?.name || "-"})\n` +
            `⏳ <b>Jatuh Tempo:</b> ${dueDate.toLocaleDateString("id-ID")} (${dueText})\n` +
            `👤 <b>Executor:</b> ${mentionList}\n\n` +
            `Silakan selesaikan maintenance pada jadwal terkait.`;
          await sendTelegramMessage(tgMessage, replyMarkup);
          telegramCount++;

          await prisma.maintenanceSchedule.update({
            where: { id: schedule.id },
            data: { lastRemindedAt: now },
          });
        }
        dueCount++;
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: {
        totalActiveSchedules: activeSchedules.length,
        overdue: overdueCount,
        due: dueCount,
        notificationsSent: notificationCount,
        telegramSent: telegramCount,
      },
    });
  } catch (error) {
    console.error("Cron maintenance failed:", error);
    return NextResponse.json({ error: "Cron maintenance failed" }, { status: 500 });
  }
}
