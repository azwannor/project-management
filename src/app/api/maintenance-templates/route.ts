import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isMaintenanceAdmin } from "@/lib/auth";

// GET /api/maintenance-templates — List templates (Admin only)
export async function GET(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json(
      { error: "Forbidden. Only admins can manage templates." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const assetTypeId = searchParams.get("assetTypeId");

    const where: Prisma.MaintenanceTemplateWhereInput = {};
    if (assetTypeId) where.assetTypeId = assetTypeId;

    const templates = await prisma.maintenanceTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        assetType: { select: { id: true, name: true } },
        checklistItems: { orderBy: { order: "asc" } },
        _count: { select: { schedules: true } },
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
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isMaintenanceAdmin(auth.user)) {
    return NextResponse.json(
      { error: "Forbidden. Only admins can create templates." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { templateName, assetTypeId, defaultFrequencyDays, reminderOffsetDays, checklistItems } =
      body;

    if (!templateName || typeof templateName !== "string" || !templateName.trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }
    if (!assetTypeId || typeof assetTypeId !== "string") {
      return NextResponse.json({ error: "Asset type is required" }, { status: 400 });
    }

    const parsedFreq = Number(defaultFrequencyDays);
    if (!Number.isInteger(parsedFreq) || parsedFreq < 1 || parsedFreq > 730) {
      return NextResponse.json(
        { error: "defaultFrequencyDays must be an integer between 1 and 730" },
        { status: 400 }
      );
    }

    let finalReminderOffset: number;
    if (
      reminderOffsetDays !== undefined &&
      reminderOffsetDays !== null &&
      reminderOffsetDays !== ""
    ) {
      const parsedOffset = Number(reminderOffsetDays);
      if (!Number.isInteger(parsedOffset) || parsedOffset < 0 || parsedOffset > 90) {
        return NextResponse.json(
          { error: "reminderOffsetDays must be an integer between 0 and 90" },
          { status: 400 }
        );
      }
      finalReminderOffset = parsedOffset;
    } else {
      finalReminderOffset = parsedFreq <= 14 ? 1 : parsedFreq <= 60 ? 3 : 7;
    }

    const assetTypeExists = await prisma.assetType.findUnique({
      where: { id: assetTypeId.trim() },
      select: { id: true },
    });
    if (!assetTypeExists) {
      return NextResponse.json({ error: "Asset type not found" }, { status: 400 });
    }

    const cleanChecklist = Array.isArray(checklistItems)
      ? checklistItems.filter(
          (item: unknown): item is { itemText: string; order?: number; isRequired?: boolean } =>
            Boolean(item && typeof (item as { itemText?: string }).itemText === "string" && (item as { itemText: string }).itemText.trim())
        )
      : [];

    const template = await prisma.maintenanceTemplate.create({
      data: {
        templateName: templateName.trim(),
        assetTypeId: assetTypeExists.id,
        defaultFrequencyDays: parsedFreq,
        reminderOffsetDays: finalReminderOffset,
        checklistItems:
          cleanChecklist.length > 0
            ? {
                create: cleanChecklist.map((item, index) => ({
                  itemText: item.itemText.trim(),
                  order: item.order ?? index + 1,
                  isRequired: item.isRequired ?? true,
                })),
              }
            : undefined,
      },
      include: {
        assetType: { select: { id: true, name: true } },
        checklistItems: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Failed to create template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
