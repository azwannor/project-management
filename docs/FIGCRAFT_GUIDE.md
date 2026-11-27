# Panduan Kerja FigCraft (Design-to-Dev Handoff Guide)

Dokumen ini menjelaskan cara kerja **FigCraft** (`/Applications/FigCraft.app`) bersama AI Agent dari tahap diskusi kebutuhan sampai menghasilkan desain `.figcraft` yang siap pakai dan mudah diterjemahkan menjadi UI kode secara detail dan konsisten.

> **Catatan Sistem Antigravity:** Skill global `figcraft-design` sudah terpasang di `~/.gemini/config/skills/figcraft-design/SKILL.md` (beserta `scripts/figcraft_builder.py`, `scripts/render_figcraft_preview.py`, dan `references/figcraft-schema.md`). Saat Anda memulai project baru di mesin ini, agent otomatis menemukan skill tersebut tanpa perlu salin ulang secara manual.

---

## 1. Cara Kerja FigCraft Secara Teknis
Berbeda dengan Figma yang memiliki MCP server, **FigCraft (`FigCraft.app`) tidak memiliki CLI/MCP write API bawaan**. Format filenya adalah arsip **ZIP** berekstensi `.figcraft` (`ai.storyteller.figcraft.document`) yang berisi:

- `document.json` — struktur lengkap (`format: "figcraft"`, `version: 1`) berisi `pages`, `nodes` (`page`, `frame`, `text`, `ellipse`, `line`, `rectangle`), `layout` / `child_layout` (auto-layout), `corners`, `fills`, `strokes`, `effects`, dan `imageIndex`.
- `images/<sha256>` — asset PNG ter-embed yang di-hash SHA-256.

Karena formatnya terbuka (`ZIP + JSON`), agent bekerja melalui 3 langkah utama:
1. **Generate `.figcraft` secara programatik** dengan Python builder (`figcraft_builder.py`) per halaman & tema.
2. **Render preview PNG** (`render_figcraft_preview.py`) lalu periksa visualnya sendiri (mencegah teks terpotong, elemen bertumpuk, kontras lemah).
3. **Buka file `.figcraft` langsung di `FigCraft.app`** agar Anda bisa meninjau/mengedit di desktop Mac sebelum masuk fase development.

---

## 2. Alur Mulai Project Baru dengan FigCraft

### Tahap 1 — Diskusi Kebutuhan & Penguncian Fondasi Visual
Sebelum membuat satu layar pun, pastikan agent memproduksi/mengunci:
1. **PRD (`docs/PRD.md`)**: daftar modul, role user, alur CRUD, form, drawer, modal konfirmasi, filter, serta state kosong/error/loading.
2. **Brand Guidelines (`docs/BRAND_GUIDELINES.md`)**:
   - Token warna **Light Mode** & **Dark Mode** (canvas, surface, subtle, border, brand, ink, status ok/warn/err — dalam hex exact).
   - Skala tipografi (font family terinstal di Mac, ukuran, line-height, letter-spacing, tabular numbers `tnum`).
   - Standar komponen interaktif (mis. melarang `<input type="date">`, `<input type="time">`, atau `<select>` bawaan OS jika memakai komponen portal custom).
   - Breakpoint target standar: **Desktop (`1440px`)**, **Tablet (`834px`)**, **Mobile (`390px`)**.

### Tahap 2 — Struktur Folder & Skrip Desain
Minta agent memisahkan builder per halaman di `design/scripts/` (jangan menumpuk semua layar di satu file):

```text
project-root/
├── design/
│   ├── <Nama_Project>.figcraft          # Output final yang dibuka di FigCraft.app
│   └── scripts/
│       ├── theme_tokens.py              # Palet Light/Dark + komponen shell bersama (Navbar, Sidebar, Rail, Bottom Nav, Badge)
│       ├── page_00_foundations.py       # Page 00.1 Brand/Logo, 00.2 Color/Type/Grid, 00.3 UI Kit & Components
│       ├── page_01_login.py             # Layar Login + state error
│       ├── page_02_<modul>.py           # dst, satu modul satu file
│       └── build_all.py                 # Menggabungkan semua page → design/<Nama_Project>.figcraft
```

### Tahap 3 — Aturan Pembuatan Artboard Agar Rapi
- Gunakan **Auto-Layout** (`layout="horizontal" | "vertical"`, `padding`, `gap`, `sizing_h/v="hug" | "fill" | "fixed"`) dan panggil `save()` agar `solve_all_layouts()` menghitung koordinat tanpa tabrakan.
- Gunakan font yang terpasang di `/Users/battana/Library/Fonts/` dan ukur lebar teks dengan `measure_text(...)` agar label tombol/badge/tab tidak pernah terpotong.
- Setiap page fitur idealnya memuat **6 varian artboard utama** + artboard tambahan untuk **Modal / Drawer / Filter / State**:
  - Desktop `1440px` (**Light** & **Dark**)
  - Tablet `834px` (**Light** & **Dark**)
  - Mobile `390px` (**Light** & **Dark**)

