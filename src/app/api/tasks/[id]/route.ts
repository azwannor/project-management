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
    if (body.actualEndDate !== undefined) updateData.actualEndDate = body.actualEndDate ? new Date(body.actualEndDate) : null;
    if (body.projectId !== undefined) updateData.projectId = body.projectId || null;
    if (body.executor !== undefined) updateData.executor = body.executor || null;
    if (body.parentId !== undefined) updateData.parentId = body.parentId;

    const existingTask = await prisma.task.findUnique({ where: { id } });

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { project: true }
    });

    if (existingTask && existingTask.status !== updatedTask.status) {
      if (updatedTask.parentId) {
        // Subtask logic
        if (updatedTask.status === "Completed" || updatedTask.status === "Done") {
          const siblingTasks = await prisma.task.findMany({
            where: { parentId: updatedTask.parentId }
          });
          const allCompleted = siblingTasks.every((t: any) => t.status === "Completed" || t.status === "Done");
          
          if (allCompleted) {
            const parentTask = await prisma.task.update({
              where: { id: updatedTask.parentId },
              data: { status: "Completed" },
              include: { project: true }
            });
            
            const { sendTelegramMessage } = await import("@/lib/telegram");
            const projectName = parentTask.project ? parentTask.project.name : "-";
            let message = `✅ <b>MAIN TASK SELESAI (AUTO-COMPLETED)</b> ✅\n\n`;
            message += `<b>Tugas Utama:</b> ${parentTask.title}\n`;
            message += `<b>Project:</b> ${projectName}\n`;
            message += `<b>Executor:</b> ${parentTask.executor || "-"}\n`;
            message += `<i>Semua sub-task telah selesai sehingga tugas utama ini otomatis diselesaikan.</i>\n`;
            await sendTelegramMessage(message);
          }
        } else {
          // Subtask is not completed, revert parent if it was completed
          const parentTask = await prisma.task.findUnique({
            where: { id: updatedTask.parentId }
          });
          if (parentTask && (parentTask.status === "Completed" || parentTask.status === "Done")) {
            await prisma.task.update({
              where: { id: parentTask.id },
              data: { status: "Ongoing" }
            });
          }
        }
      } else {
        // Main task logic
        if (updatedTask.status === "Completed" || updatedTask.status === "Done") {
           const { sendTelegramMessage } = await import("@/lib/telegram");
           const projectName = updatedTask.project ? updatedTask.project.name : "-";
           let message = `🎉 <b>MAIN TASK SELESAI</b> 🎉\n\n`;
           message += `<b>Tugas Utama:</b> ${updatedTask.title}\n`;
           message += `<b>Project:</b> ${projectName}\n`;
           message += `<b>Executor:</b> ${updatedTask.executor || "-"}\n`;
           message += `<i>Tugas utama ini telah berhasil diselesaikan!</i>\n`;
           
           await sendTelegramMessage(message);
        }
      }
    }

    if (body.executor !== undefined && existingTask && existingTask.executor !== body.executor) {
      if (body.executor) {
        const executors = body.executor.split(",").map((e: string) => e.trim()).filter(Boolean);
        const existingExecutors = existingTask.executor ? existingTask.executor.split(",").map((e: string) => e.trim()) : [];
        
        for (const executorName of executors) {
          if (!existingExecutors.includes(executorName)) {
            const executorUser = await prisma.user.findFirst({
              where: { name: executorName }
            });
            if (executorUser) {
              await prisma.notification.create({
                data: {
                  userId: executorUser.id,
                  title: "Tugas Dialokasikan",
                  message: `Anda ditugaskan pada task: "${updatedTask.title}"`,
                  type: "ASSIGNMENT",
                  link: "/"
                }
              });
            }
          }
        }
      }
    }

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
