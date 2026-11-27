import Link from "next/link";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { generateAssetQrSvg } from "@/lib/qr";
import AssetQrScanView from "@/components/views/maintenance/AssetQrScanView";
import PublicAssetBadgeView from "@/components/views/maintenance/PublicAssetBadgeView";

export const dynamic = "force-dynamic";

export default async function AssetQrPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [{ code }, auth] = await Promise.all([params, requireActiveSession()]);
  const decodedCode = decodeURIComponent(code).trim();

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const origin = host ? `${proto}://${host}` : undefined;

  // Mode Public (Non-Login): render only safe, non-sensitive asset identity + Sign In CTA
  if (!auth) {
    const publicAsset = await prisma.asset.findUnique({
      where: { assetCode: decodedCode },
      select: {
        assetCode: true,
        assetName: true,
        status: true,
        location: true,
        assetType: { select: { name: true } },
        division: { select: { name: true } },
      },
    });

    if (!publicAsset) {
      return (
        <div className="w-full max-w-md mx-auto px-4 py-16 text-center space-y-3">
          <p className="font-mono-code text-xs font-bold text-[var(--err)]">ASSET NOT FOUND</p>
          <h1 className="font-heading font-bold text-lg text-[var(--text-ink)]">
            Code &ldquo;{decodedCode}&rdquo; does not match any registered asset.
          </h1>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/assets/q/${encodeURIComponent(decodedCode)}`)}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold"
          >
            Sign In (IT Staff)
          </Link>
        </div>
      );
    }

    const qrSvg = await generateAssetQrSvg(publicAsset.assetCode, origin);
    return (
      <PublicAssetBadgeView
        assetCode={publicAsset.assetCode}
        assetName={publicAsset.assetName}
        status={publicAsset.status}
        location={publicAsset.location}
        divisionName={publicAsset.division?.name || null}
        assetTypeName={publicAsset.assetType?.name || null}
        qrSvg={qrSvg}
        callbackUrl={`/assets/q/${encodeURIComponent(publicAsset.assetCode)}`}
      />
    );
  }

  // Authenticated IT Staff Field-Scan Mode
  const asset = await prisma.asset.findUnique({
    where: { assetCode: decodedCode },
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
        take: 15,
        select: {
          id: true,
          ticketNumber: true,
          taskName: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      },
      schedules: {
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
          logs: {
            orderBy: { executionDate: "desc" },
            include: {
              executedBy: { select: { id: true, name: true } },
              checklistResults: true,
              supportTicket: { select: { id: true, ticketNumber: true, status: true } },
            },
          },
        },
      },
    },
  });

  if (!asset) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-16 text-center space-y-3">
        <p className="font-mono-code text-xs font-bold text-[var(--err)]">ASSET NOT FOUND</p>
        <h1 className="font-heading font-bold text-lg text-[var(--text-ink)]">
          Code &ldquo;{decodedCode}&rdquo; does not match any registered asset.
        </h1>
        <Link
          href="/maintenance"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] text-xs font-semibold"
        >
          Back to Asset Registry
        </Link>
      </div>
    );
  }

  const qrSvg = await generateAssetQrSvg(asset.assetCode, origin);

  const flatLogs = asset.schedules
    .flatMap((s) =>
      s.logs.map((l) => ({
        ...l,
        schedule: {
          id: s.id,
          scheduleType: s.scheduleType,
          asset: {
            id: asset.id,
            assetCode: asset.assetCode,
            assetName: asset.assetName,
            location: asset.location,
            division: asset.division,
          },
        },
      }))
    )
    .sort((a, b) => new Date(b.executionDate).getTime() - new Date(a.executionDate).getTime());

  return (
    <AssetQrScanView
      asset={{
        ...asset,
        purchasePrice: asset.purchasePrice ? asset.purchasePrice.toString() : null,
      }}
      schedules={asset.schedules}
      logs={flatLogs}
      qrSvg={qrSvg}
    />
  );
}
