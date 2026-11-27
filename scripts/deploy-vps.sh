#!/usr/bin/env bash
set -euo pipefail

cd /opt/ittracker

echo "[1/4] Building ittracker-app standalone image..."
docker compose --env-file .env.production -f docker/docker-compose.prod.yml -p ittracker build ittracker-app

echo "[2/4] Updating ittracker-app without disturbing Postgres or MinIO..."
docker compose --env-file .env.production -f docker/docker-compose.prod.yml -p ittracker up -d --no-deps ittracker-app

echo "[3/4] Applying safe Prisma schema sync..."
docker compose --env-file .env.production -f docker/docker-compose.prod.yml -p ittracker exec -T ittracker-app node ./node_modules/prisma/build/index.js db push --skip-generate

echo "[4/4] Pruning stale build cache (>24h)..."
docker builder prune -f --filter 'until=24h'

echo "Deployment finished cleanly."
