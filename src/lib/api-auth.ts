import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { decrypt, type SessionPayload } from "@/lib/auth";

export interface AuthenticatedContext {
  session: SessionPayload;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    photo: string | null;
    canManageMaintenance: boolean;
    canViewTeamLogs: boolean;
  };
}

/**
 * Verify the active rolling JWT session cookie and ensure the user account is active in DB.
 */
export async function requireActiveSession(): Promise<AuthenticatedContext | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = await decrypt(sessionCookie);

  if (!session || !session.userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      photo: true,
      canManageMaintenance: true,
      canViewTeamLogs: true,
      isActive: true,
    },
  });

  if (!user || user.isActive === false) {
    return null;
  }

  return {
    session,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      photo: user.photo,
      canManageMaintenance: user.canManageMaintenance,
      canViewTeamLogs: user.canViewTeamLogs,
    },
  };
}
