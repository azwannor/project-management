# Product Requirements Document (PRD) — IT Tracker v2

**Product Name:** Royal Medica IT Tracker (IT Operations & Project Command Center)  
**Organization:** PT. Royal Medicalink Pharmalab — IT Department  
**Version:** 2.0 (Rebuild)  
**Production Target:** `https://projectmng.royalmedicalink.id` (Self-Hosted Hostinger VPS)  
**UI Languages:** English (Default) + Bahasa Indonesia Toggle (`EN / ID`)  
**Themes:** Dual Mode — Light (Operational Default) & Dark (Architectural / Boardroom)

---

## 1. Executive Summary & Product Vision

IT Tracker v2 adalah platform terpadu bagi tim IT PT. Royal Medicalink Pharmalab untuk mengelola empat fungsi inti dalam satu sistem:
1. **Executive KPI & Master Roadmap** — Tampilan siap-rapat (*Boardroom-Ready*) sehingga IT Manager cukup membuka aplikasi ini saat Direksi menanyakan progres timeline proyek, performa SLA support, beban kerja tim, maupun kesehatan aset IT tanpa menyusun slide/spreadsheet manual.
2. **Project & Task Management** — Pengelolaan proyek IT dengan hierarki task/sub-task, multi-view (Table, Kanban, Timeline/Gantt), dan *Hybrid Time Tracking*.
3. **IT Support & Operational Logs** — Pemisahan yang tegas antara **Support Queue (`REQUEST`)** berbasis SLA dan **Daily Activity (`DAILY_ACTIVITY`)**, lengkap dengan kesiapan API eksternal untuk integrasi tombol *"Report Problem"* dari aplikasi internal perusahaan.
4. **Enterprise IT Asset Management, QR Sticker & Preventive Maintenance** — Inventaris aset perusahaan dengan riwayat serah terima (*custody*), generator cetak stiker QR (Thermal & A4), halaman scan lapangan ramah HP, dan jadwal perawatan rutin otomatis.

---

## 2. User Roles & Access Control

Struktur role disamakan dengan sistem v1 agar adopsi tim tanpa gesekan, namun seluruh pengecualian hardcoded (seperti pengecekan nama `"dwi"` di kode) dipindahkan ke permission eksplisit di database:

| Role / Flag | Scope Akses |
| :--- | :--- |
| **`Admin`** | Akses penuh ke seluruh modul: Executive KPI, CRUD Project/Task, Support Queue & Team Logs, Asset Registry, Maintenance Templates/Schedules/Logs, Master Data, User Management, API Keys. |
| **`Staff`** | Akses ke Dashboard, Project & Task, Support Queue, My Daily Logs, Asset Registry (view), Maintenance Schedules & Logs (yang ditugaskan ke dirinya atau Ad-Hoc), Profile Settings. |
| **`canViewTeamLogs` (Boolean per User)** | Memberi akses bagi `Staff` tertentu untuk melihat tab **Team Logs** di modul Support & Operasional. |
| **`canManageMaintenance` (Boolean per User)** | Memberi akses admin penuh pada modul **Asset & Maintenance** (CRUD Aset, Divisi, Asset Type, Template Checklist, Bulk Import, Cetak QR Batch, semua Schedule & Log). Pada migrasi data v1→v2, otomatis diset `true` untuk akun *Dwi Ramdhan*. |
| **Public QR Scanner (Unauthenticated)** | Akses baca sangat terbatas pada `/assets/q/[assetCode]`: hanya menampilkan Kode Aset, Nama Aset, Lokasi/Divisi, dan Status Aset (tanpa harga beli, serial number sensitif, atau log internal), disertai tombol *Login Tim IT* dan (fase lanjutan) *Report Issue*. |
| **External System Client (API Key — Planned)** | Autentikasi via `X-API-Key` pada endpoint `POST /api/v1/external/tickets` untuk menerima tiket otomatis dari tombol *"Report Problem"* di aplikasi internal (`Sistem AI`, `Sistem PIC`, `HRIS`, `Factory Sistem`). |

---

## 3. Core Modules & Functional Requirements

### Module 1: Executive Overview & Boardroom Mode (`/dashboard`)

**Tujuan:** Menjawab seluruh pertanyaan Direksi mengenai KPI tim IT dan timeline proyek secara real-time dalam satu layar.

- **Boardroom / Presentation Mode Toggle (1-Klik):**
  - Menyembunyikan sidebar navigasi dan tombol edit/CRUD internal.
  - Menampilkan layout *full-canvas* yang bersih dengan filter periode (`This Month`, `This Quarter`, `This Year`, `All Time`, `Custom Range`) dan filter per anggota tim.
