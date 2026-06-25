import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/cron/maintenance — Cron job harian: overdue detection + reminder flagging
// Auth: x-cron-secret header (bukan cookie session)
export async function GET(req: Request) {
  try {
    // Auth via secret key
    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let overdueCount = 0;
    let dueCount = 0;
    let notificationCount = 0;
    let telegramCount = 0;

    const { sendTelegramMessage } = await import("@/lib/telegram");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // 1. Ambil semua schedule yang belum DONE
    const activeSchedules = await prisma.maintenanceSchedule.findMany({
      where: {
        status: { not: "DONE" },
      },
      include: {
        asset: { select: { id: true, assetCode: true, assetName: true, area: true } },
        template: { select: { reminderOffsetDays: true, templateName: true } },
        assignedExecutors: { select: { id: true, name: true, telegramUsername: true } },
      },
    });

    for (const schedule of activeSchedules) {
      const dueDate = new Date(schedule.nextDueDate);
      dueDate.setHours(0, 0, 0, 0);

      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const reminderOffset = schedule.template?.reminderOffsetDays || 3;
      
      const formUrl = `${appUrl}/maintenance?tab=logs`;
      const replyMarkup = {
        inline_keyboard: [[{ text: "📝 Open Maintenance Form", url: formUrl }]]
      };

      // --- OVERDUE: nextDueDate sudah lewat ---
      if (daysUntilDue < 0) {
        // Update status ke OVERDUE jika belum
        if (schedule.status !== "OVERDUE") {
          await prisma.maintenanceSchedule.update({
            where: { id: schedule.id },
            data: { status: "OVERDUE" },
          });
        }

        // Kirim notifikasi overdue setiap 2 hari
        // Cek apakah sudah pernah kirim notifikasi overdue hari ini
        const daysOverdue = Math.abs(daysUntilDue);
        if (daysOverdue === 1 || daysOverdue % 2 === 0) {
          // Buat notifikasi untuk semua executor
          for (const executor of schedule.assignedExecutors) {
            await prisma.notification.create({
              data: {
                userId: executor.id,
                title: "⚠️ Maintenance OVERDUE",
                message: `Maintenance for "${schedule.asset.assetName}" (${schedule.asset.assetCode}) is ${daysOverdue} days overdue! Please complete it immediately.`,
                type: "DEADLINE",
                link: `/maintenance/schedules/${schedule.id}`,
              },
            });
            notificationCount++;

            // Telegram Notif
            if (executor.telegramUsername) {
              const tgUsername = executor.telegramUsername.startsWith('@') ? executor.telegramUsername : `@${executor.telegramUsername}`;
              const tgMessage = `⚠️ <b>MAINTENANCE OVERDUE!</b> ⚠️\n\nMaintenance for the following asset is <b>OVERDUE!</b>\n\n📌 <b>Asset:</b> ${schedule.asset.assetName} (${schedule.asset.assetCode})\n🏢 <b>Area:</b> ${schedule.asset.area}\n⏳ <b>Overdue:</b> ${daysOverdue} Days (Due Date: ${dueDate.toLocaleDateString("en-US")})\n👤 <b>Executor:</b> ${tgUsername}\n\nPlease perform the maintenance immediately and log the results into the system!`;
              await sendTelegramMessage(tgMessage, replyMarkup);
              telegramCount++;
            }
          }
        }

        overdueCount++;
      }
      // --- DUE: mendekati jatuh tempo (sesuai reminderOffsetDays) ---
      else if (daysUntilDue <= reminderOffset && daysUntilDue >= 0) {
        // Update status ke DUE jika masih UPCOMING
        if (schedule.status === "UPCOMING") {
          await prisma.maintenanceSchedule.update({
            where: { id: schedule.id },
            data: { status: "DUE" },
          });
        }

        // Kirim reminder hanya di hari yang tepat sesuai offset (H-7, H-3, H-1)
        if (daysUntilDue === reminderOffset || daysUntilDue === 1 || daysUntilDue === 0) {
          for (const executor of schedule.assignedExecutors) {
            await prisma.notification.create({
              data: {
                userId: executor.id,
                title: "🔔 Reminder Maintenance",
                message: daysUntilDue === 0
                  ? `Maintenance "${schedule.asset.assetName}" jatuh tempo HARI INI!`
                  : `Maintenance "${schedule.asset.assetName}" (${schedule.asset.assetCode}) jatuh tempo dalam ${daysUntilDue} hari (${dueDate.toLocaleDateString("id-ID")}).`,
                type: "DEADLINE",
                link: `/maintenance/schedules/${schedule.id}`,
              },
            });
            notificationCount++;

            // Telegram Notif
            if (executor.telegramUsername) {
              const tgUsername = executor.telegramUsername.startsWith('@') ? executor.telegramUsername : `@${executor.telegramUsername}`;
              const dueText = daysUntilDue === 0 ? "HARI INI" : `dalam ${daysUntilDue} hari`;
              const tgMessage = `🔔 <b>REMINDER MAINTENANCE</b> 🔔\n\nMaintenance rutin untuk aset berikut akan segera jatuh tempo.\n\n📌 <b>Aset:</b> ${schedule.asset.assetName} (${schedule.asset.assetCode})\n🏢 <b>Area:</b> ${schedule.asset.area}\n⏳ <b>Jatuh Tempo:</b> ${dueDate.toLocaleDateString("id-ID")} (${dueText})\n👤 <b>Executor:</b> ${tgUsername}\n\nSilakan siapkan kebutuhan maintenance dan isi form jika sudah selesai.`;
              await sendTelegramMessage(tgMessage, replyMarkup);
              telegramCount++;
            }
          }
        }

        dueCount++;
      }
      // --- UPCOMING: masih jauh, skip ---
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
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

