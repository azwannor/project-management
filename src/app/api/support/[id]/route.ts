import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = await params;
    const data = await req.json();

    const existingTicket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { 
        user: { select: { name: true } },
        executors: { select: { name: true } }
      }
    });

    const { executorIds, link, ...restData } = data;
    
    // Handle endDate for REQUEST tickets automatically
    if (existingTicket?.ticketType === "REQUEST") {
      if (restData.status === "Done") {
        if (existingTicket.status !== "Done") {
          restData.endDate = new Date().toISOString();
        } else {
          delete restData.endDate; // Biarkan endDate sebelumnya jika sudah Done
        }
      } else {
        restData.endDate = null; // Kosongkan endDate jika status bukan Done
      }
    } else {
      // Untuk DAILY_ACTIVITY, update sesuai dari frontend, tapi bisa null
      if (restData.endDate === null) {
        // Biarkan null
      }
    }

    const updateData: any = {
      ...restData,
      link: link !== undefined ? link : undefined,
    };
    
    if (executorIds !== undefined) {
      updateData.executors = { set: executorIds.map((uId: string) => ({ id: uId })) };
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: updateData,
      include: {
        executors: { select: { name: true } }
      }
    });

    if (existingTicket && existingTicket.ticketType === "REQUEST" && existingTicket.priority !== "URGENT" && ticket.priority === "URGENT") {
      const reporter = existingTicket.user?.name || "Unknown";
      const requester = ticket.requesterName || reporter;
      const executorsStr = ticket.executors?.map((e: any) => e.name).join(", ") || "Not assigned";
      const { formatHtmlForTelegram } = await import("@/lib/telegram");
      const cleanIssue = formatHtmlForTelegram(ticket.issue);
      const message = `🚨 <b>URGENT TICKET DIUBAH</b> 🚨\n\n<b>Judul:</b> ${ticket.taskName}\n<b>Pelapor:</b> ${requester}\n<b>Tugas Untuk:</b> ${executorsStr}\n<b>Modul:</b> ${ticket.module}\n<b>Kendala:</b>\n${cleanIssue}\n\n<b>Link:</b> ${ticket.link || "-"}\n\n<i>Status tiket telah diubah menjadi URGENT. Silakan segera ditindaklanjuti!</i>\nCek detailnya di aplikasi IT Tracker.`;
      
      const { sendTelegramMessage } = await import("@/lib/telegram");
      await sendTelegramMessage(message);
    }
    
    if (existingTicket && existingTicket.ticketType === "REQUEST" && restData.status === "Done" && existingTicket.status !== "Done") {
      const reporter = existingTicket.user?.name || "Unknown";
      const requester = ticket.requesterName || reporter;
      const executorsStr = ticket.executors?.map((e: any) => e.name).join(", ") || "Not assigned";
      const { formatHtmlForTelegram } = await import("@/lib/telegram");
      const cleanIssue = formatHtmlForTelegram(ticket.issue);
      const cleanSolution = formatHtmlForTelegram(ticket.solution);
      const message = `✅ <b>TUGAS SELESAI</b> ✅\n\n<b>Judul:</b> ${ticket.taskName}\n<b>Pelapor:</b> ${requester}\n<b>Diselesaikan Oleh:</b> ${executorsStr}\n<b>Kendala:</b>\n${cleanIssue}\n\n<b>Solusi:</b>\n${cleanSolution}\n\n<b>Link:</b> ${ticket.link || "-"}\n\n<i>Cek detailnya di aplikasi IT Tracker.</i>`;
      
      const { sendTelegramMessage } = await import("@/lib/telegram");
      await sendTelegramMessage(message);
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { id } = await params;

    await prisma.supportTicket.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete ticket" }, { status: 500 });
  }
}
