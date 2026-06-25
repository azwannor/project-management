// Seed script untuk modul Maintenance Rutin Infrastruktur IT
// Mengisi: AssetType, MaintenanceTemplate, ChecklistItemMaster
// Jalankan: node prisma/seed-maintenance.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper: tentukan reminderOffsetDays berdasarkan frequencyDays (PRD Section E)
function getReminderOffset(frequencyDays) {
  if (frequencyDays <= 14) return 1;   // H-1 (mingguan)
  if (frequencyDays <= 60) return 3;   // H-3 (bulanan)
  return 7;                             // H-7 (quarterly+)
}

// Data AssetType dari PRD Section 7
const ASSET_TYPES = [
  // Server & Compute
  { name: 'Server (Physical)', defaultFreq: 30 },
  { name: 'Server (Virtual Host/Hypervisor)', defaultFreq: 30 },
  { name: 'NAS / Storage', defaultFreq: 60 },
  // Network
  { name: 'Router', defaultFreq: 60 },
  { name: 'Switch', defaultFreq: 60 },
  { name: 'Access Point (AP/WiFi)', defaultFreq: 90 },
  { name: 'Firewall', defaultFreq: 60 },
  // Security & Monitoring
  { name: 'CCTV Camera', defaultFreq: 90 },
  { name: 'NVR/DVR (CCTV Recorder)', defaultFreq: 60 },
  { name: 'Access Control (Fingerprint/RFID)', defaultFreq: 90 },
  // End User Device
  { name: 'PC / Desktop', defaultFreq: 90 },
  { name: 'Laptop', defaultFreq: 90 },
  { name: 'Printer', defaultFreq: 60 },
  // Power & Environment
  { name: 'UPS', defaultFreq: 30 },
  { name: 'AC Ruang Server', defaultFreq: 30 },
  { name: 'Genset', defaultFreq: 30 },
  // Lainnya
  { name: 'Telepon/PABX', defaultFreq: 90 },
  { name: 'Scanner / Barcode Device', defaultFreq: 90 },
];

