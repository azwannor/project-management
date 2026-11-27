import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isMaintenanceAdmin } from "@/lib/auth";

// POST /api/assets/qr-printed — Batch stamp `qrPrintedAt` after generating sticker print sheet
export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const assetIds: string[] = Array.isArray(body.assetIds)
      ? body.assetIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    if (assetIds.length === 0) {
      return NextResponse.json({ error: "assetIds array is required" }, { status: 400 });
    }

    const now = new Date();
    const updated = await prisma.asset.updateMany({
      where: { id: { in: assetIds } },
      data: { qrPrintedAt: now },
    });

    return NextResponse.json({ updatedCount: updated.count, qrPrintedAt: now.toISOString() });
  } catch (error) {
    console.error("Failed to mark QR printed:", error);
    return NextResponse.json({ error: "Failed to stamp QR printed time" }, { status: 500 });
  }
}
