import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if there are assets using this division
    const assetsUsing = await prisma.asset.count({
      where: { divisionId: id }
    });

    if (assetsUsing > 0) {
      return NextResponse.json(
        { error: "Tidak dapat menghapus divisi yang masih digunakan oleh aset" },
        { status: 400 }
      );
    }

    await prisma.division.delete({
      where: { id: id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete Division Error:", error);
    return NextResponse.json({ error: "Gagal menghapus divisi" }, { status: 500 });
  }
}