- **4 KPI Cards Real-Time (Zero Hardcoded Trends):**
  - Setiap angka tren (`+X%` / `-X%`) dihitung nyata dibandingkan periode sebelumnya (*month-over-month* / *quarter-over-quarter*).
  1. **Project On-Time Rate**: Persentase task/project selesai tepat waktu (`actualEndDate <= endDate`) + jumlah *At Risk / Overdue*.
  2. **Support SLA Compliance & MTTR**: Persentase tiket `REQUEST` selesai dalam batas SLA + rata-rata waktu penyelesaian (*Mean Time To Resolve*).
  3. **Maintenance Compliance & Asset Health**: Persentase jadwal maintenance selesai tepat waktu + rasio aset `ACTIVE` / kondisi `BAIK`.
  4. **Active Workload**: Total active tasks & open requests saat ini per kapasitas tim.
- **Master Project Roadmap (Executive Timeline):**
  - Menampilkan seluruh proyek aktif secara paralel dalam satu horizontal timeline dengan garis penanda **`TODAY`**.
  - Indikator status kesehatan proyek otomatis: `On Track` (hijau), `At Risk` (amber — progres tertinggal dari jadwal), `Delayed` (merah — melewati `endDate` dan belum selesai).
  - Klik baris proyek untuk **expand inline** melihat daftar *Main Tasks*, PIC, progres %, dan tanggal selesai aktual vs target.
- **Team Performance Matrix & Per-Person Task Timelines (Expandable):**
  - Tabel ringkas per staf: `Tasks Done`, `Tickets Resolved`, `Avg Resolution Time (MTTR)`, `Maintenance Completed`, dan `Logged Hours`.
  - Toggle **`Summary | Tasks & Timeline`** (dan *expand inline* per anggota) untuk langsung menampilkan daftar task/tiket aktif milik staf tersebut, **mini timeline bar (`Start -> Deadline`)**, status (`Due / Overdue`), serta `Logged Hours` aktualnya.
- **Effort Distribution Split & Blocker Radar:**
  - **Effort Split (`TimeLog`):** Bar proporsi pembagian jam kerja tim antara **Project Development**, **Support Queue**, dan **Maintenance Rutin**.
  - **Blocker & Escalation Radar:** Panel fokus berisi proyek/task/tiket yang `AT RISK`, `OVERDUE`, atau `SLA BREACH` lengkap dengan ringkasan kendala (`issue`) dan PIC untuk dibahas di rapat manajemen.
- **Charts & Streams:**
  - *Support Volume by Category & Module* (Bar/Area chart dengan perbandingan `REQUEST` vs `DAILY_ACTIVITY`).
  - *Asset Health & Upcoming Maintenance (7 Days)*.
  - *My Action Queue* (untuk user yang login: daftar task jatuh tempo, tiket aktif, dan jadwal maintenance yang di-assign ke dirinya).
- **Executive Export:**
  - Export rekap bulanan/kuartalan ke **Excel (`.xlsx`)** multi-sheet (*Executive Summary, Project Roadmap, Team KPI, Support SLA, Asset & Maintenance*) dan mode **Print / Save PDF** yang rapi.

---

### Module 2: Project & Task Management (`/projects`)

- **Project Portfolio (`/projects`):**
  - Daftar proyek dengan progress bar real-time, status (`NOT_STARTED`, `ONGOING`, `ON_HOLD`, `COMPLETED`), rentang tanggal, objective, dan daftar anggota tim (berbasis relasi `ProjectMember`, bukan string koma).
  - Quick filter proyek & tombol *New Project*.
- **Task Workspace (`/projects/[id]` atau `/projects?view=tasks`):**
  - **3 View Utama** (dengan switcher pill bersih):
    1. **Table View (Hierarki)**: Parent task & Sub-task (`parentId`), *inline edit* (judul, tanggal, status, prioritas, executor), drag-and-drop ubah parent/proyek dengan proteksi *circular dependency*, tambah root task & subtask inline, dan tampilan mobile card responsif.
    2. **Kanban Board**: Kolom status (`Not Started`, `Ongoing`, `Completed`), drag-and-drop antar status, indikator parent task & SLA/overdue.
    3. **Timeline / Gantt View**: Batang jadwal per project & task, penanda `TODAY`, perbandingan *planned endDate* vs `actualEndDate`, serta sub-mode kalender bulanan bila dibutuhkan.
