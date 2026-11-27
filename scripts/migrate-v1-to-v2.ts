import { PrismaClient, TicketSource } from "@prisma/client";
import { uploadFileObject } from "../src/lib/storage";

const prisma = new PrismaClient();

const DEFAULT_LOCATIONS = [
  { name: "HO Jakarta", code: "JKT", address: "Head Office Jakarta" },
  { name: "HO Makassar", code: "MKS", address: "Head Office Makassar" },
  { name: "Pabrik", code: "PBR", address: "Plant / Manufacturing" },
  { name: "Marketing", code: "MKT", address: "Marketing & Regional Field" },
];

const DEFAULT_REGIONAL_AREAS = [
  "JATENG 1", "JATENG 2", "JATENG 3", "KALBAR", "KALTIM", "KALSELTENG", "DENPASAR",
  "JAKARTA 1", "JAKARTA 2", "JAKARTA 3", "JAKARTA 4", "JAKARTA 5", "JAKARTA 6", "JAKARTA 7",
  "KAM PROJECT", "MEDAN & ACEH RAYA", "TANGERANG", "SURABAYA 1", "SURABAYA 2", "MALANG",
  "SULAWESI 1", "SULAWESI 2", "SULAWESI 3", "JAWA BARAT 1", "JAWA BARAT 2", "SUMBANGSEL 1", "SUMBANGSEL 2",
];

const DEFAULT_SLA_POLICIES = [
  { priority: "Urgent", firstResponseMinutes: 15, targetMinutes: 120, reminderThresholdPercent: 75 },
  { priority: "High", firstResponseMinutes: 30, targetMinutes: 240, reminderThresholdPercent: 75 },
  { priority: "Normal", firstResponseMinutes: 120, targetMinutes: 1440, reminderThresholdPercent: 75 },
  { priority: "Low", firstResponseMinutes: 240, targetMinutes: 2880, reminderThresholdPercent: 75 },
];

