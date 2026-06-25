import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

// GET /api/asset-types — List semua AssetType (All authenticated users)
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assetTypes = await prisma.assetType.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            assets: true,
            templates: true,
          },
        },
      },
    });

    return NextResponse.json(assetTypes);
  } catch (error) {
    console.error("Failed to fetch asset types:", error);
    return NextResponse.json({ error: "Failed to fetch asset types" }, { status: 500 });
  }
}

// POST /api/asset-types — Create AssetType baru (Admin only)
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden. Only admins can create asset types." }, { status: 403 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const assetType = await prisma.assetType.create({
      data: { name: name.trim() },
    });

    return NextResponse.json(assetType, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create asset type:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Asset type with this name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create asset type" }, { status: 500 });
  }
}