// Data checklist per AssetType dari PRD Section 8
// Format: { assetTypeName, templateName, frequencyDays, items: [{ text, isRequired }] }
const TEMPLATES = [
  {
    assetTypeName: 'Server (Physical)',
    templateName: 'Checklist Maintenance Server (Physical)',
    frequencyDays: 30,
    items: [
      { text: 'Cek suhu & kondisi fisik (debu, kabel, ventilasi)', isRequired: true },
      { text: 'Cek resource usage (CPU/RAM/Disk) tidak mendekati limit', isRequired: true },
      { text: 'Cek free space disk', isRequired: true },
      { text: 'Cek backup/snapshot berjalan normal', isRequired: true },
      { text: 'Cek log error sistem', isRequired: true },
    ]
  },
  {
    assetTypeName: 'Server (Virtual Host/Hypervisor)',
    templateName: 'Checklist Maintenance Server (Virtual Host/Hypervisor)',
    frequencyDays: 30,
    items: [
      { text: 'Cek suhu & kondisi fisik (debu, kabel, ventilasi)', isRequired: true },
      { text: 'Cek resource usage (CPU/RAM/Disk) tidak mendekati limit', isRequired: true },
      { text: 'Cek free space disk', isRequired: true },
      { text: 'Cek backup/snapshot berjalan normal', isRequired: true },
      { text: 'Cek log error sistem', isRequired: true },
    ]
  },
  {
    assetTypeName: 'NAS / Storage',
    templateName: 'Checklist Maintenance NAS / Storage',
    frequencyDays: 60,
    items: [
      { text: 'Cek suhu & kondisi fisik (debu, kabel, ventilasi)', isRequired: true },
      { text: 'Cek resource usage (CPU/RAM/Disk) tidak mendekati limit', isRequired: true },
      { text: 'Cek free space disk', isRequired: true },
      { text: 'Cek backup/snapshot berjalan normal', isRequired: true },
      { text: 'Cek log error sistem', isRequired: true },
    ]
  },
  {
    assetTypeName: 'Router',
    templateName: 'Checklist Maintenance Router',
    frequencyDays: 60,
    items: [
      { text: 'Cek koneksi/uptime stabil (tidak ada port/koneksi error)', isRequired: true },
      { text: 'Cek kondisi fisik & kabel', isRequired: true },
      { text: 'Cek suhu device', isRequired: true },
      { text: 'Cek log error/security alert', isRequired: true },
      { text: 'Cek firmware update tersedia', isRequired: false },
    ]
  },
  {
    assetTypeName: 'Switch',
    templateName: 'Checklist Maintenance Switch',
    frequencyDays: 60,
    items: [
      { text: 'Cek koneksi/uptime stabil (tidak ada port/koneksi error)', isRequired: true },
      { text: 'Cek kondisi fisik & kabel', isRequired: true },
      { text: 'Cek suhu device', isRequired: true },
      { text: 'Cek log error/security alert', isRequired: true },
      { text: 'Cek firmware update tersedia', isRequired: false },
    ]
  },
  {
    assetTypeName: 'Firewall',
    templateName: 'Checklist Maintenance Firewall',
    frequencyDays: 60,
    items: [
      { text: 'Cek koneksi/uptime stabil (tidak ada port/koneksi error)', isRequired: true },
      { text: 'Cek kondisi fisik & kabel', isRequired: true },
      { text: 'Cek suhu device', isRequired: true },
      { text: 'Cek log error/security alert', isRequired: true },
      { text: 'Cek firmware update tersedia', isRequired: false },
    ]
  },
  {
    assetTypeName: 'Access Point (AP/WiFi)',
    templateName: 'Checklist Maintenance Access Point (WiFi)',
    frequencyDays: 90,
    items: [
      { text: 'Cek kualitas sinyal & koneksi', isRequired: true },
      { text: 'Cek jumlah device terkoneksi (tidak overload)', isRequired: true },
      { text: 'Cek kondisi fisik & mounting', isRequired: true },
      { text: 'Cek firmware update', isRequired: false },
    ]
  },
  {
    assetTypeName: 'CCTV Camera',
    templateName: 'Checklist Maintenance CCTV Camera',
    frequencyDays: 90,
    items: [
      { text: 'Cek kualitas gambar (lensa bersih, tidak blur)', isRequired: true },
      { text: 'Cek semua channel/kamera online & terekam normal', isRequired: true },
      { text: 'Cek sisa storage recording', isRequired: true },
      { text: 'Cek kondisi fisik & kabel', isRequired: true },
      { text: 'Bersihkan lensa kamera', isRequired: false },
    ]
  },
  {
    assetTypeName: 'NVR/DVR (CCTV Recorder)',
    templateName: 'Checklist Maintenance NVR/DVR (CCTV Recorder)',
    frequencyDays: 60,
    items: [
      { text: 'Cek kualitas gambar (lensa bersih, tidak blur)', isRequired: true },
      { text: 'Cek semua channel/kamera online & terekam normal', isRequired: true },
      { text: 'Cek sisa storage recording', isRequired: true },
      { text: 'Cek kondisi fisik & kabel', isRequired: true },
      { text: 'Bersihkan lensa kamera', isRequired: false },
    ]
  },
  {
    assetTypeName: 'Access Control (Fingerprint/RFID)',
    templateName: 'Checklist Maintenance Access Control (Fingerprint/RFID)',
    frequencyDays: 90,
    items: [
      { text: 'Cek fungsi sensor/reader', isRequired: true },
      { text: 'Cek database user masih sinkron', isRequired: true },
      { text: 'Cek baterai backup (jika ada)', isRequired: true },
      { text: 'Cek kondisi fisik', isRequired: true },
    ]
  },
  {
    assetTypeName: 'PC / Desktop',
    templateName: 'Checklist Maintenance PC / Desktop',
    frequencyDays: 90,
    items: [
      { text: 'Cek update OS & antivirus', isRequired: true },
      { text: 'Cek kondisi fisik (casing, keyboard, charger/kabel)', isRequired: true },
      { text: 'Cek free space disk', isRequired: true },
      { text: 'Cek kondisi battery (khusus laptop)', isRequired: true },
      { text: 'Bersihkan fisik dari debu', isRequired: false },
    ]
  },
  {
    assetTypeName: 'Laptop',
    templateName: 'Checklist Maintenance Laptop',
    frequencyDays: 90,
    items: [
      { text: 'Cek update OS & antivirus', isRequired: true },
      { text: 'Cek kondisi fisik (casing, keyboard, charger/kabel)', isRequired: true },
      { text: 'Cek free space disk', isRequired: true },
      { text: 'Cek kondisi battery', isRequired: true },
      { text: 'Bersihkan fisik dari debu', isRequired: false },
    ]
  },
  {
    assetTypeName: 'Printer',
    templateName: 'Checklist Maintenance Printer',
    frequencyDays: 60,
    items: [
      { text: 'Cek level tinta/toner', isRequired: true },
      { text: 'Cek kualitas hasil cetak', isRequired: true },
      { text: 'Bersihkan bagian dalam (debu/sisa kertas)', isRequired: true },
      { text: 'Cek koneksi (network/USB)', isRequired: true },
    ]
  },
  {
    assetTypeName: 'UPS',
    templateName: 'Checklist Maintenance UPS',
    frequencyDays: 30,
    items: [
      { text: 'Cek kondisi & usia battery', isRequired: true },
      { text: 'Cek waktu backup (load test singkat)', isRequired: true },
      { text: 'Cek indikator/alarm error', isRequired: true },
      { text: 'Cek beban (load) tidak overload', isRequired: true },
    ]
  },
  {
    assetTypeName: 'AC Ruang Server',
    templateName: 'Checklist Maintenance AC Ruang Server',
    frequencyDays: 30,
    items: [
      { text: 'Cek suhu ruangan sesuai standar', isRequired: true },
      { text: 'Bersihkan filter AC', isRequired: true },
      { text: 'Cek kebocoran air/drainase', isRequired: true },
      { text: 'Cek kondisi fisik unit', isRequired: true },
    ]
  },
  {
    assetTypeName: 'Genset',
    templateName: 'Checklist Maintenance Genset',
    frequencyDays: 30,
    items: [
      { text: 'Cek bahan bakar', isRequired: true },
      { text: 'Test running/start manual', isRequired: true },
      { text: 'Cek oli & air radiator', isRequired: true },
      { text: 'Cek kondisi battery starter', isRequired: true },
    ]
  },
  {
    assetTypeName: 'Telepon/PABX',
    templateName: 'Checklist Maintenance Telepon/PABX',
    frequencyDays: 90,
    items: [
      { text: 'Cek fungsi utama (panggilan / akurasi scan)', isRequired: true },
      { text: 'Cek kondisi fisik & kabel/baterai', isRequired: true },
      { text: 'Cek koneksi ke sistem', isRequired: true },
      { text: 'Cek log error (jika tersedia)', isRequired: true },
    ]
  },
  {
    assetTypeName: 'Scanner / Barcode Device',
    templateName: 'Checklist Maintenance Scanner / Barcode Device',
    frequencyDays: 90,
    items: [
      { text: 'Cek fungsi utama (panggilan / akurasi scan)', isRequired: true },
      { text: 'Cek kondisi fisik & kabel/baterai', isRequired: true },
      { text: 'Cek koneksi ke sistem', isRequired: true },
      { text: 'Cek log error (jika tersedia)', isRequired: true },
    ]
  },
];