- **Automations:**
  - Jika seluruh sub-task selesai (`COMPLETED`), parent task otomatis menjadi `COMPLETED`, mengisi `actualEndDate`, dan mengirim notifikasi Telegram.
  - Jika ada sub-task dibuka kembali atau ditambahkan sub-task baru pada parent yang sudah selesai, parent otomatis kembali ke `ONGOING`.
- **Hybrid Time Tracking (`TimeLog`):**
  - **Otomatis:** Berpindah status ke `ONGOING` → membuka sesi `TimeLog` (`source = AUTO`). Berpindah ke `COMPLETED` / `NOT_STARTED` / `ON_HOLD` → menutup sesi aktif dan menghitung durasi otomatis.
  - **Manual Override & Focus Timer:** Di panel detail task, user dapat mengoreksi durasi/waktu sesi (dengan catatan singkat) atau menggunakan tombol opsional `Start / Pause` (`source = MANUAL`).
  - Seluruh durasi terakumulasi otomatis sebagai `totalLoggedMinutes` untuk laporan KPI.
- **Collaboration:**
  - Drawer komentar berbalas (`replyToId`), lampiran file tersimpan di MinIO, dan indikator *unread comments* per user (`CommentReadStatus`).
  - Tombol **Remind** manual ke Telegram (Grup + DM ke `telegramChatId` executor).

---

### Module 3: Support & Operational Logs (`/support`)

Satu menu utama dengan **2 tab terpisah** agar lifecycle helpdesk dan jurnal harian tidak saling mengacaukan:

#### Tab A — Support Queue (`REQUEST`)
- **Alur Status:** `NOT_STARTED` → `ONGOING` → `SUSPENDED` → `DONE`.
- **Dynamic SLA Engine:**
  - Target SLA ditentukan berdasarkan prioritas (dapat dikonfigurasi Admin di Settings):
    - `URGENT`: 2 jam
    - `HIGH`: 4 jam
    - `NORMAL`: 24 jam
    - `LOW`: 48 jam
  - Badge SLA real-time pada setiap tiket terbuka (countdown sisa waktu atau durasi *breached*).
- **Auto-Assign Regional Area:**
  - Untuk kategori `Master Data`, pemilihan `Area` (dari Master Data, bukan hardcode) otomatis mengisi executor berdasarkan `user.handledAreas`.
- **Auto `endDate` & Hybrid TimeLog:**
  - Saat status berubah ke `ONGOING` → catat `startedAt` + buka `TimeLog` otomatis.
  - Saat status berubah ke `DONE` → isi `endDate = now`, tutup `TimeLog`, hitung durasi penyelesaian, dan kirim notifikasi selesai ke Telegram. Jika dibuka kembali dari `DONE` ke status lain, `endDate` dikosongkan.
- **Cross-Module Actions:**
  - **Promote to Project Task**: Mengubah tiket `REQUEST` (misal kategori *New Feature / Development*) menjadi task di proyek tertentu dengan referensi balik.
  - **Linked Asset**: Tiket dapat ditautkan ke `Asset` (baik manual maupun otomatis saat tiket berasal dari hasil Maintenance / Scan QR).
- **Telegram Interactive Flow:**
  - Tiket `REQUEST` baru & perubahan prioritas ke `URGENT` dikirim ke Telegram dengan tombol inline `✅ Tandai Selesai`.
  - Webhook `/api/telegram/webhook` menandai tiket `DONE`, mengisi `endDate`, mencatat nama penyelesai, dan memperbarui pesan Telegram.

#### Tab B — Daily Activity Log (`DAILY_ACTIVITY`)
- Pencatatan aktivitas operasional harian staf IT (tanpa SLA, tanpa broadcast Telegram).
- Filter sub-tab **My Logs** | **Team Logs** (muncul untuk `Admin` dan user dengan `canViewTeamLogs = true`).
- Rich-text editor untuk *Issue/Activity* dan *Solution/Output*, lampiran file ke MinIO, link eksternal, dan ekspor Excel/CSV.

#### Roadmap Readiness — External "Report Problem" Integration (Plan Pengembangan)
- Skema database & kontrak endpoint disiapkan sejak rilis v2:
  - Field pada `SupportTicket`: `sourceType` (`MANUAL` | `EXTERNAL_APP` | `QR_SCAN` | `MAINTENANCE`), `sourceApp`, `sourceMenu`, `sourceUrl`, `reporterEmail`, `sourceMetadata (JSON)`.
  - Endpoint siap pakai: `POST /api/v1/external/tickets` (autentikasi `X-API-Key`).
