import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decrypt } from "@/lib/auth";
import { readFileObject } from "@/lib/storage";

export async function GET(
  _req: Request,
  context: { params: Promise<{ key: string[] }> }
) {
  try {
    const cookieStore = await cookies();
    const session = await decrypt(cookieStore.get("session")?.value);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key } = await context.params;
    const objectKey = Array.isArray(key) ? key.join("/") : "";
    const file = await readFileObject(objectKey);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const disposition = file.inline
      ? `inline; filename="${file.filename}"`
      : `attachment; filename="${file.filename}"`;

    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": disposition,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("File proxy error:", error);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
