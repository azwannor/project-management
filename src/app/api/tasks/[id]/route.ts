import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Build dynamic update data from all possible fields
    const updateData: Record<string, any> = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.issue !== undefined) updateData.issue = body.issue;
    if (body.solution !== undefined) updateData.solution = body.solution;
    if (body.documentation !== undefined) updateData.documentation = body.documentation || null;
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate);
    if (body.projectId !== undefined) updateData.projectId = body.projectId || null;
    if (body.executor !== undefined) updateData.executor = body.executor || null;

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedTask);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Delete subtasks first to avoid foreign key constraints
    await prisma.task.deleteMany({
      where: { parentId: id },
    });
    // Delete the task itself
    await prisma.task.delete({
      where: { id },
    });
    return NextResponse.json({ message: "Task deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