- Pada rilis awal v2, tiket tetap diinput manual (field `sourceApp` / `sourceMenu` opsional). Ketika aplikasi internal lain (`Sistem AI`, `Sistem PIC`, `HRIS`, `Factory Sistem`) menambahkan tombol *"Report Problem"*, integrasi langsung aktif tanpa perubahan skema database.

---

### Module 4: Enterprise Asset Management, QR Sticker & Maintenance (`/assets` & `/maintenance`)

Dibangun ulang sepenuhnya sebagai 1 ekosistem terpadu dengan **4 sub-tab** (`Asset Registry`, `QR & Print Center`, `Maintenance Schedules`, `Checklist Templates & Logs`):

#### 4.1 Asset Registry & Custody Lifecycle
- **Data Aset Perusahaan:**
  - `assetCode` (format standar otomatis misal `RMP-JKT-LPT-001`, tetap mempertahankan kode 17 aset hasil migrasi v1).
  - Relasi: `AssetType`, `Division`, `Location` (`HO Jakarta`, `HO Makassar`, `Pabrik`, `Marketing` — dikelola di Master Data), `picUser` (PIC IT).
  - Detail Teknis & Finansial: `brand`, `model`, `serialNumber`, `specs (JSON)` (CPU/RAM/Storage/OS/IP), `purchaseDate`, `purchasePrice` (opsional), `vendor`, `warrantyEndDate` (dengan indikator expired / H-30), `status` (`ACTIVE`, `IN_REPAIR`, `SPARE`, `RETIRED`, `LOST`), `photoUrl` (MinIO), `notes`.
- **Custody / Handover History (`AssetCustodyLog`):**
  - Setiap perubahan pemegang (`assignedPerson`), divisi, atau lokasi otomatis tercatat sebagai histori perpindahan aset (*siapa memegang aset sejak kapan hingga kapan*).
- **Bulk Import Excel/CSV (Fixed & Aligned):**
  - Template `.xlsx`/`.csv` resmi menggunakan kolom `Asset Code`, `Asset Name`, `Asset Type`, `Division`, `Location`, `Detailed Location`, `Assigned Person`, `Brand`, `Model`, `Serial Number`, `Purchase Date`, `Warranty End Date`.
  - Validasi ketat dengan preview baris valid vs error sebelum eksekusi.

#### 4.2 QR Sticker Engine & Mobile Field Scan
- **QR Code Unik per Aset:**
  - Menggunakan vector SVG (tajam di segala DPI) berisi URL permanen: `https://projectmng.royalmedicalink.id/assets/q/<assetCode>`.
- **QR Print Studio (Single & Batch Print):**
  - Pilih 1 aset atau centang banyak aset sekaligus → buka pratinjau cetak (*Print Preview*).
  - **2 Mode Layout Cetak:**
    1. **Thermal Label Mode** (`50×30mm` & `60×40mm`) — 1 stiker per halaman label untuk printer thermal (Xprinter / Brother / Zebra).
    2. **A4 Sticker Sheet Grid** (`3×8` = 24 stiker per lembar A4) — untuk kertas stiker A4 di printer kantor standar.
  - **Komposisi Stiker:** Mini logo Royal Medica + QR Vector + `assetCode` (monospace bold) + `assetName` (1 baris truncate) + `Location · Division`.
- **Mobile Scan Landing Page (`/assets/q/[assetCode]`):**
  - Didesain *mobile-first* agar nyaman langsung dibuka dari kamera HP di ruang server, pabrik, atau kantor:
    - **Mode Authenticated (Tim IT):** Menampilkan status aset, spesifikasi, pemegang, garansi, riwayat 3 maintenance terakhir, serta 2 tombol aksi cepat:
      - **`Execute Maintenance`** (langsung membuka checklist jadwal `DUE`/`OVERDUE` jika ada, atau membuat inspeksi `ADHOC`).
      - **`Report / Log Repair`** (langsung membuat `SupportTicket` tertaut ke aset ini).
    - **Mode Public (Non-Login):** Menampilkan kartu identitas aset dasar (*Code, Name, Location, Division, Status*) + tombol *"Sign In (IT Staff)"* (dan siap tombol *"Report Problem"* pada fase portal eksternal).

#### 4.3 Preventive Maintenance Engine
- **Templates (`MaintenanceTemplate` + `ChecklistItemMaster`):**
  - Migrasi penuh 18 template & 82 item checklist existing; fitur tambah/edit/duplikasi/reorder checklist item, `defaultFrequencyDays`, dan `reminderOffsetDays` (`<=14d: H-1`, `<=60d: H-3`, `>60d: H-7` dengan opsi override).
