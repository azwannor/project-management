import { NextResponse } from "next/server";
import { TicketSource } from "@prisma/client";
import prisma from "@/lib/prisma";
import { hashApiKey } from "@/lib/settings-helpers";
import { computeSlaDueAt, formatNextTicketNumber, resolveSlaPolicy } from "@/lib/support-helpers";

const VALID_PRIORITIES = new Set(["Urgent", "High", "Normal", "Low"]);

export async function POST(req: Request) {
  try {
    const headerKey =
      req.headers.get("x-api-key") ||
      (req.headers.get("authorization")?.startsWith("Bearer ")
        ? req.headers.get("authorization")!.slice(7)
        : "");

    if (!headerKey || !headerKey.trim()) {
      return NextResponse.json({ error: "Missing X-API-Key header" }, { status: 401 });
    }

    const keyHash = hashApiKey(headerKey);
    const apiKeyRecord = await prisma.externalApiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
    }

    const body = await req.json();
    const taskName = typeof body.taskName === "string"
      ? body.taskName.trim()
      : typeof body.title === "string"
        ? body.title.trim()
        : "";
    if (!taskName) {
      return NextResponse.json({ error: "taskName (or title) is required" }, { status: 400 });
    }

    const priorityRaw = typeof body.priority === "string" ? body.priority.trim() : "Normal";
    const priority = VALID_PRIORITIES.has(priorityRaw) ? priorityRaw : "Normal";
    const supportType =
      typeof body.supportType === "string" && body.supportType.trim()
        ? body.supportType.trim()
        : "Report Problem";
    const ticketModule =
      typeof body.module === "string" && body.module.trim()
        ? body.module.trim()
        : apiKeyRecord.sourceApp;
    const area = typeof body.area === "string" && body.area.trim() ? body.area.trim() : null;
    const issue = typeof body.issue === "string" && body.issue.trim()
      ? body.issue.trim()
      : typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    const systemUser =
      (await prisma.user.findFirst({
        where: { isActive: true, role: { equals: "Admin", mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })) ||
      (await prisma.user.findFirst({
        where: { isActive: true },
        select: { id: true },
      }));

    if (!systemUser) {
      return NextResponse.json({ error: "No active system user available" }, { status: 500 });
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const yearPrefix = `SUP-${currentYear}-`;

    const [latestTicket, slaPolicies, areaExecutors] = await Promise.all([
      prisma.supportTicket.findFirst({
        where: { ticketNumber: { startsWith: yearPrefix } },
        orderBy: { ticketNumber: "desc" },
        select: { ticketNumber: true },
      }),
      prisma.slaPolicy.findMany({
        select: {
          priority: true,
          firstResponseMinutes: true,
          targetMinutes: true,
          reminderThresholdPercent: true,
        },
      }),
      area
        ? prisma.user.findMany({
            where: { isActive: true, handledAreas: { has: area } },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);

    const ticketNumber = formatNextTicketNumber(latestTicket?.ticketNumber, currentYear);
    const matchedPolicy = resolveSlaPolicy(priority, slaPolicies);
    const slaTargetMinutes = matchedPolicy?.targetMinutes ?? null;
    const slaDueAt = computeSlaDueAt(now, slaTargetMinutes);

    const rawSourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    let safeSourceUrl: string | null = null;
    if (rawSourceUrl) {
      try {
        const parsed = new URL(rawSourceUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return NextResponse.json({ error: "sourceUrl must use http or https protocol" }, { status: 400 });
        }
        safeSourceUrl = parsed.toString();
      } catch {
        return NextResponse.json({ error: "Invalid sourceUrl" }, { status: 400 });
      }
    }

    const [ticket] = await prisma.$transaction([
      prisma.supportTicket.create({
        data: {
          ticketNumber,
          userId: systemUser.id,
          taskName,
          supportType,
          module: ticketModule,
          area,
          startDate: now,
          slaTargetMinutes,
          slaDueAt,
          issue,
          status: "Not Started",
          priority,
          ticketType: "REQUEST",
          requesterName: typeof body.requesterName === "string" ? body.requesterName.trim() || null : null,
          requesterEmail: typeof body.requesterEmail === "string" ? body.requesterEmail.trim() || null : null,
          sourceType: TicketSource.EXTERNAL_APP,
          sourceApp: apiKeyRecord.sourceApp,
          sourceMenu: typeof body.sourceMenu === "string" ? body.sourceMenu.trim() || null : null,
          sourceUrl: safeSourceUrl,
          sourceMetadata: body.sourceMetadata && typeof body.sourceMetadata === "object" ? body.sourceMetadata : undefined,
          executors: areaExecutors.length
            ? { connect: areaExecutors.map((u) => ({ id: u.id })) }
            : undefined,
        },
        select: {
          id: true,
          ticketNumber: true,
          taskName: true,
          priority: true,
          status: true,
          slaDueAt: true,
          sourceApp: true,
          createdAt: true,
        },
      }),
      prisma.externalApiKey.update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: now },
      }),
    ]);

    return NextResponse.json({ success: true, ticket }, { status: 201 });
  } catch (error) {
    console.error("External ticket ingestion error:", error);
    return NextResponse.json({ error: "Failed to ingest external ticket" }, { status: 500 });
  }
}
