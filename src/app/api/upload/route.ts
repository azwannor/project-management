import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import path from "node:path";
import { decrypt } from "@/lib/auth";
import { ALLOWED_UPLOAD_MIME_BY_EXT, uploadFileObject } from "@/lib/storage";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const session = await decrypt(cookieStore.get("session")?.value);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const fileEntry = formData.get("file");
    const folderEntry = formData.get("folder");
    const folderRaw = typeof folderEntry === "string" ? folderEntry : "attachments";
    const folder = folderRaw.replace(/[^a-zA-Z0-9_-]/g, "") || "attachments";

    if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
      return NextResponse.json({ error: "Valid non-empty file is required" }, { status: 400 });
    }

    if (fileEntry.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });
    }

    const rawExt = path.extname(fileEntry.name).toLowerCase();
    if (!/^\.[a-z0-9]+$/.test(rawExt) || !(rawExt in ALLOWED_UPLOAD_MIME_BY_EXT)) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: PNG, JPG, WEBP, GIF, PDF, XLSX, CSV, TXT, DOCX" },
        { status: 400 }
      );
    }

    const bytes = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const canonicalContentType = ALLOWED_UPLOAD_MIME_BY_EXT[rawExt];
    const safeName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${rawExt}`;
    const objectKey = `${folder}/${safeName}`;

    const uploaded = await uploadFileObject({
      key: objectKey,
      body: buffer,
      contentType: canonicalContentType,
    });

    return NextResponse.json({
      url: uploaded.url,
      key: uploaded.key,
      backend: uploaded.backend,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
}
