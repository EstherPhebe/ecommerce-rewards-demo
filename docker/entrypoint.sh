#!/bin/sh
set -e

echo "[entrypoint] Generating Prisma client..."
npx prisma generate

echo "[entrypoint] Running database migrations..."
npx prisma migrate deploy

# Upserts the achievement/badge catalogue, so re-running on every boot is safe.
echo "[entrypoint] Seeding reward catalogue..."
npx prisma db seed

echo "[entrypoint] Starting server..."
exec npx tsx index.ts
