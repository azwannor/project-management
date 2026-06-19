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
      include: { user: { select: { name: true } } }
    });

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data
    });

    if (existingTicket && existingTicket.priority !== "URGENT" && ticket.priority === "URGENT") {
      const reporter = existingTicket.user?.name || "Unknown";
      const message = `🚨 <b>URGENT TICKET DIUBAH</b> 🚨\n\n<b>Judul:</b> ${ticket.taskName}\n<b>Pelapor:</b> ${reporter}\n<b>Modul:</b> ${ticket.module}\n\n<i>Status tiket telah diubah menjadi URGENT. Silakan segera ditindaklanjuti!</i>\nCek detailnya di aplikasi IT Tracker.`;
      
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
