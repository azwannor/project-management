<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:local-dev-setup -->
## Local Development Setup

This app requires PostgreSQL and a `.env` file — neither is committed to git (`.env*` is gitignored). Prisma provider is `postgresql`; the dev server runs on **port 3001**, not 3000 (see `package.json` `dev` script).

### First-time setup
1. `npm install`. If you see "packages have install scripts not yet covered by allowScripts", run `npm approve-scripts --all` then `npm install` again — Prisma's postinstall hook (engine download) will not run otherwise and `prisma generate` will fail.
2. `docker compose up -d` — starts a local Postgres container named `it-tracker-postgres` (image `postgres:17-alpine`, matching Supabase's server version) on `localhost:5432`, db `it_tracker`. Defined in `docker-compose.yml` at repo root.
3. Create `.env` (not committed) with at least:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/it_tracker"
   DIRECT_URL="postgresql://postgres:postgres@localhost:5432/it_tracker"
   JWT_SECRET="<any dev value>"
   NEXT_PUBLIC_APP_URL="http://localhost:3001"
   ```
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET` are optional — only needed for Telegram reminder / cron features.
4. `npx prisma generate && npx prisma db push` — applies `prisma/schema.prisma` to the local DB.
5. Seed data — either:
   - Dummy data: `node prisma/seed.js` (users + a project + tasks) and `node prisma/seed-maintenance.js` (AssetType/Template/Checklist for the Maintenance module).
   - Real production data: see "Syncing production data" below.
6. `npm run dev` → `http://localhost:3001`.

### Syncing real production data into local Postgres
Production DB is Supabase (project ref `ljiuwbfpkxbpfmnzbeum`, region `ap-southeast-2`, app deployed on Vercel at `projectmng.royalmedicalink.id`). The direct connection host (`db.<ref>.supabase.co`) is **IPv6-only** — from a typical local/Docker network you must use the **Session Pooler** instead: Supabase dashboard → Connect → "Direct" tab → Connection Method → **Session pooler** (IPv4, host like `aws-1-ap-southeast-2.pooler.supabase.com:5432`, user `postgres.<project-ref>`). The "Transaction pooler" is not suitable for `pg_dump`.

1. Get the DB password from the project owner, or generate a new one via Supabase → Connect → Connection string → "Reset password". **Resetting the password immediately breaks the live production app** (it will 500 / fail to build) until Vercel's env vars are updated — see below. Treat this as a production-impacting action requiring explicit confirmation, not a routine step.
2. Dump only the `public` schema — Supabase's internal schemas (`auth`, `storage`, `realtime`, etc.) don't exist on a vanilla local Postgres and aren't used by this app:
   ```bash
   docker run --rm -e PGPASSWORD='<password>' -v "$SCRATCH:/dump" postgres:17-alpine \
     pg_dump -h aws-1-ap-southeast-2.pooler.supabase.com -p 5432 \
     -U postgres.ljiuwbfpkxbpfmnzbeum -d postgres \
     --schema=public --no-owner --no-privileges --clean --if-exists \
     -Fc -f /dump/production.dump
   ```
3. Restore into the local container:
   ```bash
   docker cp "$SCRATCH/production.dump" it-tracker-postgres:/tmp/production.dump
   docker exec -e PGPASSWORD=postgres it-tracker-postgres \
     pg_restore -U postgres -d it_tracker --no-owner --no-privileges /tmp/production.dump
   ```
4. `npx prisma generate` again afterward.

⚠️ **Never commit a production password or full production connection string into this repo.** Keep it only in the local, gitignored `.env` / shell session.

### If the production DB password is reset
You must also update `DATABASE_URL` and `DIRECT_URL` in **Vercel → Project Settings → Environment Variables** (Production and Preview scope) with the new password, then trigger a redeploy (Deployments tab → "..." on the latest deployment → Redeploy) — env var changes don't apply to already-built deployments. Until redeployed, the build fails with `P1000: Authentication failed` and the live site errors out.

### Login credentials
- Dummy seed (`prisma/seed.js`): `admin@it-tracker.com` / `password123` (plus 4 staff accounts, same password).
- Real users (after syncing production data): passwords are bcrypt hashes — there's no way to recover or guess them from tooling. Log in with a real account's actual password.
<!-- END:local-dev-setup -->