const MODULE_GROUPS: { groupName: string; name: string; categories: string[] }[] = [
  {
    groupName: "Enterprise Systems & Applications",
    name: "Sistem AI",
    categories: ["User Admin", "Master Data", "Proses Sales", "Bug Fixing & Error Handling", "New Feature / Development", "User Training & Guidance", "Maintenance & Server Check"],
  },
  {
    groupName: "Enterprise Systems & Applications",
    name: "Sistem PIC",
    categories: ["User Admin", "Master Data", "Bug Fixing & Error Handling", "New Feature / Development", "User Training & Guidance", "Maintenance & Server Check"],
  },
  {
    groupName: "Enterprise Systems & Applications",
    name: "Sistem HRIS",
    categories: ["User Admin", "Master Data", "Bug Fixing & Error Handling", "New Feature / Development", "User Training & Guidance", "Maintenance & Server Check"],
  },
  {
    groupName: "Enterprise Systems & Applications",
    name: "Factory Sistem",
    categories: ["User Admin", "Master Data", "Bug Fixing & Error Handling", "New Feature / Development", "User Training & Guidance", "Maintenance & Server Check"],
  },
  {
    groupName: "Enterprise Systems & Applications",
    name: "Website / Portal",
    categories: ["User Admin", "Master Data", "Bug Fixing & Error Handling", "New Feature / Development", "User Training & Guidance", "Maintenance & Server Check"],
  },
  {
    groupName: "Infrastructure & Network",
    name: "Jaringan (Wi-Fi/LAN/Mikrotik)",
    categories: ["Network Troubleshooting", "Instalasi & Relokasi Baru", "Maintenance & Monitoring", "Konfigurasi & Setting"],
  },
  {
    groupName: "Infrastructure & Network",
    name: "Server & Data Center",
    categories: ["Network Troubleshooting", "Instalasi & Relokasi Baru", "Maintenance & Monitoring", "Konfigurasi & Setting"],
  },
  {
    groupName: "Infrastructure & Network",
    name: "CCTV & Security System",
    categories: ["Network Troubleshooting", "Instalasi & Relokasi Baru", "Maintenance & Monitoring", "Konfigurasi & Setting"],
  },
  {
    groupName: "Infrastructure & Network",
    name: "Telepon & PABX",
    categories: ["Network Troubleshooting", "Instalasi & Relokasi Baru", "Maintenance & Monitoring", "Konfigurasi & Setting"],
  },
  {
    groupName: "Hardware & End-User Devices",
    name: "PC / Laptop",
    categories: ["Hardware Troubleshooting", "Instalasi & Setup Baru", "Maintenance & Consumable", "Penggantian Sparepart"],
  },
  {
    groupName: "Hardware & End-User Devices",
    name: "Printer / Scanner",
    categories: ["Hardware Troubleshooting", "Instalasi & Setup Baru", "Maintenance & Consumable", "Penggantian Sparepart"],
  },
  {
    groupName: "Hardware & End-User Devices",
    name: "Perangkat Lain (UPS, Monitor, dll)",
    categories: ["Hardware Troubleshooting", "Instalasi & Setup Baru", "Maintenance & Consumable", "Penggantian Sparepart"],
  },
  {
    groupName: "Data, Account & IT Management",
    name: "Email & Cloud (Google Workspace/AD)",
    categories: ["User Admin", "Data Extraction & Query", "Pengadaan & Pembelian (Procurement)", "Peminjaman & Pengembalian Aset"],
  },
  {
    groupName: "Data, Account & IT Management",
    name: "Permintaan Data / Report",
    categories: ["User Admin", "Data Extraction & Query", "Pengadaan & Pembelian (Procurement)", "Peminjaman & Pengembalian Aset"],
  },
  {
    groupName: "Data, Account & IT Management",
    name: "IT Asset Management",
    categories: ["User Admin", "Data Extraction & Query", "Pengadaan & Pembelian (Procurement)", "Peminjaman & Pengembalian Aset"],
  },
  {
    groupName: "General",
    name: "General IT / Lainnya...",
    categories: ["Rapat & Diskusi Internal", "Koordinasi Vendor", "Lainnya..."],
  },
];

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};

function parseNameList(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function getSlaMinutesForPriority(priority?: string | null): number {
  const p = (priority || "Normal").toLowerCase();
  if (p === "urgent" || p === "butuh cepat") return 120;
  if (p === "high") return 240;
  if (p === "low") return 2880;
  return 1440;
}

async function extractBase64Attachment(
  rawDataUrl: string | null | undefined,
  folder: string,
  entityId: string
): Promise<string | null> {
  if (!rawDataUrl || !rawDataUrl.startsWith("data:")) return null;
  const match = rawDataUrl.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const ext = MIME_TO_EXT[mime];
  if (!ext) return null;

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0) return null;

  const res = await uploadFileObject({
    key: `${folder}/${entityId}${ext}`,
    body: buffer,
    contentType: mime,
  });
  return res.key;
}

