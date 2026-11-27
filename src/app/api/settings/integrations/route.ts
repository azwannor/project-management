import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isAdminUser, logSettingsAudit } from "@/lib/settings-helpers";
import { sendTelegramMessage } from "@/lib/telegram";
import { GET as runMaintenanceCron } from "@/app/api/cron/maintenance/route";
import { GET as runRemindersCron } from "@/app/api/cron/reminders/route";

export async function GET() {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:7070").replace(/\/$/, "");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const s3Configured = Boolean(
    process.env.MINIO_ENDPOINT && process.env.MINIO_ACCESS_KEY && process.env.MINIO_SECRET_KEY
  );

  let webhookUrl: string | null = null;
  let pendingUpdateCount: number | null = null;
  let webhookCheckError: string | null = null;

  if (token) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const json = await res.json();
        webhookUrl = json?.result?.url || null;
        pendingUpdateCount = typeof json?.result?.pending_update_count === "number"
          ? json.result.pending_update_count
          : null;
      }
    } catch {
      webhookCheckError = "Unable to reach Telegram API";
    }
  }

  const [overdueSchedules, dueSchedules, openTickets, recentAudits] = await Promise.all([
    prisma.maintenanceSchedule.count({ where: { status: "OVERDUE" } }),
    prisma.maintenanceSchedule.count({ where: { status: "DUE" } }),
    prisma.supportTicket.count({ where: { status: { in: ["Not Started", "Ongoing"] } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);

  return NextResponse.json({
    telegram: {
      tokenConfigured: Boolean(token),
      chatIdConfigured: Boolean(chatId),
      webhookSecretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
      webhookUrl,
      suggestedWebhookUrl: `${appUrl}/api/telegram/webhook`,
      pendingUpdateCount,
      webhookCheckError,
    },
    cron: {
      secretConfigured: Boolean(process.env.CRON_SECRET),
      overdueSchedules,
      dueSchedules,
      openTickets,
    },
    storage: {
      backend: s3Configured ? "S3 / MinIO" : "Local (.uploads)",
      bucket: process.env.MINIO_BUCKET || "ittracker-files",
      endpointConfigured: s3Configured,
    },
    recentAudits,
  });
}

export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "test-telegram") {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!token || !chatId) {
        return NextResponse.json({
          success: true,
          simulated: true,
          message: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured in .env; dry-run check succeeded.",
        });
      }
      await sendTelegramMessage(
        `✅ <b>Royal Medica IT Tracker — Test Alert</b>\nTriggered by: ${auth.user.name} (${auth.user.email})\nTimestamp: ${new Date().toISOString()}`
      );
      await logSettingsAudit({
        actorId: auth.user.id,
        entityType: "TelegramBot",
        entityId: "test-alert",
        action: "TEST_SEND",
      });
      return NextResponse.json({ success: true, simulated: false, message: "Test message sent to Telegram group chat." });
    }

    if (action === "run-cron-reminders" || action === "run-cron-maintenance") {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) {
        return NextResponse.json(
          { error: "CRON_SECRET is not configured in environment (.env); cannot trigger cron runner." },
          { status: 400 }
        );
      }

      const internalReq = new Request("http://localhost/api/cron/internal", {
        headers: { "x-cron-secret": cronSecret },
      });
      const res =
        action === "run-cron-reminders"
          ? await runRemindersCron(internalReq)
          : await runMaintenanceCron(internalReq);
      const data = await res.json();

      await logSettingsAudit({
        actorId: auth.user.id,
        entityType: "CronJob",
        entityId: action,
        action: "MANUAL_TRIGGER",
        diffJson: data,
      });

      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({ error: "Unsupported integration action" }, { status: 400 });
  } catch (error) {
    console.error("Integrations action error:", error);
    return NextResponse.json({ error: "Integration action failed" }, { status: 500 });
  }
}
