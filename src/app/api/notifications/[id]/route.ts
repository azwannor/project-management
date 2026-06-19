import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { isRead } = body;

    const notification = await prisma.notification.updateMany({
      where: { 
        id,
        userId: session.userId as string
      },
      data: { isRead },
    });

    return NextResponse.json(notification);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
