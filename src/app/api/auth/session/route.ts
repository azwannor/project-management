import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = await decrypt(sessionCookie);

  if (!session) {
    return NextResponse.json({ user: null });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      photo: true,
      canManageMaintenance: true,
      canViewTeamLogs: true,
      preferredLocale: true,
      preferredTheme: true,
      isActive: true,
    },
  });

  if (!dbUser || dbUser.isActive === false) {
    const res = NextResponse.json({ user: null });
    res.cookies.delete("session");
    return res;
  }

  return NextResponse.json({
    user: {
      ...session,
      name: dbUser.name,
      role: dbUser.role,
      photo: dbUser.photo,
      canManageMaintenance: dbUser.canManageMaintenance,
      canViewTeamLogs: dbUser.canViewTeamLogs,
      preferredLocale: dbUser.preferredLocale,
      preferredTheme: dbUser.preferredTheme,
    },
  });
}
