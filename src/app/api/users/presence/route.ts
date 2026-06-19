import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (session?.userId) {
      // Update current user's lastActiveAt
      await prisma.user.update({
        where: { id: session.userId as string },
        data: { lastActiveAt: new Date() }
      });
    }

    // Return list of active users (active in the last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeUsers = await prisma.user.findMany({
      where: {
        lastActiveAt: {
          gte: fiveMinutesAgo
        }
      },
      select: {
        id: true,
        name: true,
        photo: true,
        lastActiveAt: true
      },
      orderBy: {
        lastActiveAt: 'desc'
      }
    });

    return NextResponse.json(activeUsers);
  } catch (error: any) {
    console.error("Presence API error:", error);
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 });
  }
}
