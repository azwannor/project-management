import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { buildAssetQrUrl, generateAssetQrSvg } from "@/lib/qr";

// GET /api/assets/[id]/qr — Generate crisp vector QR sticker SVG or metadata for an Asset
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, assetCode: true, assetName: true },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const origin = req.nextUrl.origin || undefined;
    const url = buildAssetQrUrl(asset.assetCode, origin);
    const svg = await generateAssetQrSvg(asset.assetCode, origin);

    if (req.nextUrl.searchParams.get("format") === "svg") {
      return new NextResponse(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    return NextResponse.json({
      id: asset.id,
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      url,
      svg,
    });
  } catch (error) {
    console.error("Failed to generate asset QR:", error);
    return NextResponse.json({ error: "Failed to generate QR code" }, { status: 500 });
  }
}
