import { AssetStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isMaintenanceAdmin } from "@/lib/auth";
import {
  ASSET_STATUS_VALUES,
  computeAssetCustodyDiff,
  resolveAssetHolder,
} from "@/lib/maintenance-helpers";

const VALID_ASSET_STATUSES = new Set<string>(ASSET_STATUS_VALUES);

const ASSET_DETAIL_INCLUDE = {
  assetType: { select: { id: true, name: true } },
  division: { select: { id: true, name: true } },
  locationRef: { select: { id: true, name: true } },
  pic: { select: { id: true, name: true, photo: true } },
  custodyLogs: {
    orderBy: { changedAt: "desc" as const },
    take: 25,
    include: { changedBy: { select: { id: true, name: true } } },
  },
  supportTickets: {
    orderBy: { createdAt: "desc" as const },
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
    orderBy: { nextDueDate: "desc" as const },
    include: {
      template: { select: { id: true, templateName: true } },
      assignedExecutors: { select: { id: true, name: true } },
      logs: {
        orderBy: { executionDate: "desc" as const },
        include: {
          executedBy: { select: { id: true, name: true } },
          checklistResults: true,
        },
      },
    },
  },
  _count: {
    select: { schedules: true, supportTickets: true, custodyLogs: true },
  },
};

// GET /api/assets/[id] — Full asset detail + custody history + maintenance schedules & logs
export async function GET(
  _req: Request,
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
      include: ASSET_DETAIL_INCLUDE,
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    return NextResponse.json(asset);
  } catch (error) {
    console.error("Failed to fetch asset:", error);
    return NextResponse.json({ error: "Failed to fetch asset" }, { status: 500 });
  }
}

