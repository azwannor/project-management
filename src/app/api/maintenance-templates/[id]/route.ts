import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isMaintenanceAdmin } from "@/lib/auth";

// PATCH /api/maintenance-templates/[id] — Update template + sync checklist items (Admin only)
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
      { error: "Forbidden. Only admins can update templates." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { templateName, assetTypeId, defaultFrequencyDays, reminderOffsetDays, checklistItems } =
      body;

    const existingTemplate = await prisma.maintenanceTemplate.findUnique({
      where: { id },
      include: { checklistItems: true },
    });
    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const templateUpdateData: Prisma.MaintenanceTemplateUncheckedUpdateInput = {};
    if (templateName !== undefined) {
      const name = typeof templateName === "string" ? templateName.trim() : "";
      if (!name) return NextResponse.json({ error: "Template name cannot be empty" }, { status: 400 });
      templateUpdateData.templateName = name;
    }
    if (assetTypeId !== undefined) {
      const at = await prisma.assetType.findUnique({
        where: { id: String(assetTypeId) },
        select: { id: true },
      });
      if (!at) return NextResponse.json({ error: "Asset type not found" }, { status: 400 });
      templateUpdateData.assetTypeId = at.id;
    }
    if (defaultFrequencyDays !== undefined) {
      const parsedFreq = Number(defaultFrequencyDays);
      if (!Number.isInteger(parsedFreq) || parsedFreq < 1 || parsedFreq > 730) {
        return NextResponse.json(
          { error: "defaultFrequencyDays must be an integer between 1 and 730" },
          { status: 400 }
        );
      }
      templateUpdateData.defaultFrequencyDays = parsedFreq;
    }
    if (reminderOffsetDays !== undefined) {
      const parsedOffset = Number(reminderOffsetDays);
      if (!Number.isInteger(parsedOffset) || parsedOffset < 0 || parsedOffset > 90) {
        return NextResponse.json(
          { error: "reminderOffsetDays must be an integer between 0 and 90" },
          { status: 400 }
        );
      }
      templateUpdateData.reminderOffsetDays = parsedOffset;
    }

    if (checklistItems !== undefined) {
      if (!Array.isArray(checklistItems)) {
        return NextResponse.json({ error: "checklistItems must be an array" }, { status: 400 });
      }
      const existingIdSet = new Set(existingTemplate.checklistItems.map((i) => i.id));
      for (const item of checklistItems) {
        if (item?.id && !existingIdSet.has(String(item.id))) {
          return NextResponse.json(
            { error: `Checklist item '${item.id}' does not belong to this template` },
            { status: 400 }
          );
        }
        if (!item?.itemText || typeof item.itemText !== "string" || !item.itemText.trim()) {
          return NextResponse.json(
            { error: "All checklist items must have non-empty itemText" },
            { status: 400 }
          );
        }
      }

      const incomingIds = checklistItems
        .filter((item: { id?: string }) => Boolean(item.id))
        .map((item: { id: string }) => String(item.id));
      const toDeleteIds = existingTemplate.checklistItems
        .map((i) => i.id)
        .filter((eid) => !incomingIds.includes(eid));

      await prisma.$transaction(async (tx) => {
        if (Object.keys(templateUpdateData).length > 0) {
          await tx.maintenanceTemplate.update({ where: { id }, data: templateUpdateData });
        }
        if (toDeleteIds.length > 0) {
          await tx.checklistItemMaster.deleteMany({ where: { id: { in: toDeleteIds } } });
        }
        for (let idx = 0; idx < checklistItems.length; idx++) {
          const item = checklistItems[idx];
          if (item.id) {
            await tx.checklistItemMaster.update({
              where: { id: String(item.id) },
              data: {
                itemText: item.itemText.trim(),
                order: item.order ?? idx + 1,
                isRequired: item.isRequired ?? true,
              },
            });
          } else {
            await tx.checklistItemMaster.create({
              data: {
                templateId: id,
                itemText: item.itemText.trim(),
                order: item.order ?? idx + 1,
                isRequired: item.isRequired ?? true,
              },
            });
          }
        }
      });
    } else if (Object.keys(templateUpdateData).length > 0) {
      await prisma.maintenanceTemplate.update({ where: { id }, data: templateUpdateData });
    }

    const updatedTemplate = await prisma.maintenanceTemplate.findUnique({
      where: { id },
      include: {
        assetType: { select: { id: true, name: true } },
        checklistItems: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error("Failed to update template:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

// DELETE /api/maintenance-templates/[id] — Delete template when unused (Admin only)
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
      { error: "Forbidden. Only admins can delete templates." },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const template = await prisma.maintenanceTemplate.findUnique({
      where: { id },
      include: { _count: { select: { schedules: true } } },
    });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    if (template._count.schedules > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete. There are still ${template._count.schedules} maintenance schedules using this template.`,
        },
        { status: 400 }
      );
    }

    await prisma.maintenanceTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
