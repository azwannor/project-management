import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const isRead = typeof body?.isRead === "boolean" ? body.isRead : true;

    const notification = await prisma.notification.updateMany({
      where: {
        id,
        userId: auth.user.id,
      },
      data: { isRead },
    });

    return NextResponse.json(notification);
  } catch (error: unknown) {
    console.error("Failed to update notification:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
