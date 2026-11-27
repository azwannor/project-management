import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { decrypt } from "@/lib/auth";
import prisma from "@/lib/prisma";
import SettingsClient from "@/components/views/SettingsClient";
import type { SettingsUser } from "@/components/views/settings/types";

const SLA_PRIORITY_ORDER = ["Urgent", "High", "Normal", "Low"];

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  const session = await decrypt(sessionCookie);

  if (!session || !session.userId) {
    redirect("/login");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
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
      isActive: true,
    },
  });

  if (!currentUser || currentUser.isActive === false) {
    redirect("/login");
  }

  const isAdmin = currentUser.role?.toLowerCase() === "admin";

  if (!isAdmin) {
    return (
      <SettingsClient
        initialCurrentUser={currentUser}
        initialUsers={[]}
        initialDivisions={[]}
        initialLocations={[]}
        initialAssetTypes={[]}
        initialRegionalAreas={[]}
        initialSupportModules={[]}
        initialSlaPolicies={[]}
        initialExternalKeys={[]}
      />
    );
  }

  const [
    allUsers,
    divisions,
    locations,
    assetTypes,
    regionalAreas,
    supportModules,
    slaPoliciesRaw,
    externalKeys,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
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
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.division.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { assets: true } } },
    }),
    prisma.location.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { assets: true } } },
    }),
    prisma.assetType.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { assets: true, templates: true } } },
    }),
    prisma.regionalArea.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true },
    }),
    prisma.supportModule.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { categories: { orderBy: { name: "asc" } } },
    }),
    prisma.slaPolicy.findMany(),
    prisma.externalApiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        sourceApp: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const slaPolicies = [...slaPoliciesRaw].sort(
    (a, b) => SLA_PRIORITY_ORDER.indexOf(a.priority) - SLA_PRIORITY_ORDER.indexOf(b.priority)
  );

  return (
    <SettingsClient
      initialCurrentUser={currentUser}
      initialUsers={allUsers as SettingsUser[]}
      initialDivisions={divisions}
      initialLocations={locations}
      initialAssetTypes={assetTypes}
      initialRegionalAreas={regionalAreas}
      initialSupportModules={supportModules}
      initialSlaPolicies={slaPolicies}
      initialExternalKeys={externalKeys}
    />
  );
}
