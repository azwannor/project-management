# Brand & UI Design Guidelines — IT Tracker v2

**Design Archetype:** Architectural Engineering + Tactile Glass  
**Visual Reference:** `https://battana.maningo.id/` (Architectural CAD Precision, Dual-Theme Obsidian/Paper, Crisp Monospace Telemetry, Zero AI Slop)  
**Brand Source:** `asset/Logo/logo royal medica.png` (PT. Royal Medicalink Pharmalab)

---

## 1. Brand Identity & Color Translation

Logo **PT. Royal Medicalink Pharmalab** terdiri dari tiga elemen warna:
- **Crown Blue (`#0068B3`)** — terlalu jenuh untuk antarmuka kerja harian → **diperhalus (*softened*) menjadi Soft Royal Cerulean / Luminous Sky Blue** agar tenang di mata saat operasional panjang namun tetap membawa identitas Royal Medica.
- **Royal Navy (`#242466`)** — diterjemahkan menjadi aksen ink gelap (`#1E2A4A`) dan basis permukaan gelap obsidian-navy di Dark Mode.
- **Medical Crimson (`#D92727`)** — **tidak dipakai sebagai warna dekoratif**, melainkan dikunci ketat sebagai warna sinyal kritis (`URGENT`, `OVERDUE`, `SLA Breach`, `BERMASALAH`, aksi hapus).

---

## 2. Strict Anti-AI-Slop Manifesto

Seluruh desain di FigCraft maupun kode React **wajib mematuhi 7 aturan ini tanpa pengecualian**:

1. **Zero Redundant Subtitles:** Jangan pernah menaruh kalimat penjelasan generik di bawah judul halaman atau judul card (contoh terlarang: *"Kelola dan pantau seluruh aset perusahaan Anda secara efisien di sini"*). Cukup judul tegas + telemetry counter/pill nyata (contoh: `Assets` + `17 ACTIVE`).
2. **No Rainbow Icon Boxes:** Dilarang memberi kotak background warna-warni berbeda pada setiap ikon KPI (biru, ungu, hijau, oranye). Ikon menggunakan monokrom slate atau satu warna aksen lembut yang konsisten.
3. **No Nested Cards-in-Cards:** Hindari menumpuk card di dalam card dengan bayangan berlapis. Pisahkan informasi menggunakan **`1px` hairline divider** dan ruang kosong (*whitespace*).
4. **Restrained Single-Hue Brand Accent:** 90% antarmuka adalah netral (*paper/slate* di Light Mode, *obsidian/navy-slate* di Dark Mode), 8% Soft Royal Blue untuk fokus/interaksi aktif, dan maksimal 2% warna semantik (Crimson/Emerald/Amber) hanya untuk status data nyata.
5. **Engineering-Authentic Telemetry:** Tampilkan data presisi yang memang dicari IT Manager & teknisi (`RMP-JKT-LPT-001`, `SLA 01h 42m`, `87.5% ON-TIME`, `Q4 · 2026`, `WITA UTC+8`), bukan copy marketing kosong.
6. **Tabular Numerals Everywhere:** Seluruh angka KPI, durasi, persentase, dan tanggal menggunakan `font-variant-numeric: tabular-nums` agar kolom sejajar sempurna saat dilihat manajemen.
7. **Tactile Effects Used Sparingly:** Efek glassmorphism tipis (`.nimbus-glass`) hanya pada Top Bar / Floating Controls, dan `.liquid-metal-border` hanya pada 1–2 focal elements (misal Executive Spotlight / Boardroom Header / QR Sticker Preview), tidak pernah di-spam ke setiap card tabel.

---

## 3. Dual-Theme Color Token System

