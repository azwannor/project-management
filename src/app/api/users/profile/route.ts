import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/auth";
import { requireActiveSession } from "@/lib/api-auth";

export async function PUT(request: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const currentUser = await prisma.user.findUnique({
      where: { id: auth.user.id },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : currentUser.name;
    const emailRaw = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : currentUser.email;
    if (!emailRaw.includes("@")) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const updates: Prisma.UserUpdateInput = {
      name,
      email: emailRaw,
    };

    if (body.photo !== undefined) {
      updates.photo = typeof body.photo === "string" ? body.photo.trim() || null : null;
    }

    if (body.telegramUsername !== undefined) {
      updates.telegramUsername =
        typeof body.telegramUsername === "string"
          ? body.telegramUsername.replace(/^@+/, "").trim() || null
          : null;
    }

    if (body.telegramChatId !== undefined) {
      updates.telegramChatId =
        typeof body.telegramChatId === "string" ? body.telegramChatId.trim() || null : null;
    }

    if (body.preferredLocale === "en" || body.preferredLocale === "id") {
      updates.preferredLocale = body.preferredLocale;
    }
    if (body.preferredTheme === "light" || body.preferredTheme === "dark") {
      updates.preferredTheme = body.preferredTheme;
    }

    if (body.newPassword) {
      if (typeof body.newPassword !== "string" || body.newPassword.length < 6) {
        return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
      }
      if (!body.oldPassword || typeof body.oldPassword !== "string") {
        return NextResponse.json({ error: "Old password is required to change password" }, { status: 400 });
      }
      const isPasswordValid = await bcrypt.compare(body.oldPassword, currentUser.password);
      if (!isPasswordValid) {
        return NextResponse.json({ error: "Invalid old password" }, { status: 400 });
      }
      updates.password = await bcrypt.hash(body.newPassword, 10);
    }

    if (emailRaw !== currentUser.email.toLowerCase()) {
      const existingEmail = await prisma.user.findUnique({ where: { email: emailRaw } });
      if (existingEmail && existingEmail.id !== currentUser.id) {
        return NextResponse.json({ error: "Email is already in use" }, { status: 400 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: updates,
      select: {
        id: true,
        name: true,
        email: true,
        jobDesk: true,
        role: true,
        photo: true,
        telegramUsername: true,
        telegramChatId: true,
        handledAreas: true,
        canViewTeamLogs: true,
        canManageMaintenance: true,
        preferredLocale: true,
        preferredTheme: true,
      },
    });

    const newToken = await encrypt({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      photo: updatedUser.photo,
      canManageMaintenance: updatedUser.canManageMaintenance,
      canViewTeamLogs: updatedUser.canViewTeamLogs,
      preferredLocale: updatedUser.preferredLocale,
      preferredTheme: updatedUser.preferredTheme,
    });

    const response = NextResponse.json({ success: true, user: updatedUser });
    response.cookies.set("session", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    if (updatedUser.preferredLocale === "en" || updatedUser.preferredLocale === "id") {
      response.cookies.set("locale", updatedUser.preferredLocale, {
        httpOnly: false,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
    }
    if (updatedUser.preferredTheme === "light" || updatedUser.preferredTheme === "dark") {
      response.cookies.set("theme", updatedUser.preferredTheme, {
        httpOnly: false,
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email is already in use" }, { status: 400 });
    }
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Server error occurred" }, { status: 500 });
  }
}
