import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tickets = await prisma.supportTicket.findMany({
      include: {
        user: { select: { name: true, jobDesk: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(tickets);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { taskName, supportType, module, startDate, endDate, issue, solution, status, attachment, priority } = body;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: session.userId as string,
        taskName,
        supportType,
        module,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        issue: issue || null,
        solution: solution || null,
        status: status || "Ongoing",
        priority: priority || "Normal",
        attachment: attachment || null
      }
    });

    if (ticket.priority === "URGENT") {
      const user = await prisma.user.findUnique({ where: { id: session.userId as string } });
      const reporter = user?.name || "Unknown";
      
      const message = `🚨 <b>URGENT TICKET MASUK</b> 🚨\n\n<b>Judul:</b> ${ticket.taskName}\n<b>Pelapor:</b> ${reporter}\n<b>Modul:</b> ${ticket.module}\n\n<i>Silakan segera ditindaklanjuti!</i>\nCek detailnya di aplikasi IT Tracker.`;
      
      const { sendTelegramMessage } = await import("@/lib/telegram");
      await sendTelegramMessage(message);
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
