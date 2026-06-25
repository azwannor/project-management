import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

// PATCH /api/maintenance-templates/[id] — Update template + sync checklist items (Admin only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden. Only admins can update templates." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { templateName, assetTypeId, defaultFrequencyDays, reminderOffsetDays, checklistItems } = body;

    // Cek template exists
    const existingTemplate = await prisma.maintenanceTemplate.findUnique({
      where: { id },
      include: { checklistItems: true },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Build update data untuk template
    const templateUpdateData: any = {};
    if (templateName !== undefined) templateUpdateData.templateName = templateName.trim();
    if (assetTypeId !== undefined) templateUpdateData.assetTypeId = assetTypeId;
    if (defaultFrequencyDays !== undefined) templateUpdateData.defaultFrequencyDays = defaultFrequencyDays;
    if (reminderOffsetDays !== undefined) templateUpdateData.reminderOffsetDays = reminderOffsetDays;

    // Sync checklist items jika disediakan
    // Strategy: items dengan id → update, items tanpa id → create, items yang hilang → delete
    if (checklistItems !== undefined) {
      const incomingIds = checklistItems
        .filter((item: any) => item.id)
        .map((item: any) => item.id);

      const existingIds = existingTemplate.checklistItems.map(item => item.id);

      // IDs yang perlu dihapus (ada di existing tapi tidak ada di incoming)
      const toDeleteIds = existingIds.filter(existingId => !incomingIds.includes(existingId));

      // Jalankan dalam transaction
      await prisma.$transaction(async (tx) => {
        // 1. Update template fields
        if (Object.keys(templateUpdateData).length > 0) {
          await tx.maintenanceTemplate.update({
            where: { id },
            data: templateUpdateData,
          });
        }

        // 2. Delete removed items
        if (toDeleteIds.length > 0) {
          await tx.checklistItemMaster.deleteMany({
            where: { id: { in: toDeleteIds } },
          });
        }

        // 3. Upsert items (update existing + create new)
        for (const item of checklistItems) {
          if (item.id) {
            // Update existing item
            await tx.checklistItemMaster.update({
              where: { id: item.id },
              data: {
                itemText: item.itemText,
                order: item.order,
                isRequired: item.isRequired ?? true,
              },
            });
          } else {
            // Create new item
            await tx.checklistItemMaster.create({
              data: {
                templateId: id,
                itemText: item.itemText,
                order: item.order,
                isRequired: item.isRequired ?? true,
              },
            });
          }
        }
      });
    } else if (Object.keys(templateUpdateData).length > 0) {
      // Hanya update template fields (tanpa sync checklist)
      await prisma.maintenanceTemplate.update({
        where: { id },
        data: templateUpdateData,
      });
    }

    // Fetch updated template
    const updatedTemplate = await prisma.maintenanceTemplate.findUnique({
      where: { id },
      include: {
        assetType: { select: { id: true, name: true } },
        checklistItems: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error("Failed to update template:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

// DELETE /api/maintenance-templates/[id] — Delete template + cascade checklist items (Admin only)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden. Only admins can delete templates." }, { status: 403 });
    }

    const { id } = await params;

    // Cek apakah masih ada schedule yang mereferensi
    const template = await prisma.maintenanceTemplate.findUnique({
      where: { id },
      include: {
        _count: { select: { schedules: true } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (template._count.schedules > 0) {
      return NextResponse.json(
        { error: `Tidak bisa dihapus. Masih ada ${template._count.schedules} jadwal maintenance yang menggunakan template ini.` },
        { status: 400 }
      );
    }

    // Delete template (ChecklistItemMaster akan cascade delete karena onDelete: Cascade di schema)
    await prisma.maintenanceTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
