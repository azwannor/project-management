import { NextResponse } from "next/server";
import { requireActiveSession } from "@/lib/api-auth";
import { isAdminUser, logSettingsAudit } from "@/lib/settings-helpers";

async function handleSetWebhook(webhookUrl: string | null, actorId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured in environment" },
      { status: 400 }
    );
  }
  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: "Please provide a valid webhook URL" },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid webhook URL format" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    return NextResponse.json(
      { ok: false, error: "Telegram requires an HTTPS webhook URL" },
      { status: 400 }
    );
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const payload: Record<string, unknown> = { url: parsed.toString() };
  if (secret) {
    payload.secret_token = secret;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();

  await logSettingsAudit({
    actorId,
    entityType: "TelegramWebhook",
    entityId: "default",
    action: "SET_WEBHOOK",
    diffJson: { url: parsed.toString(), ok: Boolean(data?.ok) },
  });

  return NextResponse.json(data, { status: response.ok ? 200 : 400 });
}

export async function GET(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    return await handleSetWebhook(searchParams.get("url"), auth.user.id);
  } catch (error) {
    console.error("Set webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
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
    const url = typeof body?.url === "string" ? body.url.trim() : null;
    return await handleSetWebhook(url, auth.user.id);
  } catch (error) {
    console.error("Set webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
