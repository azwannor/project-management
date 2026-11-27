import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isAdminUser, logSettingsAudit } from "@/lib/settings-helpers";

const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  jobDesk: true,
  role: true,
  photo: true,
  createdAt: true,
  telegramUsername: true,
  telegramChatId: true,
  handledAreas: true,
  canViewTeamLogs: true,
  canManageMaintenance: true,
  preferredLocale: true,
  preferredTheme: true,
  isActive: true,
} as const;

export async function GET() {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: USER_PUBLIC_SELECT,
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Forbidden. Only admins can create users." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const jobDesk = typeof body.jobDesk === "string" ? body.jobDesk.trim() : "";
    const roleRaw = typeof body.role === "string" ? body.role.trim() : "Staff";
    const role = roleRaw.toLowerCase() === "admin" ? "Admin" : "Staff";
    const telegramUsername =
      typeof body.telegramUsername === "string"
        ? body.telegramUsername.replace(/^@+/, "").trim() || null
        : null;
    const telegramChatId =
      typeof body.telegramChatId === "string" ? body.telegramChatId.trim() || null : null;
    const handledAreas = Array.isArray(body.handledAreas)
      ? body.handledAreas.filter((a: unknown): a is string => typeof a === "string" && a.trim().length > 0)
      : [];
    const canViewTeamLogs = Boolean(body.canViewTeamLogs);
    const canManageMaintenance = Boolean(body.canManageMaintenance);
    const isActive = body.isActive === undefined ? true : Boolean(body.isActive);

    if (!name || !email || !password || !jobDesk) {
      return NextResponse.json({ error: "Name, email, password, and job desk are required" }, { status: 400 });
    }
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
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
        handledAreas,
        canViewTeamLogs,
        canManageMaintenance,
        isActive,
      },
      select: USER_PUBLIC_SELECT,
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "User",
      entityId: newUser.id,
      action: "CREATE",
      diffJson: { email: newUser.email, role: newUser.role, handledAreas },
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email is already in use" }, { status: 400 });
    }
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
