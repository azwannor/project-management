# Implementation & Multi-Tenant VPS Deployment Plan — IT Tracker v2

**Target Stack:** Next.js 16 (App Router, `output: "standalone"`), React 19, TypeScript, Tailwind CSS v4, Prisma + PostgreSQL 17, MinIO (S3-compatible), Recharts, `qrcode` (SVG), `xlsx`, Telegram Bot API.  
**Target Hosting:** Shared Hostinger VPS (`187.77.139.23`) bersama co-tenant produksi (`DOIKU`, `Royal Oriental POS`, `Maningo Platform`).

---

## 1. Multi-Tenant VPS Architecture & Hard Rules

Mengikuti standar baku isolasi dari `VPS-DEPLOYMENT-RULES.md`, IT Tracker v2 menjadi **tenant ke-4** pada VPS `187.77.139.23` dengan aturan isolasi ketat:

| No | Sistem / Tenant | Domain Produksi | Docker Prefix & Project |
| :--- | :--- | :--- | :--- |
| 1 | DOIKU | `https://doiku.maningo.id` | `doiku-*` (`-p doiku`) |
| 2 | Royal Oriental POS | `https://kopitiam.royalmedicalink.id` | `royal-oriental-*` |
| 3 | Maningo Platform | `https://app.maningo.id` | `maningo-*` |
| 4 | **IT Tracker v2 (Baru)** | **`https://projectmng.royalmedicalink.id`** | **`ittracker-*` (`-p ittracker`)** |

### 6 Aturan Wajib Deployment IT Tracker
1. **Prefix Unik `ittracker-*`:** Seluruh container dan service wajib diawali `ittracker-` (`ittracker-app`, `ittracker-postgres`, `ittracker-minio`, `ittracker-cron`). Dilarang keras memakai nama generik (`app`, `web`, `db`, `postgres`, `minio`) untuk mencegah **DNS Collision** pada network `caddy_shared`.
2. **Isolasi Project Compose (`-p ittracker`):** Seluruh perintah di VPS (`/opt/ittracker`) wajib memakai:
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml -p ittracker <command>
   ```
   Dilarang menjalankan `docker compose down` global tanpa target spesifik.
3. **Zero Host Port Binding di Produksi:**
   - `ittracker-postgres` (5432) dan `ittracker-minio` (9000/9001) **TIDAK BOLEH** di-bind ke port host VPS.
   - Hanya `ittracker-app` yang bergabung ke external network `caddy_shared` (ekspos internal port `3000` untuk reverse proxy Caddy `royal-oriental-caddy-1`).
   - Database, MinIO, dan Cron berkomunikasi eksklusif di network private `ittracker_internal`.
4. **Zero-Downtime Database & Storage saat Deploy:**
   - Skrip `/opt/ittracker/scripts/deploy-vps.sh` hanya me-rebuild dan merestart `ittracker-app` (plus menjalankan `prisma migrate deploy` secara aman sebelum/saat startup):
     ```bash
     docker compose --env-file .env.production -f docker-compose.prod.yml -p ittracker build ittracker-app
     docker compose --env-file .env.production -f docker-compose.prod.yml -p ittracker up -d --no-deps ittracker-app
     ```
   - `ittracker-postgres` dan `ittracker-minio` tetap menyala tanpa gangguan; container co-tenant lain tidak tersentuh.
5. **Larangan Pruning Destruktif:**
   - Dilarang keras menjalankan `docker system prune -a --volumes` atau `docker volume prune -f`.
   - Hanya diizinkan: `docker builder prune -f --filter 'until=24h'`.
6. **Quad Healthcheck Otomatis (CI/CD):**
   - Pipeline `.github/workflows/deploy.yml` wajib memverifikasi **keempat domain** setelah setiap deploy:
     ```bash
     curl -sSf -I https://projectmng.royalmedicalink.id/login
     curl -sSf -I https://doiku.maningo.id/login
     curl -sSf -I https://kopitiam.royalmedicalink.id/login
     curl -sSf -I https://app.maningo.id
     ```

### Internal Cron Scheduler (`ittracker-cron`)
Karena berpindah dari Vercel (`vercel.json` tidak dipakai lagi), container ringan `ittracker-cron` (Alpine + `supercronic` atau `crond`) di dalam network `ittracker_internal` mengeksekusi jadwal secara deterministik menggunakan `x-cron-secret`:
- **08:00 WITA (Senin–Jumat):** `GET http://ittracker-app:3000/api/cron/reminders` (Overdue Tasks & Support SLA Breaches + Telegram Group & DM).
- **07:30 WITA (Setiap Hari):** `GET http://ittracker-app:3000/api/cron/maintenance` (Status `UPCOMING → DUE → OVERDUE`, Maintenance Reminder H-7/H-3/H-1/H-0, Overdue alert + Telegram DM).

