import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description || null,
        objective: data.objective || null,
        members: data.members || null,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000), // Default +30 days
        status: data.status || "Not Started"
      }
    });

    return NextResponse.json(project);
  } catch (error: any) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
