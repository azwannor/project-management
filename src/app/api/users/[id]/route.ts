import { NextRequest, NextResponse } from "next/server";
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Forbidden. Only admins can update users." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const dataToUpdate: Prisma.UserUpdateInput = {};

    if (typeof body.name === "string" && body.name.trim()) {
      dataToUpdate.name = body.name.trim();
    }
    if (typeof body.email === "string" && body.email.trim()) {
      const normalized = body.email.trim().toLowerCase();
      if (!normalized.includes("@")) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
      dataToUpdate.email = normalized;
    }
    if (typeof body.jobDesk === "string" && body.jobDesk.trim()) {
      dataToUpdate.jobDesk = body.jobDesk.trim();
    }
    if (typeof body.role === "string" && body.role.trim()) {
      dataToUpdate.role = body.role.trim().toLowerCase() === "admin" ? "Admin" : "Staff";
    }
    if (body.telegramUsername !== undefined) {
      dataToUpdate.telegramUsername =
        typeof body.telegramUsername === "string"
          ? body.telegramUsername.replace(/^@+/, "").trim() || null
          : null;
    }
    if (body.telegramChatId !== undefined) {
      dataToUpdate.telegramChatId =
        typeof body.telegramChatId === "string" ? body.telegramChatId.trim() || null : null;
    }
    if (body.handledAreas !== undefined) {
      if (!Array.isArray(body.handledAreas)) {
        return NextResponse.json({ error: "handledAreas must be an array" }, { status: 400 });
      }
      dataToUpdate.handledAreas = body.handledAreas.filter(
        (a: unknown): a is string => typeof a === "string" && a.trim().length > 0
      );
    }
    if (body.canViewTeamLogs !== undefined) {
      dataToUpdate.canViewTeamLogs = Boolean(body.canViewTeamLogs);
    }
    if (body.canManageMaintenance !== undefined) {
      dataToUpdate.canManageMaintenance = Boolean(body.canManageMaintenance);
    }
    if (body.isActive !== undefined) {
      if (id === auth.user.id && body.isActive === false) {
        return NextResponse.json({ error: "You cannot deactivate your own active admin account" }, { status: 400 });
      }
      dataToUpdate.isActive = Boolean(body.isActive);
    }
    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      dataToUpdate.password = await bcrypt.hash(body.password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: USER_PUBLIC_SELECT,
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "User",
      entityId: id,
      action: "UPDATE",
      diffJson: {
        role: updatedUser.role,
        canViewTeamLogs: updatedUser.canViewTeamLogs,
        canManageMaintenance: updatedUser.canManageMaintenance,
        isActive: updatedUser.isActive,
        handledAreasCount: updatedUser.handledAreas.length,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email is already in use" }, { status: 400 });
    }
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Forbidden. Only admins can delete users." }, { status: 403 });
  }

  try {
    const { id } = await params;

    if (id === auth.user.id) {
      return NextResponse.json({ error: "You cannot delete your own active account" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "User",
      entityId: id,
      action: "DELETE",
      diffJson: { email: user.email },
    });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Failed to delete user. Please make sure they are not assigned to tasks, logs, or schedules." },
      { status: 400 }
    );
  }
}