### Caddy Reverse Proxy Entry (ditambahkan ke Caddyfile `royal-oriental-caddy-1`)
```caddyfile
projectmng.royalmedicalink.id {
    reverse_proxy ittracker-app:3000
}
```

---

## 2. Application Technical Architecture

- **Next.js 16 Conventions:**
  - Mengganti `src/middleware.ts` (deprecated di Next.js 16) menjadi **`src/proxy.ts`** dengan proteksi penuh seluruh rute termasuk `/maintenance` dan `/assets` (mengecualikan `/login`, `/assets/q/*`, `/api/telegram/webhook`, `/api/v1/external/*`, `/api/cron/*`).
  - `output: "standalone"` di `next.config.ts` untuk image Docker produksi yang kecil dan cepat di-build.
- **Storage Service (`src/lib/storage.ts`):**
  - Wrapper S3-compatible (`@aws-sdk/client-s3`) yang mengarah ke `ittracker-minio:9000` (bucket `ittracker-files`).
  - Endpoint proxy terautentikasi `GET /api/files/[...key]` sehingga bucket MinIO tetap private di internal network tanpa perlu dibuka ke publik.
- **Internationalization (`EN` Default + `ID` Toggle):**
  - Dictionary terstruktur (`src/i18n/en.ts` & `src/i18n/id.ts`) + React Context + cookie `locale` (`en` / `id`) + sync ke `User.preferredLocale` — zero flicker pada SSR dan switching instan.
- **PWA & Responsive Shell:**
  - `src/app/manifest.ts` (Web App Manifest dengan nama `Royal Medica IT Tracker`, `display: "standalone"`, `theme_color: "#3B74B8"`, `background_color: "#F8FAFC"`, ikon `192×192` & `512×512` dari crown Royal Medica).
  - Service Worker ringan (`public/sw.js`) untuk shell caching & shortcut install di iOS/Android, plus komponen **Mobile PWA Bottom Navigation Bar** (`md:hidden`) dan **Tablet Icon Rail** (`md:flex lg:w-60`).
- **Dual Theme (`Light` / `Dark`):**
  - CSS variables di `globals.css` (`:root` dan `.dark`) + class toggle pada `<html>` tanpa flash saat reload + sync ke `User.preferredTheme`.
- **QR Code Engine (`src/lib/qr.ts`):**
  - Menggunakan library `qrcode` (generate pure SVG string server/client-side) + CSS `@media print` presisi milimeter (`@page { size: 50mm 30mm; margin: 0; }` untuk thermal, dan `@page { size: A4; margin: 10mm; }` untuk A4 grid 24 stiker).

---

## 3. Phased Development Roadmap

### Phase 0 — Specification & FigCraft UI Design (Current Stage)
- [x] Deep audit codebase v1 & verifikasi 1:1 DB lokal vs Supabase produksi.
- [x] Finalisasi 4 dokumen: `PRD.md`, `DATABASE_DESIGN.md`, `BRAND_GUIDELINES.md`, `IMPLEMENTATION_PLAN.md`.
- [ ] **Desain seluruh 8 screen utama di FigCraft** (Light & Dark mode, mengikuti `BRAND_GUIDELINES.md`, zero AI slop).
- [ ] Review & sign-off desain UI bersama user sebelum penulisan kode UI dimulai.

### Phase 1 — Foundation, Database Schema, Migration & Core Shell
- Setup `docker-compose.yml` lokal lengkap (Postgres 17 + MinIO lokal) & `docker-compose.prod.yml` + `Dockerfile` standalone.
- Implementasi Prisma schema v2 (`DATABASE_DESIGN.md`) + `src/proxy.ts` + Auth JWT rolling session + RBAC (`canViewTeamLogs`, `canManageMaintenance`).
- Implementasi skrip migrasi idempoten `scripts/migrate-v1-to-v2.ts` (migrasi 100% 18 tabel + ekstraksi Base64 → MinIO) dan verifikasi integritas data di lokal.
- Bangun Design System tokens (`globals.css`, `Montserrat`/`Inter`/`JetBrains Mono`), App Shell (`Sidebar`, `TopBar` dengan toggle `EN/ID` & `Light/Dark`, `NotificationBell`, `ActiveUsers`).

