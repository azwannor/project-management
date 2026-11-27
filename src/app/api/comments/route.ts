import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireActiveSession } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const supportTicketId = searchParams.get("supportTicketId");

    if (!taskId && !supportTicketId) {
      return NextResponse.json({ error: "Missing taskId or supportTicketId" }, { status: 400 });
    }

    const whereClause = taskId ? { taskId } : { supportTicketId: supportTicketId! };

    const comments = await prisma.comment.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, photo: true } },
        replyTo: { include: { user: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();

    if (!data.content && !data.attachment) {
      return NextResponse.json({ error: "Comment content or attachment is required" }, { status: 400 });
    }

    if (!data.taskId && !data.supportTicketId) {
      return NextResponse.json({ error: "Missing taskId or supportTicketId" }, { status: 400 });
    }

    if (data.taskId) {
      const targetTask = await prisma.task.findUnique({
        where: { id: String(data.taskId) },
        select: { id: true },
      });
      if (!targetTask) {
        return NextResponse.json({ error: "Target task not found" }, { status: 404 });
      }
    }

    if (data.supportTicketId) {
      const targetTicket = await prisma.supportTicket.findUnique({
        where: { id: String(data.supportTicketId) },
        select: { id: true },
      });
      if (!targetTicket) {
        return NextResponse.json({ error: "Target support ticket not found" }, { status: 404 });
      }
    }

    if (data.replyToId) {
      const targetReply = await prisma.comment.findUnique({
        where: { id: String(data.replyToId) },
        select: { id: true },
      });
      if (!targetReply) {
        return NextResponse.json({ error: "Reply target comment not found" }, { status: 404 });
      }
    }

    const newComment = await prisma.comment.create({
      data: {
        content: typeof data.content === "string" ? data.content.trim() : "",
        attachment: typeof data.attachment === "string" ? data.attachment.trim() || null : null,
        attachmentKey:
          typeof data.attachmentKey === "string" ? data.attachmentKey.trim() || null : null,
        userId: auth.user.id,
        taskId: data.taskId || null,
        supportTicketId: data.supportTicketId || null,
        replyToId: data.replyToId || null,
      },
      include: {
        user: { select: { id: true, name: true, photo: true } },
        replyTo: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("Failed to post comment:", error);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
