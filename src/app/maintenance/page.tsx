import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { generateAssetQrSvg } from "@/lib/qr";
import MaintenanceClient, { type MaintTabId } from "@/components/views/MaintenanceClient";

export const dynamic = "force-dynamic";

const VALID_TABS = new Set<MaintTabId>(["assets", "qr", "schedules", "execute", "templates"]);

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; scheduleId?: string; assetId?: string }>;
}) {
  const auth = await requireActiveSession();
  if (!auth) {
    redirect("/login");
  }

  const sp = await searchParams;
  const rawTab = typeof sp.tab === "string" ? sp.tab : "assets";
  const initialTab: MaintTabId = VALID_TABS.has(rawTab as MaintTabId)
    ? (rawTab as MaintTabId)
    : "assets";
  const initialScheduleId = typeof sp.scheduleId === "string" ? sp.scheduleId : null;
  const initialAssetId = typeof sp.assetId === "string" ? sp.assetId : null;

  const [currentUserRecord, divisions, assetTypes, locations, assets, templates, schedules, logs, allUsers] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.user.id },
        select: {
          id: true,
          name: true,
          jobDesk: true,
          role: true,
          photo: true,
          canManageMaintenance: true,
          handledAreas: true,
        },
      }),
      prisma.division.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { assets: true } } },
      }),
      prisma.assetType.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { assets: true, templates: true } } },
      }),
      prisma.location.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { assets: true } } },
      }),
      prisma.asset.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          assetType: { select: { id: true, name: true } },
          division: { select: { id: true, name: true } },
          locationRef: { select: { id: true, name: true } },
          pic: { select: { id: true, name: true, photo: true } },
          custodyLogs: {
            orderBy: { changedAt: "desc" },
            take: 15,
            include: { changedBy: { select: { id: true, name: true } } },
          },
          supportTickets: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              ticketNumber: true,
              taskName: true,
              status: true,
              priority: true,
              createdAt: true,
            },
          },
          _count: { select: { schedules: true, supportTickets: true, custodyLogs: true } },
        },
      }),
      prisma.maintenanceTemplate.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          assetType: { select: { id: true, name: true } },
          checklistItems: { orderBy: { order: "asc" } },
          _count: { select: { schedules: true } },
        },
      }),
      prisma.maintenanceSchedule.findMany({
        orderBy: { nextDueDate: "asc" },
        include: {
          asset: {
            select: {
              id: true,
              assetCode: true,
              assetName: true,
              location: true,
              detailedLocation: true,
              division: { select: { id: true, name: true } },
              assetType: { select: { id: true, name: true } },
            },
          },
          template: {
            select: {
              id: true,
              templateName: true,
              defaultFrequencyDays: true,
              reminderOffsetDays: true,
              checklistItems: { orderBy: { order: "asc" } },
            },
          },
          assignedExecutors: { select: { id: true, name: true, photo: true } },
          _count: { select: { logs: true } },
        },
      }),
      prisma.maintenanceLog.findMany({
        orderBy: { executionDate: "desc" },
        take: 50,
        include: {
          executedBy: { select: { id: true, name: true } },
          supportTicket: { select: { id: true, ticketNumber: true, status: true } },
          schedule: {
            select: {
              id: true,
              scheduleType: true,
              asset: {
                select: {
                  id: true,
                  assetCode: true,
                  assetName: true,
                  location: true,
                  division: { select: { id: true, name: true } },
                },
              },
            },
          },
          checklistResults: true,
        },
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, role: true, jobDesk: true, photo: true, handledAreas: true },
        orderBy: { name: "asc" },
      }),
    ]);

  if (!currentUserRecord) redirect("/login");

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const origin = host ? `${proto}://${host}` : undefined;

  const qrPairs = await Promise.all(
    assets.map(async (a) => [a.id, await generateAssetQrSvg(a.assetCode, origin)] as const)
  );
  const qrSvgMap = Object.fromEntries(qrPairs);

  const serializedAssets = assets.map((a) => ({
    ...a,
    purchasePrice: a.purchasePrice ? a.purchasePrice.toString() : null,
  }));

  return (
    <MaintenanceClient
      currentUser={currentUserRecord}
      divisions={divisions}
      assetTypes={assetTypes}
      locations={locations}
      assets={serializedAssets}
      templates={templates}
      schedules={schedules}
      logs={logs}
      systemUsers={allUsers}
      qrSvgMap={qrSvgMap}
      initialTab={initialTab}
      initialScheduleId={initialScheduleId}
      initialAssetId={initialAssetId}
    />
  );
}