### Light Mode (Default Operational Canvas)
| Token | Hex / Value | Usage |
| :--- | :--- | :--- |
| `--bg-canvas` | `#F8FAFC` | Latar utama aplikasi |
| `--surface-card` | `#FFFFFF` | Card, tabel, modal, sidebar |
| `--surface-subtle` | `#F1F5F9` | Header tabel, input background, hover row |
| `--surface-glass` | `rgba(255, 255, 255, 0.78)` | Top navigation & floating bars (`backdrop-blur-md`) |
| `--border-hairline` | `#E2E8F0` | Garis pemisah 1px standar |
| `--border-strong` | `#CBD5E1` | Hover border & input focus base |
| `--brand-primary` | `#3B74B8` | **Soft Royal Blue** — CTA utama, active tab, link aktif |
| `--brand-primary-hover` | `#31639E` | Hover CTA utama |
| `--brand-tint` | `#EEF5FC` | Active menu background, highlight row |
| `--brand-border` | `#C6DCF5` | Border active badge / active highlight |
| `--brand-navy` | `#1E2A4A` | Deep accent untuk logo lockup & emphasis |
| `--ink-primary` | `#0F172A` | Heading, angka KPI, teks utama |
| `--ink-secondary` | `#475569` | Label tabel, metadata, body teks |
| `--ink-muted` | `#94A3B8` | Placeholder, timestamp, separator |

### Dark Mode (Soft Charcoal Slate — Calm Night Ops & Boardroom)
Menghindari hitam pekat (`#000`/`#060B11`) dan warna neon yang menyilaukan; menggunakan **Soft Charcoal Slate** yang hangat dan palet **Pastel-Muted** ber-kontras nyaman:
| Token | Hex / Value | Usage |
| :--- | :--- | :--- |
| `--bg-canvas` | `#161A26` | Soft Deep Slate — App canvas |
| `--surface-card` | `#212636` | Warm Charcoal Navy — Card & table surface |
| `--surface-subtle` | `#2A3044` | Header tabel, input, hover state |
| `--surface-glass` | `rgba(33, 38, 54, 0.84)` | Top navigation & floating bars (`backdrop-blur-md`) |
| `--border-hairline` | `#313850` | Garis pemisah tipis ber-kontras rendah |
| `--border-strong` | `#3E4764` | Hover border |
| `--brand-primary` | `#82ACE6` | **Soft Periwinkle Royal Blue** — CTA solid (teks `#161A26`), active accent |
| `--brand-primary-hover` | `#96BAEB` | Hover CTA utama |
| `--brand-tint` | `#27334C` | Active surface tint |
| `--brand-border` | `#3B4C6E` | Accent border |
| `--ink-primary` | `#EEF1F7` | Soft off-white untuk heading & KPI utama |
| `--ink-secondary` | `#A7B0C4` | Body & secondary data |
| `--ink-muted` | `#747E96` | Placeholder & subtle metadata |

### Semantic Status Tokens (Light / Soft Dark)
| Meaning | Light Ink / Bg / Border | Dark Ink / Bg / Border |
| :--- | :--- | :--- |
| **Critical / Urgent / Overdue / Bermasalah** | `#C93B3B` / `#FEF2F2` / `#FECACA` | `#E07E7E` / `#362328` / `#57353C` |
| **Success / Done / On Track / Baik** | `#148561` / `#ECFDF5` / `#A7F3D0` | `#7CC7A4` / `#1F332E` / `#2E4D44` |
| **Warning / Due / At Risk / Perlu Perhatian** | `#B86E14` / `#FFFBEB` / `#FDE68A` | `#E5B88B` / `#342C24` / `#524334` |
| **Info / Ongoing / Upcoming** | `#3B74B8` / `#EEF5FC` / `#C6DCF5` | `#82ACE6` / `#27334C` / `#3B4C6E` |
| **Secondary Series (Timeline / Effort)** | `#9A8CD0` (Soft Lavender) | `#A799D8` (Soft Lavender) |

---

## 4. Typography System

Mengadopsi komposisi persis dari `battana.maningo.id`:

| Role | Font Family | Weight | Size / Line-Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display / KPI Metric** | `Montserrat` | `700–800` | `28px–36px` / `1.12` | `-0.025em` | Angka KPI utama, judul halaman |
| **Section Heading** | `Montserrat` | `700` | `16px–20px` / `1.25` | `-0.02em` | Judul panel, modal, nama proyek |
| **UI Body / Table Cell** | `Inter` | `400–600` | `13px–14px` / `1.5` | `0` | Sel tabel, form input, deskripsi |
| **Telemetry / Micro-Label** | `JetBrains Mono` / `Menlo` | `600–700` | `10px–11.5px` / `1.2` | `+0.05em` | `UPPERCASE` — Kode aset (`RMP-JKT-001`), nomor tiket (`SUP-2026-0262`), countdown SLA, status pill, timestamp |

---

## 5. Layout, Surface & Radii Rules

