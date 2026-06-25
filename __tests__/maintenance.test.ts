import prisma from "@/lib/prisma";

// Menggunakan DB Asli untuk testing (akan di-cleanup setelah jalan)
describe("Maintenance Module Critical Logic", () => {
  
  // Setup data sementara
  const testIds = {
    user1: "test-user-1",
    user2: "test-user-2",
    assetType: "test-asset-type",
    asset: "test-asset",
    template: "test-template",
    schedule: "test-schedule",
  };

  beforeAll(async () => {
    // Pastikan bersih sebelum test
    await cleanup();

    // Buat 2 user Staff dengan handled area yang berbeda
    await prisma.user.create({
      data: {
        id: testIds.user1,
        email: "test1@executor.com",
        name: "Test Executor 1",
        password: "hashed",
        role: "Staff",
        jobDesk: "IT Support",
        handledAreas: ["Ruang Server"],
      }
    });

    await prisma.user.create({
      data: {
        id: testIds.user2,
        email: "test2@executor.com",
        name: "Test Executor 2",
        password: "hashed",
        role: "Staff",
        jobDesk: "IT Support",
        handledAreas: ["Ruang Server", "Lobby"],
      }
    });

    // Buat AssetType
    await prisma.assetType.create({
      data: {
        id: testIds.assetType,
        name: "Server",
      }
    });

    // Buat Asset
    await prisma.asset.create({
      data: {
        id: testIds.asset,
        assetCode: "SRV-TEST",
        assetName: "Test Server",
        assetTypeId: testIds.assetType,
        area: "Ruang Server",
        status: "ACTIVE",
      }
    });

    // Buat Template
    await prisma.maintenanceTemplate.create({
      data: {
        id: testIds.template,
        templateName: "Test Template",
        assetTypeId: testIds.assetType,
        defaultFrequencyDays: 30,
        reminderOffsetDays: 3,
        checklistItems: {
          create: [
            { id: "item-1", itemName: "Cek Suhu", order: 1, isRequired: true },
            { id: "item-2", itemName: "Cek RAM", order: 2, isRequired: false },
          ]
        }
      }
    });
  });

  afterAll(async () => {
    await cleanup();
  });

  async function cleanup() {
    await prisma.checklistResult.deleteMany({ where: { log: { scheduleId: testIds.schedule } } });
    await prisma.maintenanceLog.deleteMany({ where: { scheduleId: testIds.schedule } });
    await prisma.maintenanceSchedule.deleteMany({ where: { id: testIds.schedule } });
    await prisma.maintenanceTemplate.deleteMany({ where: { id: testIds.template } });
    await prisma.asset.deleteMany({ where: { id: testIds.asset } });
    await prisma.assetType.deleteMany({ where: { id: testIds.assetType } });
    await prisma.user.deleteMany({ where: { id: { in: [testIds.user1, testIds.user2] } } });
    
    // Cleanup generated schedules (yg ID nya random)
    await prisma.maintenanceSchedule.deleteMany({ where: { assetId: testIds.asset } });
  }

  it("1. Auto-assignment by Area: Multiple executors matched", async () => {
    const asset = await prisma.asset.findUnique({ where: { id: testIds.asset } });
    
    // Logic assignment (sama seperti di POST /api/maintenance-schedules)
    const matchingExecutors = await prisma.user.findMany({
      where: {
        handledAreas: { has: asset!.area },
        role: "Staff",
      },
      select: { id: true },
    });

    expect(matchingExecutors.length).toBeGreaterThanOrEqual(2);
    const executorIds = matchingExecutors.map(e => e.id);
    expect(executorIds).toContain(testIds.user1);
    expect(executorIds).toContain(testIds.user2);

    // Create schedule
    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        id: testIds.schedule,
        scheduleType: "RECURRING",
        status: "UPCOMING",
        assetId: testIds.asset,
        templateId: testIds.template,
        nextDueDate: new Date(),
        assignedExecutors: {
          connect: executorIds.map((id) => ({ id })),
        },
      },
      include: { assignedExecutors: true }
    });

    expect(schedule.assignedExecutors.length).toBe(2);
  });

  it("2. Auto-generate schedule berikutnya & 3. Snapshot Checklist", async () => {
    const template = await prisma.maintenanceTemplate.findUnique({
      where: { id: testIds.template },
      include: { checklistItems: true }
    });

    // Skenario: Eksekusi schedule yg pertama
    const currentSchedule = await prisma.maintenanceSchedule.findUnique({ where: { id: testIds.schedule } });
    
    // Simulate POST /api/maintenance-logs
    const log = await prisma.maintenanceLog.create({
      data: {
        scheduleId: currentSchedule!.id,
        executorId: testIds.user1,
        overallCondition: "BAIK",
        findings: "Aman",
        results: {
          create: template!.checklistItems.map((item) => ({
            checklistItemId: item.id,
            snapshotItemName: item.itemName, // <--- Ini poin krusial snapshot
            isPassed: true,
            notes: "OK"
          }))
        }
      },
      include: { results: true }
    });

    // Update status schedule yg lama
    await prisma.maintenanceSchedule.update({
      where: { id: currentSchedule!.id },
      data: { status: "DONE" }
    });

    // Auto-generate next schedule
    let nextScheduleId = null;
    if (currentSchedule!.scheduleType === "RECURRING" && currentSchedule!.templateId) {
      const freq = template!.defaultFrequencyDays;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + freq);

      // Auto-assign existing executors
      const matchingExecutors = await prisma.user.findMany({
        where: { handledAreas: { has: "Ruang Server" }, role: "Staff" },
        select: { id: true },
      });

      const nextSched = await prisma.maintenanceSchedule.create({
        data: {
          scheduleType: "RECURRING",
          status: "UPCOMING",
          assetId: currentSchedule!.assetId,
          templateId: currentSchedule!.templateId,
          nextDueDate: nextDate,
          assignedExecutors: {
            connect: matchingExecutors.map((e) => ({ id: e.id })),
          },
        },
      });
      nextScheduleId = nextSched.id;
    }

    // Verifikasi
    expect(nextScheduleId).not.toBeNull();
    const newSchedule = await prisma.maintenanceSchedule.findUnique({ where: { id: nextScheduleId! }});
    expect(newSchedule!.status).toBe("UPCOMING");
    // Pastikan nextDueDate bertambah kurang lebih 30 hari
    const diff = newSchedule!.nextDueDate.getTime() - new Date().getTime();
    const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBe(30);

    // Verifikasi Snapshot: 
    // Ubah template name/item
    await prisma.checklistItemMaster.update({
      where: { id: "item-1" },
      data: { itemName: "Cek Suhu Berubah" }
    });

    // Ambil log result
    const resultItem1 = log.results.find(r => r.checklistItemId === "item-1");
    // Snapshot name harus tetap yang lama
    expect(resultItem1!.snapshotItemName).toBe("Cek Suhu");
  });

});
