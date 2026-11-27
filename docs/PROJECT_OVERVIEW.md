# Dokumentasi Lengkap Proyek — Royal Medica IT Tracker

Dokumen ini merupakan panduan menyeluruh mengenai arsitektur, modul, API, database, alur notifikasi, dan standar keamanan **Royal Medica IT Tracker** (`PT. Royal Medicalink Pharmalab`) agar tim developer maupun infrastruktur mudah memahami sistem sebelum melakukan deployment ke production.

---

## 1. Gambaran Umum & Tech Stack

**IT Tracker** adalah aplikasi *Internal IT Operations Command Center* yang mencakup manajemen proyek & tugas, pelacakan jam kerja hybrid (*Time Tracking*), antrean tiket support berbasis SLA, catatan aktivitas harian, inventaris aset + cetak stiker QR + preventive maintenance, manajemen master data dinamis, serta integrasi bot Telegram & REST API eksternal.

| Layer | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Framework & UI** | Next.js `16.2.9` (App Router, `output: "standalone"`), React `19.2.4`, TypeScript `5` | Server Components + Client Views, bilingual **`EN \| ID`**, dual theme (**Light Clean** & **Soft Charcoal Dark**), responsif Desktop (`1440px`), Tablet (`834px`), Mobile PWA (`390px`). |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/postcss`), `lucide-react` | Komponen portal kustom (`ThemedSelect`, `ThemedDatePicker`, `ThemedDateRangePicker`, `ThemedTimePicker`) tanpa input tanggal/jam/select bawaan OS. |
| **Database & ORM** | PostgreSQL `17`, Prisma `5.22.0` | Schema terpusat di [prisma/schema.prisma](file:///Users/battana/Documents/Project/project-management/prisma/schema.prisma). |
| **Authentication** | Rolling JWT (`jose`, HS256) + `bcryptjs` | HttpOnly cookie `session` (1 hari, refresh otomatis per request di [src/proxy.ts](file:///Users/battana/Documents/Project/project-management/src/proxy.ts)). |
| **File Storage** | MinIO / S3-compatible (`@aws-sdk/client-s3`) | Otomatis fallback ke disk lokal (`/app/.uploads`) bila env `MINIO_*` kosong. File diakses melalui proxy terautentikasi `/api/files/[...key]`. |
| **Charts, Docs & QR** | `recharts`, `xlsx`, `qrcode`, `date-fns`, `react-quill-new` | Grafik KPI, import/export Excel, QR SVG vector, dan editor teks. |
| **Testing** | Jest `30.4.2` + `ts-jest`, ESLint `9` | 7 test suite (`31` test cases) di `__tests__/`. |

---

## 2. Struktur Direktori Repository

```text
project-management/
├── .env.example                    # Template environment variables (salin ke .env.production di server)
├── next.config.ts                  # Konfigurasi standalone build & global HTTP security headers
├── package.json                    # Scripts dev (port 3001), build:docker, test, lint
├── docker/
│   ├── Dockerfile                  # Multi-stage Node 22 Alpine image (standalone server.js port 3000)
│   ├── docker-compose.gcp.yml      # Stack Compose siap pakai untuk VM GCP (proxy Nginx di host, port 127.0.0.1:3100)
│   ├── docker-compose.prod.yml     # Stack Compose dengan network eksternal caddy_shared
│   └── cron/crontab                # Jadwal cron otomatis (07:30 WITA maintenance, 08:00 WITA Senin-Jumat reminders)
├── prisma/
│   ├── schema.prisma               # Schema 21+ model domain IT Tracker
│   ├── seed.js                     # Seed dummy user/project/task untuk dev lokal
│   └── seed-maintenance.js         # Seed dummy asset types & template maintenance
├── docs/
│   ├── PROJECT_OVERVIEW.md         # Dokumen arsitektur & panduan proyek lengkap (file ini)
│   ├── GCP_DEPLOYMENT_GUIDE.md     # Syarat & SOP lengkap deploy + cutover ke GCP
│   ├── PRD.md                      # Product Requirements Document
│   ├── DATABASE_DESIGN.md          # ERD & detail desain skema database
│   ├── BRAND_GUIDELINES.md         # Token warna, tipografi, & aturan desain UI
│   ├── IMPLEMENTATION_PLAN.md      # Roadmap implementasi Phase 0-6
│   └── FIGCRAFT_GUIDE.md           # Panduan alur desain FigCraft
├── design/
│   └── Royal_Medica_IT_Tracker.figcraft  # Master UI mockup (.figcraft) untuk seluruh layar 00-06
├── scripts/
│   ├── deploy-vps.sh               # Contoh skrip build + rollout Docker zero-downtime DB
│   └── migrate-v1-to-v2.ts         # Skrip migrasi idempoten dari database v1 ke v2
├── src/
│   ├── proxy.ts                    # Route middleware proteksi session & rolling JWT
│   ├── app/                        # Halaman App Router & 58 API Route Handlers
│   ├── components/                 # Layout shell, provider theme/locale/boardroom, komponen UI & views
│   ├── i18n/                       # Kamus bahasa Inggris (`en.ts`) & Indonesia (`id.ts`)
│   └── lib/                        # Helper auth, KPI engine, SLA, time log, maintenance, QR, storage, telegram, cron
└── __tests__/                      # Unit & integration tests (7 suites, 31 tests)
```

---

## 3. Modul Fungsional Utama Aplikasi

| Route | Modul | Fitur Utama |
| :--- | :--- | :--- |
| **`/login`** | Autentikasi | Login email & password, validasi akun aktif (`isActive`), rate limiter brute-force (`10` gagal / `15` menit), proteksi Open Redirect `callbackUrl`. |
| **`/dashboard`** | Executive Overview | Kalkulasi KPI real-time (Project On-Time Rate, Support SLA Compliance & MTTR, Maintenance Compliance, Beban Kerja Tim), Master Project Roadmap (Gantt + penanda `TODAY` + expand main tasks), **Boardroom Mode** fullscreen, Export `.xlsx` & Print PDF. |
| **`/projects`** | Project & Task Management | CRUD Proyek (`ProjectMember`), 4 mode kerja Task (**Table Hierarchy** + drag-drop cycle-safe, **Kanban Board**, **Timeline/Gantt**, **Schedule Calendar** Day/Week/Month), **Hybrid Time Tracking** (otomatis start/stop saat status berubah + manual log + focus timer), Comments Drawer + unread indicator + lampiran file. |
| **`/support`** | Support Queue & Daily Logs | Pemisahan tab **Support Queue (`REQUEST`)** bernomor urut `SUP-YYYY-XXXX` + live **SLA Countdown** (`ON_TRACK`, `AT_RISK`, `BREACHED`) & **Daily Activity (`DAILY_ACTIVITY`)**, auto-assign pelaksana berdasarkan **Area Regional**, fitur **Promote Request → Project Task**, Hybrid TimeLogs, & tombol manual **Remind via Telegram**. |
| **`/maintenance`** | Assets, QR & Preventive Maintenance | 5 tab kerja: **Registry** (CRUD aset + warranty alert + import Excel `.xlsx`/`.xls`/`.csv`), **QR Code** (Print Studio stiker Thermal `50x30`/`60x40` & A4 24/lembar + tracking `qrPrintedAt`), **Schedules** (jadwal rutin & ad-hoc), **Execute** (checklist tap-to-check + snapshot hasil + auto-next cycle + auto-create Support Ticket jika `BERMASALAH`), dan **Templates** (template checklist per tipe aset). |
| **`/assets/q/[code]`** | Mobile Field QR Scan | **Dual-mode**: <br>1) **Tanpa Login (Publik):** hanya menampilkan badge identitas aman (`assetCode`, `assetName`, `status`, `division`, `location`, `assetType`, QR SVG) + tombol *Sign In (IT Staff)*.<br>2) **Staf Login:** menampilkan riwayat custody lengkap, jadwal maintenance, eksekusi inspeksi langsung, dan lapor kendala aset menjadi Support Ticket. |
| **`/settings`** | Settings, Master Data & Integrations | 3 tab: **My Profile** (upload avatar, edit Telegram Username/Chat ID, ubah password, bahasa `EN/ID`, tema Light/Dark), **Users** (Admin-only: kelola akun, flag `canViewTeamLogs` / `canManageMaintenance` / `isActive`, & matriks 27 Area Regional), dan **Master & API** (Admin-only: CRUD Divisions, Locations, Asset Types, Regional Areas, Support Modules/Categories, SLA Policies, uji Telegram & Cron, serta kelola **ExternalApiKey**). |

---

## 4. Sistem Autentikasi & Hak Akses (RBAC)

Terdapat 4 mekanisme otorisasi berbeda di backend:

1. **Session JWT Cookie (`session`)**:
   - Dipakai oleh seluruh halaman UI dan API internal.
   - `requireActiveSession()` di [src/lib/api-auth.ts](file:///Users/battana/Documents/Project/project-management/src/lib/api-auth.ts) memastikan token valid **dan** akun user masih `isActive === true` di database.
   - **Role & Permission Granular:**
     - `Admin`: akses penuh termasuk kelola User, Master Data, SLA Policy, External API Key, Telegram Webhook, dan Diagnostics.
     - `Staff` + `canManageMaintenance = true`: boleh mengelola Aset, Jadwal Maintenance, Template, Divisi, Lokasi, dan Tipe Aset.
     - `Staff` + `canViewTeamLogs = true`: boleh melihat Support Queue & Daily Logs seluruh tim.
2. **Cron Secret (`Authorization: Bearer <CRON_SECRET>` atau `x-cron-secret`)**:
   - Mengamankan `/api/cron/maintenance` dan `/api/cron/reminders`. *Fail-closed* (`401` jika `CRON_SECRET` kosong).
3. **External API Key (`X-API-Key` atau `Bearer rm_live_...`)**:
   - Mengamankan endpoint ingest tiket eksternal `POST /api/v1/external/tickets`. Key asli hanya muncul sekali saat dibuat; database hanya menyimpan hash SHA-256 (`ExternalApiKey.keyHash`).
4. **Telegram Webhook Secret (`x-telegram-bot-api-secret-token`)**:
   - Memverifikasi request masuk ke `POST /api/telegram/webhook` apabila `TELEGRAM_WEBHOOK_SECRET` dikonfigurasi (wajib diisi di production).

---

## 5. Ringkasan Endpoint API (58 Route)

- **Auth & User:** `/api/auth/login`, `/api/auth/logout`, `/api/auth/session`, `/api/users`, `/api/users/[id]`, `/api/users/profile`, `/api/users/presence`
- **Projects, Tasks & TimeLogs:** `/api/projects`, `/api/projects/[id]`, `/api/tasks`, `/api/tasks/[id]`, `/api/tasks/reorder`, `/api/tasks/[id]/remind`, `/api/timelogs`, `/api/timelogs/[id]`
- **Support Queue & Collaboration:** `/api/support`, `/api/support/[id]`, `/api/support/[id]/promote`, `/api/support/[id]/remind`, `/api/comments`, `/api/comments/read`, `/api/notifications`, `/api/notifications/[id]`
- **Assets, QR & Maintenance:** `/api/assets`, `/api/assets/[id]`, `/api/assets/[id]/qr`, `/api/assets/import`, `/api/assets/qr-printed`, `/api/maintenance-templates`, `/api/maintenance-templates/[id]`, `/api/maintenance-templates/[id]/duplicate`, `/api/maintenance-schedules`, `/api/maintenance-schedules/[id]`, `/api/maintenance-schedules/[id]/remind`, `/api/maintenance-logs`
- **Master Data (Admin):** `/api/divisions`, `/api/divisions/[id]`, `/api/locations`, `/api/locations/[id]`, `/api/asset-types`, `/api/asset-types/[id]`, `/api/regional-areas`, `/api/regional-areas/[id]`, `/api/support-modules`, `/api/support-modules/[id]`, `/api/support-categories`, `/api/support-categories/[id]`, `/api/sla-policies`
- **Integrations, Storage & External API:** `/api/upload`, `/api/files/[...key]`, `/api/external-keys`, `/api/external-keys/[id]`, `/api/v1/external/tickets`, `/api/settings/integrations`, `/api/telegram/set-webhook`, `/api/telegram/webhook`, `/api/cron/maintenance`, `/api/cron/reminders`

---

## 6. Perilaku Notifikasi Telegram & Cron

Untuk menghindari kebisingan di grup Telegram:
- **Event Harian Tidak Broadcast ke Grup:** membuat task baru, menyelesaikan task/tiket, mengubah tiket jadi Urgent, atau membuat follow-up tiket maintenance **tidak** mengirim pesan ke grup Telegram (tetap tercatat sebagai notifikasi in-app di web).
- **Otomatis Hanya untuk Item Mendekati Overdue / Overdue (Sampai Selesai):**
  - `GET /api/cron/reminders` (jadwal default: Senin–Jumat `08:00 WITA`): memeriksa Project Task aktif yang jatuh tempo `<= 24 jam` atau sudah lewat `endDate`, serta Support `REQUEST` aktif yang berstatus SLA `AT_RISK` atau `BREACHED` ([cron-helpers.ts](file:///Users/battana/Documents/Project/project-management/src/lib/cron-helpers.ts)). Mengirim 1 rekap grup + DM pribadi bagi user yang punya `telegramChatId`. Berhenti otomatis begitu status selesai.
  - `GET /api/cron/maintenance` (jadwal default: harian `07:30 WITA`): memeriksa jadwal maintenance non-`DONE` yang mendekati jatuh tempo (`DUE`) atau lewat (`OVERDUE`), mengirim 1 pesan per jadwal per hari (dicegah duplikasi harian via `lastRemindedAt`) sampai status menjadi `DONE`.
- **Manual Trigger & Bot Interaktif Tetap Aktif:** tombol *Remind via Telegram* di detail Task, Support Ticket (dilengkapi tombol inline `✅ Tandai Selesai`), Maintenance Schedule, tombol *Test Bot Message* & *Run Cron* di Settings, serta command `/start` untuk cek Chat ID user.

---

## 7. Panduan Cepat Developer Lokal

```bash
# 1. Install dependencies & approve Prisma scripts bila diminta npm
npm install

# 2. Jalankan PostgreSQL 17 lokal & salin env
docker compose up -d
cp .env.example .env   # Sesuaikan DATABASE_URL & JWT_SECRET lokal

# 3. Generate Prisma client, push schema, dan seed data
npx prisma generate
npx prisma db push
node prisma/seed.js
node prisma/seed-maintenance.js

# 4. Jalankan verifikasi & dev server
npm test               # 7 suites, 31 tests
npm run lint           # ESLint
npx tsc --noEmit       # TypeScript check
npm run dev            # http://localhost:3001
```
