import { AssetStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isMaintenanceAdmin } from "@/lib/auth";
import {
  ASSET_STATUS_VALUES,
  resolveAssetHolder,
  resolveAssetLocationLabel,
} from "@/lib/maintenance-helpers";

const VALID_ASSET_STATUSES = new Set<string>(ASSET_STATUS_VALUES);

const ASSET_INCLUDE = {
  assetType: { select: { id: true, name: true } },
  division: { select: { id: true, name: true } },
  locationRef: { select: { id: true, name: true } },
  pic: { select: { id: true, name: true, photo: true } },
  custodyLogs: {
    orderBy: { changedAt: "desc" as const },
    take: 15,
    include: { changedBy: { select: { id: true, name: true } } },
  },
  supportTickets: {
    orderBy: { createdAt: "desc" as const },
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
  _count: {
    select: { schedules: true, supportTickets: true, custodyLogs: true },
  },
};

// GET /api/assets — List enterprise assets with filters & custody context
export async function GET(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const divisionId = searchParams.get("divisionId");
    const status = searchParams.get("status");
    const assetTypeId = searchParams.get("assetTypeId");
    const search = searchParams.get("search");

    const where: Prisma.AssetWhereInput = {};
    if (divisionId) where.divisionId = divisionId;
    if (status && VALID_ASSET_STATUSES.has(status)) {
      where.status = status as AssetStatus;
    }
    if (assetTypeId) where.assetTypeId = assetTypeId;
    if (search) {
      where.OR = [
        { assetCode: { contains: search, mode: "insensitive" } },
        { assetName: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
        { assignedPerson: { contains: search, mode: "insensitive" } },
        { person: { contains: search, mode: "insensitive" } },
      ];
    }

    const assets = await prisma.asset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: ASSET_INCLUDE,
    });

    return NextResponse.json(assets);
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

// POST /api/assets — Create asset & initial custody record (Admin / Maintenance Manager only)
export async function POST(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json(
      { error: "Forbidden. Only maintenance admins can create assets." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const assetCode = typeof body.assetCode === "string" ? body.assetCode.trim() : "";
    const assetName = typeof body.assetName === "string" ? body.assetName.trim() : "";
    const assetTypeId = typeof body.assetTypeId === "string" ? body.assetTypeId.trim() : "";
    const divisionId = typeof body.divisionId === "string" ? body.divisionId.trim() : "";
    const locationId =
      typeof body.locationId === "string" && body.locationId.trim()
        ? body.locationId.trim()
        : null;

    if (!assetCode) {
      return NextResponse.json({ error: "Asset code is required" }, { status: 400 });
    }
    if (!assetName) {
      return NextResponse.json({ error: "Asset name is required" }, { status: 400 });
    }
    if (!assetTypeId) {
      return NextResponse.json({ error: "Asset type is required" }, { status: 400 });
    }
    if (!divisionId) {
      return NextResponse.json({ error: "Division is required" }, { status: 400 });
    }

    const [assetType, division, locationRow] = await Promise.all([
      prisma.assetType.findUnique({ where: { id: assetTypeId }, select: { id: true } }),
      prisma.division.findUnique({ where: { id: divisionId }, select: { id: true, name: true } }),
      locationId
        ? prisma.location.findUnique({ where: { id: locationId }, select: { id: true, name: true } })
        : Promise.resolve(null),
    ]);

    if (!assetType) {
      return NextResponse.json({ error: "Asset type not found" }, { status: 400 });
    }
    if (!division) {
      return NextResponse.json({ error: "Division not found" }, { status: 400 });
    }
    if (locationId && !locationRow) {
      return NextResponse.json({ error: "Location not found" }, { status: 400 });
    }

    const statusRaw = typeof body.status === "string" ? body.status : "ACTIVE";
    if (!VALID_ASSET_STATUSES.has(statusRaw)) {
      return NextResponse.json({ error: "Invalid asset status" }, { status: 400 });
    }

    const purchaseDate = body.purchaseDate ? new Date(body.purchaseDate) : null;
    if (purchaseDate && Number.isNaN(purchaseDate.getTime())) {
      return NextResponse.json({ error: "Invalid purchaseDate" }, { status: 400 });
    }
    const warrantyEndDate = body.warrantyEndDate ? new Date(body.warrantyEndDate) : null;
    if (warrantyEndDate && Number.isNaN(warrantyEndDate.getTime())) {
      return NextResponse.json({ error: "Invalid warrantyEndDate" }, { status: 400 });
    }

    const rawPrice =
      body.purchasePrice !== undefined && body.purchasePrice !== null && body.purchasePrice !== ""
        ? Number(body.purchasePrice)
        : null;
    if (rawPrice !== null && (!Number.isFinite(rawPrice) || rawPrice < 0)) {
      return NextResponse.json({ error: "Invalid purchasePrice" }, { status: 400 });
    }

    const picUserId =
      typeof body.picUserId === "string" && body.picUserId.trim() ? body.picUserId.trim() : null;
    if (picUserId) {
      const picUser = await prisma.user.findUnique({
        where: { id: picUserId },
        select: { id: true },
      });
      if (!picUser) {
        return NextResponse.json({ error: "PIC user not found" }, { status: 400 });
      }
    }

    const holderText =
      resolveAssetHolder({
        assignedPerson: body.assignedPerson,
        person: body.person,
      }) || null;
    const baseLocation =
      (typeof body.location === "string" && body.location.trim()) ||
      locationRow?.name ||
      null;
    const detailedLocation =
      typeof body.detailedLocation === "string" && body.detailedLocation.trim()
        ? body.detailedLocation.trim()
        : null;

    const created = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          assetCode,
          assetName,
          assetTypeId,
          divisionId,
          locationId: locationRow?.id || null,
          brand: typeof body.brand === "string" ? body.brand.trim() || null : null,
          model: typeof body.model === "string" ? body.model.trim() || null : null,
          serialNumber:
            typeof body.serialNumber === "string" ? body.serialNumber.trim() || null : null,
          person: holderText,
          assignedPerson: holderText,
          location: baseLocation,
          detailedLocation,
          status: statusRaw as AssetStatus,
          purchaseDate,
          purchasePrice: rawPrice !== null ? rawPrice : null,
          vendor: typeof body.vendor === "string" ? body.vendor.trim() || null : null,
          warrantyEndDate,
          picUserId,
          notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
        },
        include: ASSET_INCLUDE,
      });

      const locLabel = resolveAssetLocationLabel({ location: baseLocation, detailedLocation });
      if (holderText || locLabel || division.name) {
        await tx.assetCustodyLog.create({
          data: {
            assetId: asset.id,
            previousPerson: null,
            newPerson: holderText,
            previousLocation: null,
            newLocation: locLabel,
            previousDivision: null,
            newDivision: division.name,
            changedById: auth.user.id,
            note:
              typeof body.custodyNote === "string" && body.custodyNote.trim()
                ? body.custodyNote.trim()
                : "Initial asset registration",
          },
        });
      }

      return asset;
    });

    const refreshed = await prisma.asset.findUnique({
      where: { id: created.id },
      include: ASSET_INCLUDE,
    });

    return NextResponse.json(refreshed || created, { status: 201 });
  } catch (error: unknown) {
    console.error("Failed to create asset:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Asset with this code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}
