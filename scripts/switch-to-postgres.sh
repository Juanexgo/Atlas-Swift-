#!/usr/bin/env bash
# Atlas — switch the API from SQLite (default) to Postgres + pgvector.
#
# Boots the docker-compose stack, points DATABASE_URL at it, runs the
# migration, seeds, and prints the next step. Idempotent — safe to re-run.
#
# Usage:  scripts/switch-to-postgres.sh
set -euo pipefail

cd "$(dirname "$0")/.."

PG_URL="postgresql://atlas:atlas@localhost:5432/atlas?schema=public"
API_DIR="apps/api"

echo "→ Starting Postgres + pgvector via docker compose…"
(cd "$API_DIR" && docker compose up -d postgres)

echo "→ Waiting for Postgres to accept connections…"
for i in {1..30}; do
  if (cd "$API_DIR" && docker compose exec -T postgres pg_isready -U atlas -d atlas) >/dev/null 2>&1; then
    echo "  ready."
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "  Postgres did not become ready after 30s. Check docker logs." >&2
    exit 1
  fi
done

echo "→ Switching DATABASE_URL in apps/api/.env"
if [ -f "$API_DIR/.env" ]; then
  # Update existing DATABASE_URL line; if absent, append.
  if grep -q "^DATABASE_URL=" "$API_DIR/.env"; then
    sed -i.bak "s#^DATABASE_URL=.*#DATABASE_URL=\"$PG_URL\"#" "$API_DIR/.env"
  else
    echo "DATABASE_URL=\"$PG_URL\"" >> "$API_DIR/.env"
  fi
else
  echo "DATABASE_URL=\"$PG_URL\"" > "$API_DIR/.env"
fi

echo "→ Generating Prisma client + running migrations…"
DATABASE_URL="$PG_URL" pnpm --filter @atlas/api prisma:generate
DATABASE_URL="$PG_URL" pnpm --filter @atlas/api prisma:migrate:dev || true

echo "→ Seeding…"
DATABASE_URL="$PG_URL" pnpm --filter @atlas/api prisma:seed || true

echo ""
echo "✓ Atlas is now on Postgres + pgvector."
echo "  Boot the API with:  cd $API_DIR && pnpm start"
echo "  Revert to SQLite:   edit $API_DIR/.env back to DATABASE_URL=\"file:./dev.db\""
