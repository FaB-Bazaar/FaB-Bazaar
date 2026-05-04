#!/usr/bin/env bash
# One-time local setup: run migrations then import card reference data.
# Run this once after cloning and starting Docker.
# Usage: bash scripts/import-seed-data.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_FILE="${SCRIPT_DIR}/../seeds/cards.sql.gz"
CONTAINER="fabbazaar-postgres"
DB_USER="fabbazaar"
DB_NAME="fabbazaar"

if [ ! -f "$SEED_FILE" ]; then
  echo "Error: seeds/cards.sql.gz not found."
  echo "       Make sure you have the latest seed file (git pull)."
  exit 1
fi

# Check Docker container is running
if ! docker ps --filter "name=${CONTAINER}" --filter "status=running" --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
  echo "Error: ${CONTAINER} is not running. Start it with: docker compose up -d postgres"
  exit 1
fi

echo "[setup] Running migrations..."
bash "${SCRIPT_DIR}/run-migrations.sh"

echo "[setup] Importing seed data..."
gunzip -c "$SEED_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" "$DB_NAME"

echo ""
echo "[setup] Done! Your local database is ready."
echo "        Start the app with: npm run dev"