### Phase 2 — Executive Overview & Boardroom KPI (`/dashboard`)
- Engine kalkulasi KPI nyata (Project On-Time Rate, Support SLA Compliance & MTTR, Maintenance Compliance, Asset Health, Team Performance Matrix).
- **Master Project Roadmap (Executive Timeline)** dengan penanda `TODAY` & expandable main tasks.
- **Boardroom / Presentation Mode** (1-klik clean full-screen) + Export Executive Report `.xlsx` & Print PDF.

### Phase 3 — Project Management & Hybrid Time Tracking (`/projects`)
- Project Portfolio CRUD (relasi `ProjectMember`).
- Task Workspace: Table View (hierarki, drag-drop cycle-safe, inline edit), Kanban Board, Timeline/Gantt View.
- Hybrid `TimeLog` engine (otomatis start/stop saat status berubah + manual edit/override + focus timer opsional).
- Comments Drawer dengan unread indicator & Lampiran MinIO.

### Phase 4 — Support Queue, Daily Logs & External Report Readiness (`/support`)
- Pemisahan tab **Support Queue (`REQUEST`)** dengan Dynamic SLA Countdown & **Daily Activity (`DAILY_ACTIVITY`)** dengan My/Team Logs.
- Auto-assign `Master Data` by Regional Area dari Master Data DB.
- Promote Support Request → Project Task.
- Telegram Bot notifications + Webhook Quick-Resolve (`/api/telegram/webhook`) + `/start` Chat ID helper.
- Implementasi fondasi API eksternal `POST /api/v1/external/tickets` (`X-API-Key`) + UI manajemen API Key untuk rencana tombol *"Report Problem"*.

### Phase 5 — Asset Registry, QR Print Studio & Preventive Maintenance (`/assets` & `/maintenance`)
- Asset Registry CRUD + `AssetCustodyLog` otomatis + Warranty expiry alerts + Bulk Import Excel/CSV yang sudah 100% sinkron.
- **QR Print Studio**: Single & Batch Print Preview untuk Thermal (`50×30mm`, `60×40mm`) & A4 Grid (24/sheet) dengan logo Royal Medica.
- **Mobile Field Scan (`/assets/q/[assetCode]`)**: Public basic view + Authenticated IT quick actions (*Execute Maintenance* / *Create Support Ticket*).
- Preventive Maintenance: Templates (18 migrated), Schedules (Single + Bulk Generator), Mobile Tap-to-Check Execution Log dengan Immutable Snapshot, Auto-Next Cycle, dan **Auto-Create Linked Support Ticket** saat `BERMASALAH` / `followUpNeeded`.

### Phase 6 — Settings, QA, Automated Tests & Hostinger VPS Cutover
- Settings & Dynamic Master Data Manager (`Divisions`, `Locations`, `Regional Areas`, `Asset Types`, `Support Modules/Categories`, `SLA Policies`).
- Perbarui & perluas automated tests (`__tests__/`): SLA calculation, Hybrid TimeLog, Maintenance snapshot + auto-next cycle + auto-create support ticket, migration integrity check.
- **Cutover Produksi ke Hostinger VPS (`187.77.139.23`):**
  1. Setup `/opt/ittracker`, `.env.production`, `docker-compose.prod.yml`, `ittracker-postgres`, `ittracker-minio`, `ittracker-cron`.
  2. Ambil **final freeze dump** terbaru dari Supabase produksi (agar nol transaksi tertinggal selama masa rebuild!).
  3. Jalankan `scripts/migrate-v1-to-v2.ts` ke `ittracker-postgres` & `ittracker-minio` + verifikasi row count 1:1.
  4. Tambahkan entry `projectmng.royalmedicalink.id` ke Caddyfile `royal-oriental-caddy-1` dan reload Caddy tanpa downtime.
  5. Arahkan DNS `projectmng.royalmedicalink.id` ke IP VPS `187.77.139.23` (SSL otomatis dari Caddy).
  6. Daftarkan ulang Telegram Webhook (`/api/telegram/set-webhook`) ke host baru & aktifkan CI/CD `.github/workflows/deploy.yml` dengan **Quad Healthcheck**.
  7. Pastikan Supabase & Vercel lama tetap utuh sebagai *cold rollback* selama 7 hari pertama setelah cutover berhasil.