// PATCH /api/assets/[id] — Update asset & append custody audit log on handover/move (Admin only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json(
      { error: "Forbidden. Only maintenance admins can update assets." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const existing = await prisma.asset.findUnique({
      where: { id },
      include: { division: { select: { id: true, name: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const body = await req.json();

    if (body.markQrPrinted === true) {
      const updated = await prisma.asset.update({
        where: { id },
        data: { qrPrintedAt: new Date() },
        include: ASSET_DETAIL_INCLUDE,
      });
      return NextResponse.json(updated);
    }

    const dataToUpdate: Prisma.AssetUncheckedUpdateInput = {};

    if (body.assetCode !== undefined) {
      const code = typeof body.assetCode === "string" ? body.assetCode.trim() : "";
      if (!code) return NextResponse.json({ error: "Asset code cannot be empty" }, { status: 400 });
      dataToUpdate.assetCode = code;
    }
    if (body.assetName !== undefined) {
      const name = typeof body.assetName === "string" ? body.assetName.trim() : "";
      if (!name) return NextResponse.json({ error: "Asset name cannot be empty" }, { status: 400 });
      dataToUpdate.assetName = name;
    }
    if (body.assetTypeId !== undefined) {
      const at = await prisma.assetType.findUnique({
        where: { id: String(body.assetTypeId) },
        select: { id: true },
      });
      if (!at) return NextResponse.json({ error: "Asset type not found" }, { status: 400 });
      dataToUpdate.assetTypeId = at.id;
    }

    let nextDivisionName = existing.division?.name || null;
    if (body.divisionId !== undefined) {
      const divId = typeof body.divisionId === "string" ? body.divisionId.trim() : "";
      if (!divId) return NextResponse.json({ error: "Division is required" }, { status: 400 });
      const div = await prisma.division.findUnique({
        where: { id: divId },
        select: { id: true, name: true },
      });
      if (!div) return NextResponse.json({ error: "Division not found" }, { status: 400 });
      dataToUpdate.divisionId = div.id;
      nextDivisionName = div.name;
    }

    let resolvedLocName = existing.location;
    if (body.locationId !== undefined) {
      const locId =
        typeof body.locationId === "string" && body.locationId.trim()
          ? body.locationId.trim()
          : null;
      if (locId) {
        const loc = await prisma.location.findUnique({
          where: { id: locId },
          select: { id: true, name: true },
        });
        if (!loc) return NextResponse.json({ error: "Location not found" }, { status: 400 });
        dataToUpdate.locationId = loc.id;
        resolvedLocName = loc.name;
      } else {
        dataToUpdate.locationId = null;
      }
    }

    if (body.location !== undefined) {
      resolvedLocName = typeof body.location === "string" ? body.location.trim() || null : null;
      dataToUpdate.location = resolvedLocName;
    } else if (body.locationId !== undefined && resolvedLocName) {
      dataToUpdate.location = resolvedLocName;
    }

    const nextDetailedLocation =
      body.detailedLocation !== undefined
        ? typeof body.detailedLocation === "string"
          ? body.detailedLocation.trim() || null
          : null
        : existing.detailedLocation;
    if (body.detailedLocation !== undefined) {
      dataToUpdate.detailedLocation = nextDetailedLocation;
    }

    if (body.assignedPerson !== undefined || body.person !== undefined) {
      const holder = resolveAssetHolder({
        assignedPerson: body.assignedPerson,
        person: body.person,
      });
      dataToUpdate.assignedPerson = holder;
      dataToUpdate.person = holder;
    }

    if (body.brand !== undefined) {
      dataToUpdate.brand = typeof body.brand === "string" ? body.brand.trim() || null : null;
    }
    if (body.model !== undefined) {
      dataToUpdate.model = typeof body.model === "string" ? body.model.trim() || null : null;
    }
    if (body.serialNumber !== undefined) {
      dataToUpdate.serialNumber =
        typeof body.serialNumber === "string" ? body.serialNumber.trim() || null : null;
    }
    if (body.vendor !== undefined) {
      dataToUpdate.vendor = typeof body.vendor === "string" ? body.vendor.trim() || null : null;
    }
    if (body.notes !== undefined) {
      dataToUpdate.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
    }

    if (body.status !== undefined) {
      const st = String(body.status);
      if (!VALID_ASSET_STATUSES.has(st)) {
        return NextResponse.json({ error: "Invalid asset status" }, { status: 400 });
      }
      dataToUpdate.status = st as AssetStatus;
    }

    if (body.purchaseDate !== undefined) {
      const pd = body.purchaseDate ? new Date(body.purchaseDate) : null;
      if (pd && Number.isNaN(pd.getTime())) {
        return NextResponse.json({ error: "Invalid purchaseDate" }, { status: 400 });
      }
      dataToUpdate.purchaseDate = pd;
    }
    if (body.warrantyEndDate !== undefined) {
      const wd = body.warrantyEndDate ? new Date(body.warrantyEndDate) : null;
      if (wd && Number.isNaN(wd.getTime())) {
        return NextResponse.json({ error: "Invalid warrantyEndDate" }, { status: 400 });
      }
      dataToUpdate.warrantyEndDate = wd;
    }
    if (body.purchasePrice !== undefined) {
      const rawPrice =
        body.purchasePrice !== null && body.purchasePrice !== ""
          ? Number(body.purchasePrice)
          : null;
      if (rawPrice !== null && (!Number.isFinite(rawPrice) || rawPrice < 0)) {
        return NextResponse.json({ error: "Invalid purchasePrice" }, { status: 400 });
      }
      dataToUpdate.purchasePrice = rawPrice;
    }
    if (body.picUserId !== undefined) {
      const picId =
        typeof body.picUserId === "string" && body.picUserId.trim() ? body.picUserId.trim() : null;
      if (picId) {
        const u = await prisma.user.findUnique({ where: { id: picId }, select: { id: true } });
        if (!u) return NextResponse.json({ error: "PIC user not found" }, { status: 400 });
      }
      dataToUpdate.picUserId = picId;
    }

    const nextHolder =
      dataToUpdate.assignedPerson !== undefined
        ? (dataToUpdate.assignedPerson as string | null)
        : resolveAssetHolder(existing);

    const custodyDiff = computeAssetCustodyDiff(
      {
        assignedPerson: existing.assignedPerson,
        person: existing.person,
        location: existing.location,
        detailedLocation: existing.detailedLocation,
        divisionName: existing.division?.name || null,
      },
      {
        assignedPerson: nextHolder,
        location: resolvedLocName,
        detailedLocation: nextDetailedLocation,
        divisionName: nextDivisionName,
      }
    );

    const updated = await prisma.$transaction(async (tx) => {
      if (custodyDiff) {
        await tx.assetCustodyLog.create({
          data: {
            assetId: id,
            ...custodyDiff,
            changedById: auth.user.id,
            note:
              typeof body.custodyNote === "string" && body.custodyNote.trim()
                ? body.custodyNote.trim()
                : null,
          },
        });
      }

      return tx.asset.update({
        where: { id },
        data: dataToUpdate,
        include: ASSET_DETAIL_INCLUDE,
      });
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("Failed to update asset:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Asset with this code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

// DELETE /api/assets/[id] — Soft retire asset (Admin only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json(
      { error: "Forbidden. Only maintenance admins can retire assets." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (asset.status === "RETIRED") {
      return NextResponse.json({ error: "Asset is already retired" }, { status: 400 });
    }

    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: { status: "RETIRED" },
      include: ASSET_DETAIL_INCLUDE,
    });

    return NextResponse.json({
      success: true,
      message: "Asset has been retired",
      asset: updatedAsset,
    });
  } catch (error) {
    console.error("Failed to retire asset:", error);
    return NextResponse.json({ error: "Failed to retire asset" }, { status: 500 });
  }
}
