const fs = require('fs');

const file = 'c:/Users/azwan/OneDrive/Documents/Project/Project Management/it-tracker-app/src/components/views/MaintenanceClient.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacements = [
  ['>Kode Aset *<', '>Asset Code *<'],
  ['>Nama Aset *<', '>Asset Name *<'],
  ['>Tipe Aset *<', '>Asset Type *<'],
  ['>Area *<', '>Area *<'], // already english
  ['>Lokasi<', '>Location<'],
  ['>Tanggal Pembelian<', '>Purchase Date<'],
  ['>Garansi Sampai<', '>Warranty Until<'],
  ['>Catatan<', '>Notes<'],
  ['>Batal<', '>Cancel<'],
  ['>Tanggal Estimasi *<', '>Estimated Date *<'],
  ['>Tipe Jadwal *<', '>Schedule Type *<'],
  ['>Kondisi Umum *<', '>Overall Condition *<'],
  ['>Temuan / Catatan<', '>Findings / Notes<'],
  ['> Nama Template *<', '>Template Name *<'],
  ['>Nama Template *<', '>Template Name *<'],
  ['>Frekuensi (days)<', '>Frequency (days)<'],
  ['>Frekuensi (hari)<', '>Frequency (days)<'],
];

for (const [id, en] of replacements) {
  content = content.split(id).join(en);
}

fs.writeFileSync(file, content, 'utf8');
console.log("Replaced leftover JSX labels in MaintenanceClient.tsx");
