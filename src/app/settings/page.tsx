import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";
import prisma from "@/lib/prisma";
import SettingsClient from "@/components/views/SettingsClient";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = await decrypt(sessionCookie);

  if (!session || !session.userId) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, jobDesk: true, role: true, photo: true, telegramUsername: true, telegramChatId: true, canViewTeamLogs: true },
  });

  if (!currentUser) {
    redirect("/login");
  }

  // Fetch all users for admin
  let allUsers: any[] = [];
  if (currentUser.role?.toLowerCase() === "admin") {
    allUsers = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, jobDesk: true, role: true, photo: true, telegramUsername: true, telegramChatId: true, createdAt: true, handledAreas: true, canViewTeamLogs: true },
    });
  }

  return <SettingsClient currentUser={currentUser} allUsers={allUsers} />;
}
