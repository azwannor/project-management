import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

// GET /api/assets — List assets dengan filter (All authenticated users)
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const area = searchParams.get("area");
    const status = searchParams.get("status");
    const assetTypeId = searchParams.get("assetTypeId");
    const search = searchParams.get("search");

    const where: any = {};

    if (area) {
      where.area = area;
    }

    if (status) {
      where.status = status;
    }

    if (assetTypeId) {
      where.assetTypeId = assetTypeId;
    }

    if (search) {
      where.OR = [
        { assetCode: { contains: search, mode: "insensitive" } },
        { assetName: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        assetType: { select: { id: true, name: true } },
        pic: { select: { id: true, name: true } },
        _count: {
          select: { schedules: true },
        },
      },
    });

    return NextResponse.json(assets);
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

// POST /api/assets — Create asset baru (Admin only)
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden. Only admins can create assets." }, { status: 403 });
    }

    const body = await req.json();
    const {
      assetCode, assetName, assetTypeId, brand, model, serialNumber,
      area, location, status, purchaseDate, warrantyEndDate, picUserId, notes
    } = body;

    // Validasi field wajib
    if (!assetCode || !assetCode.trim()) {
      return NextResponse.json({ error: "Asset code is required" }, { status: 400 });
    }
    if (!assetName || !assetName.trim()) {
      return NextResponse.json({ error: "Asset name is required" }, { status: 400 });
    }
    if (!assetTypeId) {
      return NextResponse.json({ error: "Asset type is required" }, { status: 400 });
    }
    if (!area || !area.trim()) {
      return NextResponse.json({ error: "Area is required" }, { status: 400 });
    }

    // Validasi AssetType exists
    const assetTypeExists = await prisma.assetType.findUnique({ where: { id: assetTypeId } });
    if (!assetTypeExists) {
      return NextResponse.json({ error: "Asset type not found" }, { status: 400 });
    }

    const asset = await prisma.asset.create({
      data: {
        assetCode: assetCode.trim(),
        assetName: assetName.trim(),
        assetTypeId,
        brand: brand || null,
        model: model || null,
        serialNumber: serialNumber || null,
        area: area.trim(),
        location: location || null,
        status: status || "ACTIVE",
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        warrantyEndDate: warrantyEndDate ? new Date(warrantyEndDate) : null,
        picUserId: picUserId || null,
        notes: notes || null,
      },
      include: {
        assetType: { select: { id: true, name: true } },
        pic: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create asset:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Asset with this code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}
