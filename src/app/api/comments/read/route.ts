import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireActiveSession } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json().catch(() => null);
    if (!data) {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const { taskId, supportTicketId } = data;

    if (!taskId && !supportTicketId) {
      return NextResponse.json({ error: "Missing taskId or supportTicketId" }, { status: 400 });
    }

    const now = new Date();
    let result;

    if (taskId) {
      const targetId = String(taskId);
      try {
        result = await prisma.commentReadStatus.upsert({
          where: { userId_taskId: { userId: auth.user.id, taskId: targetId } },
          update: { lastReadAt: now },
          create: { userId: auth.user.id, taskId: targetId, lastReadAt: now },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          result = await prisma.commentReadStatus.update({
            where: { userId_taskId: { userId: auth.user.id, taskId: targetId } },
            data: { lastReadAt: now },
          });
        } else {
          throw err;
        }
      }
    } else if (supportTicketId) {
      const targetId = String(supportTicketId);
      try {
        result = await prisma.commentReadStatus.upsert({
          where: {
            userId_supportTicketId: { userId: auth.user.id, supportTicketId: targetId },
          },
          update: { lastReadAt: now },
          create: { userId: auth.user.id, supportTicketId: targetId, lastReadAt: now },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          result = await prisma.commentReadStatus.update({
            where: {
              userId_supportTicketId: { userId: auth.user.id, supportTicketId: targetId },
            },
            data: { lastReadAt: now },
          });
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update read status:", error);
    return NextResponse.json({ error: "Failed to update read status" }, { status: 500 });
  }
}
