import { isMaintenanceAdmin } from "@/lib/auth";
import { requireActiveSession } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import path from "node:path";
import * as xlsx from "xlsx";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMPORT_EXTS = new Set([".xlsx", ".xls", ".csv"]);

export async function POST(req: Request) {
  try {
    const auth = await requireActiveSession();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isMaintenanceAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden. Admin only." }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Excel file not found" }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: "Excel file exceeds 10MB limit" }, { status: 400 });
    }
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_IMPORT_EXTS.has(ext)) {
      return NextResponse.json({ error: "Unsupported file format. Use .xlsx, .xls, or .csv" }, { status: 400 });
    }

    // Baca file stream menjadi buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parsing Excel menggunakan xlsx
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0]; // Ambil sheet pertama
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert ke JSON
    const data = xlsx.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "File kosong atau format salah" }, { status: 400 });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: { row: number; assetCode: string; reason: string }[] = [];

    // Master Cache
    const validAreas = [
      "Lobby", "Reception", "Meeting Room 1", "Meeting Room 2", "CEO Office", 
      "Open Workspace", "Pantry", "Server Room", "Storage", "Finance Dept", 
      "HR Dept", "IT Dept", "Marketing Dept", "Sales Dept", "Warehouse", 
      "Production Floor", "QC Room", "Packaging Area", "Loading Dock", 
      "Cafeteria", "Security Post", "Basement Parking", "Rooftop", 
      "Data Center", "Network Closet", "Electrical Room", "Maintenance Room",
      "Ruang Server"
    ]; // Diambil dari constant UI

    const assetTypesCache: Record<string, string> = {}; // nama -> id

    // Load semua tipe aset agar tidak query 1 per 1 jika sudah ada
    const existingTypes = await prisma.assetType.findMany();
    existingTypes.forEach(t => {
      assetTypesCache[t.name.toUpperCase()] = t.id;
    });

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +1 untuk header, +1 karena array 0-indexed
      
      const assetCode = row["Asset Code"]?.toString().trim();
      const assetName = row["Asset Name"]?.toString().trim();
      const assetTypeName = row["Asset Type"]?.toString().trim();
      const area = row["Area"]?.toString().trim();
      const serialNumber = row["Serial Number"]?.toString().trim() || "";
      
      let purchaseDate = null;
      if (row["Purchase Date"]) {
        // Excel menyimpan tanggal sebagai number kadang-kadang, kita coba parse
        const pd = new Date(String(row["Purchase Date"]));
        if (!isNaN(pd.getTime())) purchaseDate = pd;
      }

      // 1. Validasi Data Mandatory
      if (!assetCode || !assetName || !assetTypeName || !area) {
        failedCount++;
        errors.push({ row: rowNum, assetCode: assetCode || "N/A", reason: "Required Columns (Code, Name, Type, Area) are empty" });
        continue;
      }

      // 2. Validasi Area
      const matchedArea = validAreas.find(a => a.toLowerCase() === area.toLowerCase());
      if (!matchedArea) {
        failedCount++;
        errors.push({ row: rowNum, assetCode, reason: `Area '${area}' is invalid` });
        continue;
      }

      try {
        // Cek duplikasi di DB
        const existingAsset = await prisma.asset.findUnique({ where: { assetCode } });
        if (existingAsset) {
          failedCount++;
          errors.push({ row: rowNum, assetCode, reason: "Asset Code sudah terdaftar" });
          continue;
        }

        // Resolusi Asset Type (Create jika tidak ada)
        let assetTypeId = assetTypesCache[assetTypeName.toUpperCase()];
        if (!assetTypeId) {
          const newType = await prisma.assetType.create({
            data: { name: assetTypeName }
          });
          assetTypeId = newType.id;
          assetTypesCache[assetTypeName.toUpperCase()] = newType.id;
        }

        // Insert Asset
        await prisma.asset.create({
          data: {
            assetCode,
            assetName,
            assetTypeId,
            location: matchedArea,
            serialNumber,
            purchaseDate,
            status: "ACTIVE"
          }
        });

        successCount++;
      } catch (err: unknown) {
        failedCount++;
        errors.push({ row: rowNum, assetCode, reason: err instanceof Error ? err.message : "Database Error" });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Import selesai",
      total: data.length,
      successCount,
      failedCount,
      errors
    });

  } catch (error: unknown) {
    console.error("Bulk import failed:", error);
    return NextResponse.json({ error: "Failed to process import" }, { status: 500 });
  }
}
