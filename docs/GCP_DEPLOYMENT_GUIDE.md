# Syarat & Panduan Deploy Production ke GCP — IT Tracker

Dokumen ini berisi **daftar persyaratan teknis wajib** dan **SOP langkah demi langkah** bagi tim infrastruktur saat men-deploy **Royal Medica IT Tracker** (`Next.js 16 + PostgreSQL 17 + Prisma + MinIO/Local Storage + Telegram Cron`) ke server **GCP (Google Cloud Platform)** tanpa mengganggu sistem utama yang sudah berjalan.

> Untuk memahami keseluruhan modul, struktur kode, endpoint API, dan arsitektur aplikasi, baca juga [PROJECT_OVERVIEW.md](file:///Users/battana/Documents/Project/project-management/docs/PROJECT_OVERVIEW.md).

---

## 1. Prasyarat Wajib Sebelum Mulai Deploy (Checklist Tim Infra)

Pastikan seluruh syarat berikut terpenuhi agar aplikasi berjalan aman, terisolasi, dan bebas kendala autentikasi:

| # | Syarat | Alasan Teknis / Dampak Jika Terlewat |
| :--- | :--- | :--- |
| 1 | **Gunakan Subdomain Terpisah (`projectmng.royalmedicalink.id`)** | Domain dibeli di Hostinger; mempertahankan subdomain khusus membuat route `/`, `/api/*`, `/login`, `/assets/q/*`, dan webhook Telegram berjalan langsung tanpa perlu refactor `basePath`. |
| 2 | **Reverse Proxy Terminates HTTPS (TLS) + Forward Headers** | Di `NODE_ENV=production`, cookie JWT diset `Secure: true`. Jika traffic ke user tidak HTTPS atau proxy tidak meneruskan `X-Forwarded-Proto: https`, browser akan menolak/menghapus cookie login. |
| 3 | **Upload Limit Proxy Minimal `20 MB`** | Aplikasi mendukung upload bukti/attachment/Excel import s.d. `10 MB` per file; di Nginx wajib pasang `client_max_body_size 20M;` agar upload tidak ditolak `413 Request Entity Too Large`. |
| 4 | **Database PostgreSQL 17 Terisolasi (`it_tracker`)** | Jangan gabung tabel ke DB sistem utama agar schema Prisma (`npx prisma db push`) dan backup/restore tidak saling menimpa. |
| 5 | **Persistent Storage File (`MINIO_*` atau volume `/app/.uploads`)** | Tanpa S3/MinIO maupun mount volume pada `/app/.uploads`, file lampiran, foto profil, dan foto aset akan hilang setiap container di-rebuild. |
| 6 | **Wajib Isi 3 Secret Acak Kuat (`JWT_SECRET`, `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET`)** | • `JWT_SECRET` kosong menyebabkan server melempar error di production.<br>• `CRON_SECRET` wajib agar `ittracker-cron` terotorisasi (`401` jika kosong).<br>• **`TELEGRAM_WEBHOOK_SECRET` wajib** agar `/api/telegram/webhook` tidak bisa dipalsukan pihak luar. |
| 7 | **Buka Port Firewall VPC `80` & `443` + Bind Container ke Localhost (`127.0.0.1:3100:3000`)** | Port `80`/`443` dibutuhkan user, QR scan HP lapangan, serta callback Telegram Bot API. Binding internal `127.0.0.1:3100` mencegah akses HTTP langsung bypass Nginx/SSL dan menghindari bentrok port dengan aplikasi utama. |
| 8 | **Jalankan Scheduler Cron (`ittracker-cron` / Cloud Scheduler)** | Pengingat otomatis Telegram (khusus tugas mendekati overdue/overdue sampai selesai) dipicu oleh `/api/cron/maintenance` (harian `07:30 WITA`) & `/api/cron/reminders` (Senin–Jumat `08:00 WITA`). |

---

## 2. Arsitektur Routing & DNS (Hostinger → Server GCP)

```text
User / HP Scan QR / Telegram API
        │ HTTPS (443)
        ▼
  DNS Hostinger (A Record: projectmng.royalmedicalink.id → IP Publik GCP)
        │
        ▼
  Nginx / Reverse Proxy Server Utama GCP
   ├── Host: <sistem-utama>.royalmedicalink.id  ──▶ Container Sistem Utama (tidak tersentuh)
   └── Host: projectmng.royalmedicalink.id      ──▶ http://127.0.0.1:3100 (ittracker-app)
                                                         ├── ittracker-postgres (PostgreSQL 17)
                                                         ├── ittracker-minio (S3 Storage)
                                                         └── ittracker-cron (Scheduled Alerts)
```

### Pengaturan DNS di Hostinger hPanel
1. Login **Hostinger hPanel → Domains → `royalmedicalink.id` → DNS / Nameservers**.
2. Beberapa jam sebelum cutover, turunkan **TTL** record `projectmng` menjadi **`300`** detik (5 menit).
3. Saat siap cutover: hapus `CNAME` / `A` record lama yang mengarah ke Vercel, lalu buat/ubah **A Record** `projectmng` menuju **IP Publik Statis VM / Load Balancer GCP**.

---

## 3. Konfigurasi Stack & Environment Variables (`.env.production`)

Gunakan file Compose siap pakai khusus GCP di [docker/docker-compose.gcp.yml](file:///Users/battana/Documents/Project/project-management/docker/docker-compose.gcp.yml) (berbeda dengan `docker-compose.prod.yml` yang memakai `caddy_shared`, file `docker-compose.gcp.yml` langsung mengekspos `127.0.0.1:3100:3000` untuk Nginx/Load Balancer dan memasang volume persistent untuk DB, MinIO, dan `.uploads`).

Salin [`.env.example`](file:///Users/battana/Documents/Project/project-management/.env.example) ke `.env.production` di root folder deploy (mis. `/opt/ittracker/.env.production`) dan isi seluruh nilai:

```env
# PostgreSQL 17 (sesuaikan dengan user/password/host service compose atau Cloud SQL)
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="<password-postgres-kuat>"
POSTGRES_DB="it_tracker"
DATABASE_URL="postgresql://postgres:<password-postgres-kuat>@ittracker-postgres:5432/it_tracker"
DIRECT_URL="postgresql://postgres:<password-postgres-kuat>@ittracker-postgres:5432/it_tracker"

# Wajib digenerate dengan: openssl rand -hex 32
JWT_SECRET="<64-hex-random>"
CRON_SECRET="<64-hex-random>"
TELEGRAM_WEBHOOK_SECRET="<64-hex-random>"

# URL HTTPS final
NEXT_PUBLIC_APP_URL="https://projectmng.royalmedicalink.id"

# Telegram Bot
TELEGRAM_BOT_TOKEN="<bot-token-dari-botfather>"
TELEGRAM_CHAT_ID="<group-chat-id>"

# MinIO S3 Storage (sesuai service ittracker-minio di docker-compose.gcp.yml)
MINIO_ENDPOINT="http://ittracker-minio:9000"
MINIO_ACCESS_KEY="<minio-user-kuat>"
MINIO_SECRET_KEY="<minio-password-kuat>"
MINIO_BUCKET="ittracker-files"
MINIO_REGION="ap-southeast-2"
```

---

## 4. Urutan Eksekusi Deploy & Cutover oleh Tim Infra

1. **Siapkan Direktori & Environment di VM GCP:**
   - Letakkan source repo (mis. di `/opt/ittracker`), lalu buat `/opt/ittracker/.env.production` dari `.env.example`.
2. **Build & Jalankan Container Stack:**
   ```bash
   cd /opt/ittracker
   docker compose --env-file .env.production -f docker/docker-compose.gcp.yml -p ittracker up -d --build
   ```
   *(Catatan: `docker/cron/crontab` memakai timezone container UTC — `30 23 * * *` = `07:30 WITA`, `0 0 * * 1-5` = `08:00 WITA`. Jika host/Cloud Scheduler memakai WIB/WITA, sesuaikan jam cron.)*
3. **Sync Schema & Inisialisasi Database:**
   - Terapkan skema Prisma ke DB `it_tracker`:
     ```bash
     docker compose --env-file .env.production -f docker/docker-compose.gcp.yml -p ittracker \
       exec -T ittracker-app node ./node_modules/prisma/build/index.js db push --skip-generate
     ```
   - **Pilih salah satu sumber data awal:**
     - **A. Dari file dump bersih yang disiapkan (`clean_it_tracker.dump` — berisi 7 user aktif + Master Data + 18 templat maintenance, 0 transaksi):**
       ```bash
       docker cp clean_it_tracker.dump ittracker-postgres:/tmp/clean_it_tracker.dump
       docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" ittracker-postgres \
         pg_restore -U postgres -d it_tracker --no-owner --no-privileges --clean --if-exists /tmp/clean_it_tracker.dump
       ```
     - **B. Fresh seed kosong baru:** jalankan `node prisma/seed.js` & `node prisma/seed-maintenance.js` (ubah password default setelah login!).
4. **Konfigurasi Nginx Reverse Proxy + SSL untuk `projectmng.royalmedicalink.id`:**
   ```nginx
   server {
       listen 80;
       server_name projectmng.royalmedicalink.id;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name projectmng.royalmedicalink.id;
       client_max_body_size 20M;

       # Diisi otomatis oleh Certbot atau path sertifikat SSL GCP/Cloudflare Anda
       # ssl_certificate /etc/letsencrypt/live/projectmng.royalmedicalink.id/fullchain.pem;
       # ssl_certificate_key /etc/letsencrypt/live/projectmng.royalmedicalink.id/privkey.pem;

       location / {
           proxy_pass http://127.0.0.1:3100;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   Uji terlebih dahulu dari server GCP sebelum mengubah DNS:
   ```bash
   curl -I -H "Host: projectmng.royalmedicalink.id" http://127.0.0.1:3100/login
   ```
5. **Switch DNS Hostinger & Terbitkan Sertifikat SSL:**
   - Arahkan **A Record** `projectmng` ke IP Publik GCP → tunggu propagasi → terbitkan SSL (`sudo certbot --nginx -d projectmng.royalmedicalink.id`) → `sudo nginx -t && sudo systemctl reload nginx`.
6. **Aktivasi Webhook Telegram di Server Baru (Hanya Setelah HTTPS Live):**
   - Login sebagai **Admin** ke `https://projectmng.royalmedicalink.id/login`
   - Masuk ke **`/settings` → tab `Master & API`**
   - Klik **`Sync Webhook`** (mengirim URL `https://projectmng.royalmedicalink.id/api/telegram/webhook` + `TELEGRAM_WEBHOOK_SECRET`), lalu klik **`Test Bot Message`**.
7. **Smoke Test Pasca-Deploy (Wajib Lulus):**
   - **Login & Cookie**: Login ke `/login`, pastikan masuk ke `/dashboard` dan refresh halaman tetap login.
   - **Security Headers**: `curl -sI https://projectmng.royalmedicalink.id/login` mengembalikan `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
   - **Upload Storage**: Uji unggah foto profil di `/settings` atau lampiran di `/support` & muat ulang.
   - **Cron Auth Check**: `curl -s -o /dev/null -w "%{http_code}\n" https://projectmng.royalmedicalink.id/api/cron/maintenance` harus `401`; dengan header `Authorization: Bearer $CRON_SECRET` harus `200`.

---

## 5. Ringkasan Hasil Audit Keamanan & Catatan Dependensi

- **Autentikasi & Otorisasi**: 58 API route telah diaudit; seluruh endpoint terproteksi mengecek sesi JWT aktif (`user.isActive !== false`), endpoint Admin/Master Data/External Key mengembalikan `403` untuk Staff, `JWT_SECRET` & `CRON_SECRET` bersifat *fail-closed*, dan `/api/auth/login` dilengkapi rate-limiter `10` percobaan gagal per `15 menit`.
- **Proteksi Browser & File**: Header keamanan HTTP aktif global di [next.config.ts](file:///Users/battana/Documents/Project/project-management/next.config.ts), anti-Open-Redirect pada `callbackUrl`, anti-path-traversal + CSP `sandbox` pada proxy file `/api/files/[...key]` dan QR SVG, serta batas ukuran `10 MB` + whitelist ekstensi pada `/api/upload` dan `/api/assets/import`.
- **Catatan Audit Dependensi (`npm audit --omit=dev`)**:
  - Paket `next` (`16.2.9`) memiliki pembaruan patch keamanan tersedia (`fixAvailable`), `xlsx` (`high`, `noFix` — dibatasi Admin-only + maks `10 MB`), serta `sharp`/`postcss`/`nanoid` (`high`, `fixAvailable`). Tim dapat menjadwalkan patch versi `next` ke rilis minor/patch terbaru yang kompatibel saat window pemeliharaan berikutnya.