async function main() {
  console.log("Starting idempotent v1 -> v2 migration...");

  // 1. Seed Master Data: Locations, Regional Areas, SLA Policies, Support Modules & Categories
  const locationMap = new Map<string, string>();
  for (const loc of DEFAULT_LOCATIONS) {
    const saved = await prisma.location.upsert({
      where: { name: loc.name },
      update: { code: loc.code, address: loc.address },
      create: loc,
    });
    locationMap.set(loc.name.toLowerCase(), saved.id);
  }

  for (const areaName of DEFAULT_REGIONAL_AREAS) {
    await prisma.regionalArea.upsert({
      where: { name: areaName },
      update: {},
      create: { name: areaName },
    });
  }

  for (const policy of DEFAULT_SLA_POLICIES) {
    await prisma.slaPolicy.upsert({
      where: { priority: policy.priority },
      update: {},
      create: policy,
    });
  }

  for (let i = 0; i < MODULE_GROUPS.length; i++) {
    const mod = MODULE_GROUPS[i];
    const savedMod = await prisma.supportModule.upsert({
      where: { name: mod.name },
      update: { groupName: mod.groupName, sortOrder: i },
      create: { groupName: mod.groupName, name: mod.name, sortOrder: i },
    });

    for (const catName of mod.categories) {
      await prisma.supportCategory.upsert({
        where: { moduleId_name: { moduleId: savedMod.id, name: catName } },
        update: { requiresArea: catName === "Master Data" },
        create: {
          moduleId: savedMod.id,
          name: catName,
          requiresArea: catName === "Master Data",
        },
      });
    }
  }

  // 2. Backfill User permissions (canManageMaintenance for Admin & Dwi Ramdhan)
  const users = await prisma.user.findMany();
  const userByNameLower = new Map<string, string>();
  for (const u of users) {
    userByNameLower.set(u.name.trim().toLowerCase(), u.id);
    const shouldManageMaint =
      u.role.toLowerCase() === "admin" || u.name.toLowerCase().includes("dwi");
    if (shouldManageMaint && !u.canManageMaintenance) {
      await prisma.user.update({
        where: { id: u.id },
        data: { canManageMaintenance: true },
      });
    }
  }

  // 3. Backfill ProjectMembers & actualEndDate
  const projects = await prisma.project.findMany();
  for (const proj of projects) {
    const memberNames = parseNameList(proj.members);
    for (const mName of memberNames) {
      const uid = userByNameLower.get(mName);
      if (uid) {
        await prisma.projectMember.upsert({
          where: { projectId_userId: { projectId: proj.id, userId: uid } },
          update: {},
          create: { projectId: proj.id, userId: uid },
        });
      }
    }
    if (proj.status === "Completed" && !proj.actualEndDate) {
      await prisma.project.update({
        where: { id: proj.id },
        data: { actualEndDate: proj.endDate || proj.updatedAt },
      });
    }
  }

  // 4. Backfill TaskExecutors, Task.actualEndDate, Task.attachmentKey
  const tasks = await prisma.task.findMany();
  for (const task of tasks) {
    const execNames = parseNameList(task.executor);
    for (const eName of execNames) {
      const uid = userByNameLower.get(eName);
      if (uid) {
        await prisma.taskExecutor.upsert({
          where: { taskId_userId: { taskId: task.id, userId: uid } },
          update: {},
          create: { taskId: task.id, userId: uid },
        });
      }
    }
    const taskUpdate: Record<string, unknown> = {};
    if (task.status === "Completed" && !task.actualEndDate) {
      taskUpdate.actualEndDate = task.endDate || task.updatedAt;
    }
    if (!task.attachmentKey && task.attachment?.startsWith("data:")) {
      const key = await extractBase64Attachment(task.attachment, "tasks", task.id);
      if (key) {
        taskUpdate.attachmentKey = key;
        taskUpdate.attachment = `/api/files/${key}`;
      }
    }
    if (Object.keys(taskUpdate).length > 0) {
      await prisma.task.update({ where: { id: task.id }, data: taskUpdate });
    }
  }

  // 5. Backfill SupportTicket numbers, SLA targets, sourceType, Base64 attachments
  const tickets = await prisma.supportTicket.findMany({
    orderBy: { createdAt: "asc" },
  });
  const usedTicketNumbers = new Set<string>(
    tickets.map((t) => t.ticketNumber).filter((n): n is string => Boolean(n))
  );
  let seq = 1;
  for (const tkt of tickets) {
    const tktUpdate: Record<string, unknown> = {};
    if (!tkt.ticketNumber) {
      const yr = tkt.createdAt.getFullYear();
      let candidate = `SUP-${yr}-${String(seq).padStart(4, "0")}`;
      while (usedTicketNumbers.has(candidate)) {
        seq += 1;
        candidate = `SUP-${yr}-${String(seq).padStart(4, "0")}`;
      }
      tktUpdate.ticketNumber = candidate;
      usedTicketNumbers.add(candidate);
      seq += 1;
    }

    if (!tkt.sourceType) {
      tktUpdate.sourceType = TicketSource.MANUAL;
    }

    if (tkt.ticketType === "REQUEST" && !tkt.slaTargetMinutes) {
      const targetMins = getSlaMinutesForPriority(tkt.priority);
      tktUpdate.slaTargetMinutes = targetMins;
      tktUpdate.slaDueAt = new Date(tkt.startDate.getTime() + targetMins * 60_000);
    }

    if (!tkt.attachmentKey && tkt.attachment?.startsWith("data:")) {
      const key = await extractBase64Attachment(tkt.attachment, "support", tkt.id);
      if (key) {
        tktUpdate.attachmentKey = key;
        tktUpdate.attachment = `/api/files/${key}`;
      }
    }

    if (Object.keys(tktUpdate).length > 0) {
      await prisma.supportTicket.update({ where: { id: tkt.id }, data: tktUpdate });
    }
  }

  // 6. Backfill Asset locationId, assignedPerson & initial AssetCustodyLog
  const fallbackActorId = users[0]?.id || null;
  const assets = await prisma.asset.findMany({ include: { division: true } });
  for (const asset of assets) {
    const assetUpdate: Record<string, unknown> = {};
    if (!asset.locationId && asset.location) {
      const locId = locationMap.get(asset.location.trim().toLowerCase());
      if (locId) assetUpdate.locationId = locId;
    }
    if (!asset.assignedPerson && asset.person) {
      assetUpdate.assignedPerson = asset.person;
    }
    if (Object.keys(assetUpdate).length > 0) {
      await prisma.asset.update({ where: { id: asset.id }, data: assetUpdate });
    }

    const holder = asset.assignedPerson || asset.person;
    if (holder) {
      const existingCustody = await prisma.assetCustodyLog.count({
        where: { assetId: asset.id },
      });
      if (existingCustody === 0) {
        await prisma.assetCustodyLog.create({
          data: {
            assetId: asset.id,
            previousPerson: null,
            newPerson: holder,
            previousLocation: null,
            newLocation: asset.location || null,
            previousDivision: null,
            newDivision: asset.division?.name || null,
            changedById: asset.picUserId || fallbackActorId,
            note: "Initial custody imported from v1 inventory",
            changedAt: asset.purchaseDate || asset.createdAt,
          },
        });
      }
    }
  }

  // 7. Repair legacy notification links (/maintenance/schedules/<id> -> /maintenance?scheduleId=<id>)
  const notifications = await prisma.notification.findMany({
    where: { link: { startsWith: "/maintenance/schedules/" } },
  });
  for (const n of notifications) {
    if (!n.link) continue;
    const schedId = n.link.replace("/maintenance/schedules/", "").trim();
    if (schedId) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { link: `/maintenance?scheduleId=${schedId}` },
      });
    }
  }

  // 8. Integrity verification summary
  const summary = {
    users: await prisma.user.count(),
    projects: await prisma.project.count(),
    projectMembers: await prisma.projectMember.count(),
    tasks: await prisma.task.count(),
    taskExecutors: await prisma.taskExecutor.count(),
    supportTickets: await prisma.supportTicket.count(),
    ticketsWithNumber: await prisma.supportTicket.count({ where: { ticketNumber: { not: null } } }),
    assets: await prisma.asset.count(),
    custodyLogs: await prisma.assetCustodyLog.count(),
    locations: await prisma.location.count(),
    regionalAreas: await prisma.regionalArea.count(),
    supportModules: await prisma.supportModule.count(),
    slaPolicies: await prisma.slaPolicy.count(),
    templates: await prisma.maintenanceTemplate.count(),
    checklistItems: await prisma.checklistItemMaster.count(),
    schedules: await prisma.maintenanceSchedule.count(),
    notifications: await prisma.notification.count(),
  };

  console.log("Migration & Integrity Verification Summary:", JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
