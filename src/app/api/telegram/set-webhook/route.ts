import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url"); // The webhook URL to set
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json({ error: "Missing bot token" }, { status: 500 });
    }

    if (!url) {
      return NextResponse.json({ error: "Please provide the ?url= parameter with your full webhook URL" }, { status: 400 });
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Set webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
