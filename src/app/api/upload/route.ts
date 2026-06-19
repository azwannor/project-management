import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Convert file to Base64 to support serverless deployment on Vercel
    const mimeType = file.type || 'application/octet-stream';
    const base64Data = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    return NextResponse.json({ url: dataUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }
}
