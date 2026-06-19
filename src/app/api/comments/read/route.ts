import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const { taskId, supportTicketId } = data;

    if (!taskId && !supportTicketId) {
      return NextResponse.json({ error: "Missing taskId or supportTicketId" }, { status: 400 });
    }

    let result;
    
    if (taskId) {
      result = await prisma.commentReadStatus.upsert({
        where: {
          userId_taskId: {
            userId: session.userId as string,
            taskId: taskId
          }
        },
        update: {
          lastReadAt: new Date()
        },
        create: {
          userId: session.userId as string,
          taskId: taskId
        }
      });
    } else if (supportTicketId) {
      result = await prisma.commentReadStatus.upsert({
        where: {
          userId_supportTicketId: {
            userId: session.userId as string,
            supportTicketId: supportTicketId
          }
        },
        update: {
          lastReadAt: new Date()
        },
        create: {
          userId: session.userId as string,
          supportTicketId: supportTicketId
        }
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to update read status:", error);
    return NextResponse.json({ error: "Failed to update read status" }, { status: 500 });
  }
}
