import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

// GET /api/maintenance-templates — List templates (Admin only)
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden. Only admins can manage templates." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const assetTypeId = searchParams.get("assetTypeId");

    const where: any = {};
    if (assetTypeId) {
      where.assetTypeId = assetTypeId;
    }

    const templates = await prisma.maintenanceTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        assetType: { select: { id: true, name: true } },
        checklistItems: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { schedules: true },
        },
      },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

// POST /api/maintenance-templates — Create template + checklist items (Admin only)
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden. Only admins can create templates." }, { status: 403 });
    }

    const body = await req.json();
    const { templateName, assetTypeId, defaultFrequencyDays, reminderOffsetDays, checklistItems } = body;

    // Validasi field wajib
    if (!templateName || !templateName.trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }
    if (!assetTypeId) {
      return NextResponse.json({ error: "Asset type is required" }, { status: 400 });
    }
    if (!defaultFrequencyDays || defaultFrequencyDays < 1) {
      return NextResponse.json({ error: "Default frequency days must be at least 1" }, { status: 400 });
    }

    // Validasi AssetType exists
    const assetTypeExists = await prisma.assetType.findUnique({ where: { id: assetTypeId } });
    if (!assetTypeExists) {
      return NextResponse.json({ error: "Asset type not found" }, { status: 400 });
    }

    // Auto-calculate reminderOffsetDays jika tidak disediakan
    let finalReminderOffset = reminderOffsetDays;
    if (!finalReminderOffset) {
      if (defaultFrequencyDays <= 14) finalReminderOffset = 1;
      else if (defaultFrequencyDays <= 60) finalReminderOffset = 3;
      else finalReminderOffset = 7;
    }

    const template = await prisma.maintenanceTemplate.create({
      data: {
        templateName: templateName.trim(),
        assetTypeId,
        defaultFrequencyDays,
        reminderOffsetDays: finalReminderOffset,
        checklistItems: checklistItems && checklistItems.length > 0
          ? {
              create: checklistItems.map((item: any, index: number) => ({
                itemText: item.itemText,
                order: item.order ?? index + 1,
                isRequired: item.isRequired ?? true,
              })),
            }
          : undefined,
      },
      include: {
        assetType: { select: { id: true, name: true } },
        checklistItems: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Failed to create template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
