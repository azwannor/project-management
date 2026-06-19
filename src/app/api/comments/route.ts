import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const supportTicketId = searchParams.get("supportTicketId");

    if (!taskId && !supportTicketId) {
      return NextResponse.json({ error: "Missing taskId or supportTicketId" }, { status: 400 });
    }

    const whereClause = taskId ? { taskId } : { supportTicketId };

    const comments = await prisma.comment.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, photo: true } },
        replyTo: { include: { user: { select: { id: true, name: true } } } }
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(comments);
  } catch (error: any) {
    console.error("Failed to fetch comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // 1. Get current logged in user from session
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

    if (!data.content && !data.attachment) {
      return NextResponse.json({ error: "Comment content or attachment is required" }, { status: 400 });
    }

    if (!data.taskId && !data.supportTicketId) {
      return NextResponse.json({ error: "Missing taskId or supportTicketId" }, { status: 400 });
    }

    const newComment = await prisma.comment.create({
      data: {
        content: data.content || "",
        attachment: data.attachment || null,
        userId: session.userId as string,
        taskId: data.taskId || null,
        supportTicketId: data.supportTicketId || null,
        replyToId: data.replyToId || null,
      },
      include: {
        user: { select: { id: true, name: true, photo: true } },
        replyTo: { include: { user: { select: { id: true, name: true } } } }
      }
    });

    return NextResponse.json(newComment);
  } catch (error: any) {
    console.error("Failed to post comment:", error);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