### Tahap 4 — Render Preview & Buka di `FigCraft.app`
```bash
# 1. Render PNG semua artboard untuk inspeksi visual agent
python3 ~/.gemini/config/skills/figcraft-design/scripts/render_figcraft_preview.py \
  design/<Nama_Project>.figcraft /tmp/figcraft_previews

# 2. Buka langsung di FigCraft.app
open -a FigCraft design/<Nama_Project>.figcraft

# (Jika FigCraft.app sudah membuka file lain dan tidak berpindah tab/window)
/Applications/FigCraft.app/Contents/MacOS/FigCraft "$(pwd)/design/<Nama_Project>.figcraft"
```

---

## 3. Daftar Output Wajib Sebelum Masuk Fase Development

Agar agent coding (atau developer) langsung dapat mengimplementasikan UI secara presisi tanpa menebak-nebak, fase desain FigCraft dianggap **selesai** hanya jika output berikut sudah lengkap:

| # | Output | Lokasi | Isi Minimal untuk Mempermudah Development |
| :--- | :--- | :--- | :--- |
| 1 | **Dokumen `.figcraft` Lengkap** | `design/<Nama_Project>.figcraft` | Page `00` (Brand, Color Tokens, Typography, Grid, UI Kit lengkap termasuk input/select/datepicker/timepicker/drawer/modal) + Page `01..NN` setiap fitur dengan Desktop `1440`, Tablet `834`, Mobile `390`, Light & Dark, serta Modal/Drawer/State penting. |
| 2 | **Brand & Token Spec** | `docs/BRAND_GUIDELINES.md` | Tabel hex exact Light & Dark siap salin ke CSS variables / Tailwind `@theme`, font scale, radius, border, shadow, aturan bahasa (`EN / ID`), dan daftar komponen terlarang/wajib. |
| 3 | **Screen-to-Route Mapping** | `docs/IMPLEMENTATION_PLAN.md` | Pemetaan 1-ke-1 antara nama page/artboard di `.figcraft` dengan route aplikasi (mis. `02 · Executive Overview` → `/dashboard`), daftar modal/drawer terkait, dan acceptance criteria tiap fase. |
| 4 | **Skrip Modular `.figcraft`** | `design/scripts/` | Skrip Python pembuat artboard sehingga revisi desain dari feedback Anda cepat diterapkan ulang dan terstruktur. |
| 5 | **Preview PNG Terverifikasi** | Folder preview / artifact | Semua artboard sudah dirender dan dicek bebas overlap, bebas teks terpotong, dan kontras Light/Dark terjaga. |

---

## 4. Cara Agent Membaca `.figcraft` Saat Fase Coding (Development)

Saat fase coding dimulai untuk suatu modul (misalnya Phase 4 atau Phase 5), agent **tidak perlu menebak** ukuran, warna, padding, gap, atau isi komponen dari ingatan:

1. **Inspeksi `document.json` dari arsip `.figcraft`** memakai Python (`zipfile` + `json`) untuk membaca exact value:
   - Warna `fills[0].color`, `strokes[0].color`, `stroke.weight`
   - Sudut `corners.radii` dan efek `effects` (`dropShadow`)
   - Jarak auto-layout `layout.gap` & `layout.padding` (`[top, right, bottom, left]`)
   - Tipografi `style.font_family`, `font_style`, `font_size`, `line_height`, `letter_spacing`
2. **Bandingkan implementasi live di browser** pada `1440x900` (Desktop), `834x1024` (Tablet), dan `390x844` (Mobile) dalam mode Light & Dark agar hasil kode benar-benar paritas dengan desain FigCraft.

---

## 5. Prompt Template Untuk Project Baru

Saat memulai project baru nanti, cukup kirim instruksi seperti ini ke agent:

> "Gunakan skill `figcraft-design` dan baca `docs/BRAND_GUIDELINES.md` / `docs/PRD.md`. Rancang UI lengkap di `design/<Nama_Project>.figcraft` dengan skrip modular di `design/scripts/`. Pastikan setiap fitur memiliki artboard Desktop `1440px`, Tablet `834px`, dan Mobile `390px` (Light & Dark) plus modal, drawer, dan state penting. Render preview PNG untuk cek overlap/teks terpotong, lalu buka hasilnya di `FigCraft.app` dan lengkapi tabel pemetaan screen-to-route di `docs/IMPLEMENTATION_PLAN.md`."