async function main() {
  console.log('🔧 Seeding Maintenance Module data...\n');

  // 1. Seed AssetType
  console.log('📦 Membuat AssetType...');
  const assetTypeMap = {};
  for (const at of ASSET_TYPES) {
    const created = await prisma.assetType.upsert({
      where: { name: at.name },
      update: {},
      create: { name: at.name },
    });
    assetTypeMap[at.name] = created.id;
    console.log(`   ✅ ${at.name}`);
  }
  console.log(`   Total: ${Object.keys(assetTypeMap).length} AssetType\n`);

  // 2. Seed MaintenanceTemplate + ChecklistItemMaster
  console.log('📋 Membuat MaintenanceTemplate + ChecklistItemMaster...');
  let totalTemplates = 0;
  let totalItems = 0;

  for (const tmpl of TEMPLATES) {
    const assetTypeId = assetTypeMap[tmpl.assetTypeName];
    if (!assetTypeId) {
      console.log(`   ⚠️  AssetType "${tmpl.assetTypeName}" tidak ditemukan, skip.`);
      continue;
    }

    const reminderOffset = getReminderOffset(tmpl.frequencyDays);

    // Cek apakah template sudah ada (untuk idempotency)
    const existing = await prisma.maintenanceTemplate.findFirst({
      where: {
        templateName: tmpl.templateName,
        assetTypeId: assetTypeId,
      }
    });

    if (existing) {
      console.log(`   ⏭️  Template "${tmpl.templateName}" sudah ada, skip.`);
      continue;
    }

    const template = await prisma.maintenanceTemplate.create({
      data: {
        templateName: tmpl.templateName,
        assetTypeId: assetTypeId,
        defaultFrequencyDays: tmpl.frequencyDays,
        reminderOffsetDays: reminderOffset,
        checklistItems: {
          create: tmpl.items.map((item, index) => ({
            itemText: item.text,
            order: index + 1,
            isRequired: item.isRequired,
          }))
        }
      },
      include: { checklistItems: true }
    });

    totalTemplates++;
    totalItems += template.checklistItems.length;
    console.log(`   ✅ ${tmpl.templateName} (freq: ${tmpl.frequencyDays}d, reminder: H-${reminderOffset}, items: ${template.checklistItems.length})`);
  }

  console.log(`\n📊 Ringkasan Seed:`);
  console.log(`   AssetType     : ${Object.keys(assetTypeMap).length}`);
  console.log(`   Template      : ${totalTemplates}`);
  console.log(`   Checklist Item: ${totalItems}`);
  console.log('\n✅ Seed maintenance module selesai!');
}

main()
  .catch((e) => {
    console.error('❌ Seed gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
