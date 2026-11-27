# Royal Medica IT Tracker

Internal IT Operations Command Center for **PT. Royal Medicalink Pharmalab** — covering Executive KPI Overview & Boardroom Mode (`/dashboard`), Project & Task Management with Hybrid Time Tracking (`/projects`), SLA-driven Support Queue & Daily Activity Logs (`/support`), Enterprise Asset Inventory with QR Print Studio & Preventive Maintenance (`/maintenance`, `/assets/q/[code]`), Dynamic Master Data, External Ticket Ingestion API, and Telegram Cron Alerts (`/settings`).

## Dokumentasi Lengkap (Baca Mulai dari Sini)

| Dokumen | Kegunaan | Target Pembaca |
| :--- | :--- | :--- |
| [**docs/PROJECT_OVERVIEW.md**](docs/PROJECT_OVERVIEW.md) | Penjelasan lengkap arsitektur, modul, API (58 routes), RBAC, Telegram Cron, & dev workflow | Tim Developer & Infra |
| [**docs/GCP_DEPLOYMENT_GUIDE.md**](docs/GCP_DEPLOYMENT_GUIDE.md) | Syarat wajib production, konfigurasi Docker GCP (`127.0.0.1:3100`), Nginx/SSL, Hostinger DNS, & hasil audit keamanan | Tim Infrastruktur / DevOps |
| [**.env.example**](.env.example) | Template environment variables untuk lokal dan `.env.production` | Tim Infrastruktur & Developer |
| [**docker/docker-compose.gcp.yml**](docker/docker-compose.gcp.yml) | Stack Docker siap pakai untuk VM GCP bersama reverse proxy Nginx host | Tim Infrastruktur |
| [**docs/PRD.md**](docs/PRD.md) | Product Requirements Document | Product & Engineering |
| [**docs/DATABASE_DESIGN.md**](docs/DATABASE_DESIGN.md) | ERD & detail desain skema database PostgreSQL | Developer & DBA |
| [**docs/BRAND_GUIDELINES.md**](docs/BRAND_GUIDELINES.md) | Sistem desain Light/Dark, tipografi, & standar komponen | Frontend Developer |
| [**docs/FIGCRAFT_GUIDE.md**](docs/FIGCRAFT_GUIDE.md) | Panduan workflow desain `.figcraft` & Design-to-Dev Handoff | UI Designer & Agent |

## Repository Structure

```text
├── docker/                 # Dockerfile standalone, docker-compose.gcp.yml, crontab
├── design/                 # FigCraft design system & all screen specs (00–06)
├── docs/                   # Dokumentasi arsitektur, GCP deploy guide, PRD, DB, Brand
├── prisma/                 # Schema Prisma (PostgreSQL 17) & seeders
├── public/brand/           # Runtime logos, PWA icons & favicons
├── scripts/                # Skrip rollout VPS & migrasi v1 -> v2
├── src/
│   ├── app/                # Next.js 16 App Router pages & 58 API route handlers
│   ├── components/         # Layout shell, theme/i18n providers, UI primitives & views
│   ├── i18n/               # Kamus bilingual EN / ID
│   ├── lib/                # Prisma, JWT auth, KPI engine, SLA, QR, storage, cron, telegram
│   └── proxy.ts            # Next.js 16 route auth proxy
└── __tests__/              # Jest automated tests (7 suites, 31 tests)
```

## Quick Verification & Local Development

Lihat [AGENTS.md](AGENTS.md) untuk setup PostgreSQL Docker lokal atau ikuti ringkasan di [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md):

```bash
npm install
docker compose up -d
npx prisma generate && npx prisma db push
npm test && npm run lint && npm run build:docker
npm run dev   # http://localhost:3001
```