- **Schedules (`MaintenanceSchedule`):**
  - Mendukung `RECURRING` & `ADHOC`, single create & **Bulk Schedule Generator** (pilih beberapa aset sekaligus per kategori/lokasi).
  - Auto-assign executor berdasarkan kecocokan `asset.location` dengan `user.handledAreas`, dapat di-override manual.
  - Status otomatis (`UPCOMING` → `DUE` → `OVERDUE` → `DONE`) dikalkulasi oleh cron harian.
- **Execution Logs (`MaintenanceLog` + `ChecklistResult`):**
  - Form checklist *tap-to-check* ramah HP + upload foto bukti ke MinIO + kondisi keseluruhan (`BAIK`, `PERLU_PERHATIAN`, `BERMASALAH`) + temuan (`findings`).
  - **Immutable Snapshot**: Teks item checklist disalin saat submit agar histori log tidak berubah jika template diubah di kemudian hari.
  - **Auto-Next Cycle**: Jika `RECURRING`, langsung membuat jadwal berikutnya (`executionDate + frequencyDays`) dengan executor yang sama.
  - **Auto-Create Support Ticket (Closing Phase 3 Gap):** Jika `overallCondition === "BERMASALAH"` atau `followUpNeeded === true`, opsi *Create Linked Support Ticket* otomatis membuat `SupportTicket` tipe `REQUEST`, mengisi foreign key `MaintenanceLog.supportTicketId`, menautkan `SupportTicket.assetId`, mengirim notif Telegram, dan opsional mengubah status aset ke `IN_REPAIR`.

---

### Module 5: Settings, Master Data & Integrations (`/settings`)

- **My Profile:** Edit nama, email, foto profil (MinIO), `telegramUsername`, `telegramChatId` (dengan panduan singkat ketik `/start` ke bot), ganti password, preferensi bahasa (`EN / ID`), dan preferensi tema (`Light / Dark`).
- **User Management (`Admin`):** CRUD user, set role (`Admin`/`Staff`), toggle `canViewTeamLogs` & `canManageMaintenance`, dan atur `handledAreas`.
- **Master Data Manager (`Admin`):** Kelola `Divisions`, `Locations`, `Regional Areas`, `Asset Types`, `Support Modules & Categories`, serta `SLA Policies` tanpa perlu ubah kode.
- **Integrations (`Admin`):** Status & konfigurasi Telegram Webhook (`/api/telegram/set-webhook`), tes kirim pesan bot, serta manajemen `ExternalApiKey` (untuk fitur *Report Problem* masa depan).

---

## 4. Non-Functional Requirements & Guardrails

1. **100% Data Continuity:** Seluruh 18 tabel produksi saat ini (`9` users, `6` projects, `140` tasks, `262` support tickets, `152` notifications, `9` divisions, `18` asset types, `17` assets, `18` templates, `82` checklist items, `2` schedules) wajib termigrasi utuh tanpa kehilangan satu record pun.
2. **Zero Base64 Bloat:** Seluruh lampiran baru dan migrasi lampiran existing disimpan di **MinIO (`ittracker-minio`)**, bukan di kolom teks PostgreSQL.
3. **Bilingual (`EN / ID`):** Default antarmuka Bahasa Inggris profesional dengan toggle instan ke Bahasa Indonesia (`EN / ID`) di header bar (konsisten dengan referensi `battana.maningo.id`).
4. **Responsive Multi-Device & Mobile PWA:** Seluruh modul dirancang responsif untuk 3 ukuran layar (**Desktop `1440px`**, **Tablet `834px`** dengan *68px Icon Rail*, dan **Mobile `390px`**) serta beroperasi sebagai **Progressive Web App (PWA)** installable dengan **Fixed Bottom Navigation Bar** (`Overview`, `Projects`, `Support`, `Assets & QR`, `More`) dan *safe-area* spacing.
5. **Anti-AI-Slop UI Standard:** Tanpa subtitle deskriptif berlebihan di bawah judul, tanpa dekorasi gradien/ikon warna-warni generik, memprioritaskan tipografi presisi, tabular numbers, dan kepadatan informasi siap pakai.
5. **Security & Session:** Rolling JWT cookie (`httpOnly`, `sameSite=lax`, `secure` di prod) dengan durasi 24 jam via `proxy.ts` mencakup seluruh rute terproteksi termasuk `/maintenance` dan `/assets` (kecuali `/assets/q/[code]` public preview).
6. **Multi-Tenant VPS Safety:** Mematuhi 100% aturan isolasi Hostinger VPS (prefix `ittracker-*`, `-p ittracker`, zero host port binding DB/MinIO, shared network `caddy_shared` hanya pada `ittracker-app:3000`).
