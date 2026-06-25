import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/auth";
import { cookies } from "next/headers";

// POST /api/maintenance-templates/[id]/duplicate — Duplikasi template (Admin only)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "Admin") {
      return NextResponse.json({ error: "Forbidden. Only admins can duplicate templates." }, { status: 403 });
    }

    const { id } = await params;

    // Ambil template sumber beserta checklist items
    const sourceTemplate = await prisma.maintenanceTemplate.findUnique({
      where: { id },
      include: {
        checklistItems: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!sourceTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Cek apakah ada custom name dari request body (opsional)
    let newName = `${sourceTemplate.templateName} (Copy)`;
    try {
      const body = await req.json();
      if (body.templateName && body.templateName.trim()) {
        newName = body.templateName.trim();
      }
    } catch {
      // Body kosong, gunakan nama default
    }

    // Buat template baru + copy semua checklist items
    const duplicatedTemplate = await prisma.maintenanceTemplate.create({
      data: {
        templateName: newName,
        assetTypeId: sourceTemplate.assetTypeId,
        defaultFrequencyDays: sourceTemplate.defaultFrequencyDays,
        reminderOffsetDays: sourceTemplate.reminderOffsetDays,
        checklistItems: {
          create: sourceTemplate.checklistItems.map(item => ({
            itemText: item.itemText,
            order: item.order,
            isRequired: item.isRequired,
          })),
        },
      },
      include: {
        assetType: { select: { id: true, name: true } },
        checklistItems: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json(duplicatedTemplate, { status: 201 });
  } catch (error) {
    console.error("Failed to duplicate template:", error);
    return NextResponse.json({ error: "Failed to duplicate template" }, { status: 500 });
  }
}
