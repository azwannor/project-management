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
    return NextResponse.json(newTask, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
