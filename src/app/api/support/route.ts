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
        user: { select: { name: true, jobDesk: true } },
        executors: { select: { id: true, name: true } }
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
    const { taskName, supportType, module, startDate, endDate, issue, solution, status, attachment, priority, ticketType, requesterName, executorIds, link } = body;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: session.userId as string,
        taskName,
        supportType,
        module,
        startDate: new Date(startDate),
        endDate: ticketType === "REQUEST" ? null : (endDate ? new Date(endDate) : null),
        issue: issue || null,
        solution: solution || null,
        status: status || "Ongoing",
        priority: priority || "Normal",
        attachment: attachment || null,
        link: link || null,
        ticketType: ticketType || "DAILY_ACTIVITY",
        requesterName: requesterName || null,
        executors: executorIds && executorIds.length > 0 ? { connect: executorIds.map((id: string) => ({ id })) } : undefined
      },
      include: {
        executors: { select: { name: true } }
      }
    });

    // Kirim notifikasi Telegram untuk SEMUA tiket baru sesuai permintaan
    const user = await prisma.user.findUnique({ where: { id: session.userId as string } });
    const reporter = user?.name || "Unknown";
    
    const { formatHtmlForTelegram, sendTelegramMessage } = await import("@/lib/telegram");
    const cleanIssue = formatHtmlForTelegram(ticket.issue);
    if (ticket.ticketType === "REQUEST") {
      const executorNames = ticket.executors.map((e: any) => e.name).join(", ") || "Belum ditentukan";
      const message = `🆘 <b>SUPPORT REQUEST BARU</b> 🆘\n\n<b>Judul:</b> ${ticket.taskName}\n<b>Pelapor:</b> ${ticket.requesterName || reporter}\n<b>Dibuat Oleh:</b> ${reporter}\n<b>Tugas Untuk:</b> ${executorNames}\n<b>Modul:</b> ${ticket.module}\n<b>Kendala:</b>\n${cleanIssue}\n\n<b>Link:</b> ${ticket.link || "-"}\n<b>Prioritas:</b> ${ticket.priority}\n\n<i>Silakan segera ditindaklanjuti!</i>\nCek detailnya di aplikasi IT Tracker.`;
      
      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: "✅ Tandai Selesai",
              callback_data: `done_support_${ticket.id}`
            }
          ]
        ]
      };
      
      await sendTelegramMessage(message, replyMarkup);
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
