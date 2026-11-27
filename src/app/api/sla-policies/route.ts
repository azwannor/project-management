import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { isAdminUser, logSettingsAudit, validateSlaPolicyInput } from "@/lib/settings-helpers";

const PRIORITY_ORDER = ["Urgent", "High", "Normal", "Low"];

export async function GET() {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const policies = await prisma.slaPolicy.findMany();
  policies.sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
  return NextResponse.json(policies);
}

export async function PATCH(req: Request) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";
    const priority = typeof body.priority === "string" ? body.priority : "";

    if (!id && !priority) {
      return NextResponse.json({ error: "Policy id or priority is required" }, { status: 400 });
    }

    const validation = validateSlaPolicyInput({
      firstResponseMinutes: body.firstResponseMinutes,
      targetMinutes: body.targetMinutes,
      reminderThresholdPercent: body.reminderThresholdPercent,
    });

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const existing = await prisma.slaPolicy.findUnique({
      where: id ? { id } : { priority },
    });
    if (!existing) {
      return NextResponse.json({ error: "SLA Policy not found" }, { status: 404 });
    }

    const updated = await prisma.slaPolicy.update({
      where: { id: existing.id },
      data: {
        firstResponseMinutes: validation.firstResponseMinutes!,
        targetMinutes: validation.targetMinutes!,
        reminderThresholdPercent: validation.reminderThresholdPercent!,
      },
    });

    await logSettingsAudit({
      actorId: auth.user.id,
      entityType: "SlaPolicy",
      entityId: updated.id,
      action: "UPDATE",
      diffJson: {
        priority: updated.priority,
        firstResponseMinutes: updated.firstResponseMinutes,
        targetMinutes: updated.targetMinutes,
        reminderThresholdPercent: updated.reminderThresholdPercent,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update SlaPolicy Error:", error);
    return NextResponse.json({ error: "Failed to update SLA policy" }, { status: 500 });
  }
}
