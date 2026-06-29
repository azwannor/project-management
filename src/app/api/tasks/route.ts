import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        project: true,
        user: true,
      },
    });
    return NextResponse.json(tasks);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Find a default user for MVP purposes if userId is not provided
    let userId = body.userId;
    if (!userId) {
      let user = await prisma.user.findFirst();
      if (!user) {
        user = await prisma.user.create({
          data: { 
            name: "System User", 
            jobDesk: "Administrator", 
            role: "Admin",
            email: "admin@it-tracker.com",
            password: "hashed_password" // ini hanya fallback
          }
        });
      }
      userId = user.id;
    }

    const newTask = await prisma.task.create({
      data: {
        title: body.title,
        parentId: body.parentId || null,
        projectId: body.projectId || null,
        userId: userId,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: body.endDate ? new Date(body.endDate) : new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
        priority: body.priority || "Normal",
        status: body.status || "Not Started",
        documentation: body.documentation || null,
        executor: body.executor || null,
      },
    });

    if (newTask.parentId) {
      // Revert parent task if it was completed
      const parentTask = await prisma.task.findUnique({
        where: { id: newTask.parentId }
      });
      if (parentTask && (parentTask.status === "Completed" || parentTask.status === "Done")) {
        await prisma.task.update({
          where: { id: parentTask.id },
          data: { status: "Ongoing" }
        });
      }
    }

    if (body.executor) {
      const executors = body.executor.split(",").map((e: string) => e.trim()).filter(Boolean);
      for (const executorName of executors) {
        const executorUser = await prisma.user.findFirst({
          where: { name: executorName }
        });
        if (executorUser) {
          await prisma.notification.create({
            data: {
              userId: executorUser.id,
              title: "Tugas Baru",
              message: `Anda telah ditugaskan pada task baru: "${newTask.title}"`,
              type: "ASSIGNMENT",
              link: "/"
            }
          });
        }
      }
    }

    let projectName = "-";
    if (body.projectId) {
      const project = await prisma.project.findUnique({ where: { id: body.projectId } });
      if (project) projectName = project.name;
    }

    const { sendTelegramMessage, formatHtmlForTelegram } = await import("@/lib/telegram");
    const cleanDoc = formatHtmlForTelegram(body.documentation);
    
    let message = `🎯 <b>PROJECT TASK BARU</b> 🎯\n\n`;
    message += `<b>Judul Tugas:</b> ${newTask.title}\n`;
    message += `<b>Project:</b> ${projectName}\n`;
    message += `<b>Tugas Untuk:</b> ${body.executor || "Not assigned"}\n`;
    message += `<b>Prioritas:</b> ${newTask.priority}\n`;
    if (cleanDoc && cleanDoc !== "-") {
      message += `<b>Deskripsi:</b>\n${cleanDoc}\n\n`;
    }
    message += `<i>Silakan cek detailnya di aplikasi IT Tracker.</i>`;
    
    await sendTelegramMessage(message);

    return NextResponse.json(newTask, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
