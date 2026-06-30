import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, jobDesk: true, role: true, photo: true, createdAt: true, telegramUsername: true, telegramChatId: true, handledAreas: true }
    });
    return NextResponse.json(users);
  } catch (error: any) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    const session = await decrypt(sessionCookie);

    if (!session || session.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized. Only admins can create users.' }, { status: 403 });
    }

    const { name, email, password, jobDesk, role, telegramUsername, telegramChatId, handledAreas } = await request.json();

    if (!name || !email || !password || !jobDesk || !role) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email is already in use' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        jobDesk,
        role,
        telegramUsername,
        telegramChatId,
        handledAreas: handledAreas || []
      },
      select: { id: true, name: true, email: true, jobDesk: true, role: true, telegramUsername: true, telegramChatId: true, handledAreas: true }
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (error: any) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
