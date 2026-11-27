import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireActiveSession } from "@/lib/api-auth";
import { normalizeSupportPriority, stripRichHtml } from "@/lib/support-helpers";

/**
 * Promote a SupportTicket into a tracked Project Task (`Task.sourceTicketId`) inside a chosen Project.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveSession();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: ticketId } = await params;
    const body = await req.json().catch(() => ({}));

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        executors: { select: { id: true, name: true } },
      },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Support ticket not found" }, { status: 404 });
    }

    const projectId =
      typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const now = new Date();
    const startDate = body.startDate ? new Date(body.startDate) : now;
    const endDate = body.endDate
      ? new Date(body.endDate)
      : new Date(startDate.getTime() + 5 * 86_400_000);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
    }

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : ticket.ticketNumber
          ? `[${ticket.ticketNumber}] ${ticket.taskName}`
          : ticket.taskName;

    const executorUsers = ticket.executors.length > 0 ? ticket.executors : [{ id: auth.user.id, name: auth.user.name }];
    const executorText = executorUsers.map((u) => u.name).join(", ");
    const cleanIssue = stripRichHtml(ticket.issue);
    const cleanSolution = stripRichHtml(ticket.solution);

    const createdTask = await prisma.task.create({
      data: {
        projectId,
        userId: auth.user.id,
        sourceTicketId: ticket.id,
        title,
        startDate,
        endDate,
        priority: normalizeSupportPriority(ticket.priority),
        status: ticket.status === "Done" ? "Completed" : "Not Started",
        actualEndDate: ticket.status === "Done" ? ticket.endDate || now : null,
        issue: cleanIssue || null,
        solution: cleanSolution || null,
        attachment: ticket.attachment,
        attachmentKey: ticket.attachmentKey,
        executor: executorText,
        executors: {
          create: executorUsers.map((u) => ({ userId: u.id })),
        },
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    await prisma.notification.createMany({
      data: executorUsers.map((u) => ({
        userId: u.id,
        title: `Promoted from ${ticket.ticketNumber || "Support"}`,
        message: `Task "${createdTask.title}" added to ${project.name}.`,
        type: "ASSIGNMENT",
        link: `/projects?projectId=${project.id}`,
      })),
    });

    return NextResponse.json(createdTask, { status: 201 });
  } catch (error) {
    console.error("Failed to promote support ticket:", error);
    return NextResponse.json({ error: "Failed to promote ticket to project task" }, { status: 500 });
  }
}
