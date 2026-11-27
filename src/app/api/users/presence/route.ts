import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireActiveSession } from "@/lib/api-auth";

export async function POST() {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { lastActiveAt: new Date() },
    });

    // Return list of active users (active in the last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        lastActiveAt: {
          gte: fiveMinutesAgo,
        },
      },
      select: {
        id: true,
        name: true,
        photo: true,
        lastActiveAt: true,
      },
      orderBy: {
        lastActiveAt: "desc",
      },
    });

    return NextResponse.json(activeUsers);
  } catch (error) {
    console.error("Presence API error:", error);
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 });
  }
}