- **Architectural CAD Grid (`.cad-grid-pattern`):**
  - Pola grid `60px × 60px` sangat tipis (`#3B74B8` opacity `4%` di Light Mode, `#6CA6EC` opacity `3.5%` di Dark Mode) digunakan **hanya** pada Login canvas, Header/Hero Executive Boardroom Mode, dan halaman QR Mobile Scan — **tidak dipakai di belakang tabel padat** agar keterbacaan angka tetap maksimal.
- **Border Radius Hierarchy:**
  - Floating pills, primary/secondary buttons, theme/language toggles, status badges: `999px` (`rounded-full`).
  - Bento KPI cards, drawers, modals, QR preview card: `16px–20px`.
  - Inputs, selects, table containers: `10px–12px`.
  - Micro tags (tech/module/area chips): `6px`.
- **Elevation:**
  - Light Mode: Shadow ultra-halus `0 4px 20px rgba(15, 23, 42, 0.03)` + `1px solid #E2E8F0`.
  - Dark Mode: `0 10px 28px rgba(0, 0, 0, 0.35)` + `1px solid #1E293B`.
- **App Shell (3 Responsive Breakpoints + Mobile PWA):**
  - **Desktop (`1024px+` / `1440px`):** Left Sidebar (`240px`, collapsible ke `68px` icon-rail) + Top Utility Bar (`56px`, `.nimbus-glass`).
  - **Tablet (`768–1023px` / `834px`):** Compact Icon Rail (`68px` dengan crown symbol + 5 ikon modul) + 8-column responsive grid + slide-over drawer.
  - **Mobile PWA (`<768px` / `390px`):** Installable PWA standalone viewport (tanpa browser chrome saat di-install), Top Bar ringkas (`56px`), 4-column card layout, dan **Fixed Bottom Navigation Bar (`74px` termasuk safe-area)**: `Overview`, `Projects`, `Support`, `Assets`, `More` dengan ikon + label + pill indikator aktif.

---

## 6. QR Sticker Visual Specification

Didesain presisi seperti label aset industrial/medis modern:
- **Thermal Label (`50mm × 30mm` & `60mm × 40mm`):**
  - Kiri (40%): QR Vector SVG high-contrast (`#000000` di atas `#FFFFFF`, error correction `M`).
  - Kanan (60%): Mini lockup `ROYAL MEDICA · IT ASSET` (monospace `6pt`), garis hairline `0.5pt`, **`assetCode`** (`JetBrains Mono Bold 9pt`), `assetName` (`Inter SemiBold 7.5pt`, max 2 lines), `Location · Division` (`6.5pt`).
- **A4 Sticker Grid (`3 kolom × 8 baris = 24 stiker`):**
  - Margin cetak `10mm`, gutter `4mm`, garis potong tipis (`#CBD5E1` dashed) opsional untuk pemotongan manual.

---

## 7. FigCraft UI Design Scope (Target Tahap 2)

Daftar screen utama yang akan dirancang di **FigCraft** (masing-masing mencakup **Desktop `1440px`**, **Tablet `834px`**, dan **Mobile PWA `390px`**) sebelum masuk fase coding:
1. **Design Tokens & Component Sheet** (Light + Dark palette, Typography, Buttons, Inputs, Badges, Toggles `EN/ID` & `Light/Dark`, Table rows, QR Label preview).
2. **Login Screen** (Light & Dark — CAD grid subtle + Royal Medica lockup).
3. **Executive Overview & Boardroom Mode** (4 Real KPI Cards, Master Project Roadmap Timeline, Team Performance Matrix, Support & Asset Health widgets).
4. **Project Management** (Project Portfolio + Task Table View Hierarki + Kanban View + Timeline/Gantt View + Task Detail Drawer dengan Hybrid TimeLog & Comments).
5. **Support & Operational Logs** (Tab Support Queue dengan SLA badges & External Source badge + Tab Daily Activity + Create/Edit Drawer).
6. **Asset Management, QR Print Studio & Maintenance** (Asset Registry Table + Asset Detail & Custody History + QR Batch Print Preview Modal + Maintenance Schedules & Checklist Templates).
7. **Mobile Field View (`/assets/q/[assetCode]`)** (390px viewport — Scan QR Quick Card + Tap-to-Check Maintenance Form).
8. **Settings & Master Data** (Profile, User & Permissions Matrix, Master Data Manager, Integrations).
