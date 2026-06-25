import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

// PATCH /api/asset-types/[id] — Update AssetType (Admin only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden. Only admins can update asset types." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const assetType = await prisma.assetType.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(assetType);
  } catch (error: any) {
    console.error("Failed to update asset type:", error);
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Asset type not found" }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Asset type with this name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update asset type" }, { status: 500 });
  }
}

// DELETE /api/asset-types/[id] — Delete AssetType (Admin only, gagal jika masih ada Asset/Template)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden. Only admins can delete asset types." }, { status: 403 });
    }

    const { id } = await params;

    // Cek apakah masih ada Asset atau Template yang mereferensi
    const assetType = await prisma.assetType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assets: true, templates: true },
        },
      },
    });

    if (!assetType) {
      return NextResponse.json({ error: "Asset type not found" }, { status: 404 });
    }

    if (assetType._count.assets > 0) {
      return NextResponse.json(
        { error: `Tidak bisa dihapus. Masih ada ${assetType._count.assets} aset dengan tipe ini.` },
        { status: 400 }
      );
    }

    if (assetType._count.templates > 0) {
      return NextResponse.json(
        { error: `Tidak bisa dihapus. Masih ada ${assetType._count.templates} template maintenance dengan tipe ini.` },
        { status: 400 }
      );
    }

    await prisma.assetType.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Asset type deleted successfully" });
  } catch (error) {
    console.error("Failed to delete asset type:", error);
    return NextResponse.json({ error: "Failed to delete asset type" }, { status: 500 });
  }
}
