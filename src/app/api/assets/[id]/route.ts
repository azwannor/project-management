import { isMaintenanceAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

// GET /api/assets/[id] — Detail asset + riwayat maintenance (All authenticated users)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        assetType: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        pic: { select: { id: true, name: true } },
        schedules: {
          orderBy: { nextDueDate: "desc" },
          include: {
            template: { select: { id: true, templateName: true } },
            assignedExecutors: { select: { id: true, name: true } },
            logs: {
              orderBy: { executionDate: "desc" },
              include: {
                executedBy: { select: { id: true, name: true } },
                checklistResults: true,
              },
            },
          },
        },
      },
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

// PATCH /api/assets/[id] — Update asset (Admin only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isMaintenanceAdmin(session)) {
      return NextResponse.json({ error: "Forbidden. Only admins can update assets." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      assetCode, assetName, assetTypeId, divisionId, brand, model, serialNumber,
      person, location, detailedLocation, status, purchaseDate, warrantyEndDate, picUserId, notes
    } = body;

    const dataToUpdate: any = {};

    if (assetCode !== undefined) dataToUpdate.assetCode = assetCode.trim();
    if (assetName !== undefined) dataToUpdate.assetName = assetName.trim();
    if (assetTypeId !== undefined) dataToUpdate.assetTypeId = assetTypeId;
    if (brand !== undefined) dataToUpdate.brand = brand || null;
    if (model !== undefined) dataToUpdate.model = model || null;
    if (serialNumber !== undefined) dataToUpdate.serialNumber = serialNumber || null;
    if (divisionId !== undefined) dataToUpdate.divisionId = divisionId.trim();
    if (person !== undefined) dataToUpdate.person = person || null;
    if (location !== undefined) dataToUpdate.location = location || null;
    if (detailedLocation !== undefined) dataToUpdate.detailedLocation = detailedLocation || null;
    if (status !== undefined) dataToUpdate.status = status;
    if (purchaseDate !== undefined) dataToUpdate.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
    if (warrantyEndDate !== undefined) dataToUpdate.warrantyEndDate = warrantyEndDate ? new Date(warrantyEndDate) : null;
    if (picUserId !== undefined) dataToUpdate.picUserId = picUserId || null;
    if (notes !== undefined) dataToUpdate.notes = notes || null;

    const asset = await prisma.asset.update({
      where: { id },
      data: dataToUpdate,
      include: {
        assetType: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
        pic: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(asset);
  } catch (error: any) {
    console.error("Failed to update asset:", error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Asset with this code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update asset" }, { status: 500 });
  }
}

// DELETE /api/assets/[id] — Soft delete: set status ke RETIRED (Admin only)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isMaintenanceAdmin(session)) {
      return NextResponse.json({ error: "Forbidden. Only admins can retire assets." }, { status: 403 });
    }

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
      include: {
        assetType: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, message: "Asset has been retired", asset: updatedAsset });
  } catch (error) {
    console.error("Failed to retire asset:", error);
    return NextResponse.json({ error: "Failed to retire asset" }, { status: 500 });
  }
}
