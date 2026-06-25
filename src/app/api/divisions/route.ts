import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const divisions = await prisma.division.findMany({
      orderBy: { name: "asc" }
    });

    return NextResponse.json(divisions);
  } catch (error: any) {
    console.error("Fetch Divisions Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data divisi" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Nama divisi wajib diisi" }, { status: 400 });
    }

    const newDivision = await prisma.division.create({
      data: { name: name.trim() }
    });

    return NextResponse.json(newDivision, { status: 201 });
  } catch (error: any) {
    console.error("Create Division Error:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Nama divisi sudah ada" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menambahkan divisi" }, { status: 500 });
  }
}
