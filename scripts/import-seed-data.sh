#!/usr/bin/env bash
# One-time local setup: run migrations then import card reference data.
# Run this once after cloning and starting Docker.
# Usage: bash scripts/import-seed-data.sh [--force-reseed]
#
#   --force-reseed  Wipe previously imported seed data first. DESTRUCTIVE:
#                   truncating cards/printings CASCADEs into anything that
#                   references them (inventory_items, wants_items, deck_cards).
#                   Only use on a database whose user data you don't need —
#                   to refresh a real dev DB from prod, use the refresh-local-db
#                   flow instead.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_FILE="${SCRIPT_DIR}/../seeds/cards.sql.gz"
CONTAINER="fabbazaar-postgres"
DB_USER="fabbazaar"
DB_NAME="fabbazaar"

FORCE_RESEED=false
[ "${1:-}" = "--force-reseed" ] && FORCE_RESEED=true

psql_q() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1"
}

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

# ── Non-empty guard ───────────────────────────────────────────────────────────
existing_cards=$(psql_q "SELECT count(*) FROM cards")
if [ "$existing_cards" -gt 0 ]; then
  if [ "$FORCE_RESEED" = false ]; then
    echo ""
    echo "Error: database already contains ${existing_cards} cards."
    echo "       Re-importing on top of existing data would fail on duplicates."
    echo ""
    echo "       To wipe seed tables and re-import:  bash scripts/import-seed-data.sh --force-reseed"
    echo "       To refresh from a prod backup:      use the refresh-local-db flow"
    exit 1
  fi

  echo ""
  echo "⚠  --force-reseed will TRUNCATE these tables (CASCADE — this also wipes"
  echo "   inventory_items, wants_items, and ALL deck_cards that reference them):"
  echo "     cards, printings, banned_cards, card_translations,"
  echo "     facet_tag_definitions, card_facet_tags, tcg_groups,"
  echo "     locations, articles, curated_lists, curated_list_cards"
  echo "   and DELETE system decks (Decks to Beat)."
  echo ""
  read -r -p "   Continue? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }

  echo "[setup] Wiping previous seed data..."
  psql_q "BEGIN;
    DELETE FROM decks WHERE is_system_deck = true;
    TRUNCATE cards, printings, banned_cards, card_translations,
      facet_tag_definitions, card_facet_tags, tcg_groups,
      locations, articles, curated_lists, curated_list_cards CASCADE;
    COMMIT;" > /dev/null
fi

# ── Import (single transaction, stop on first error) ─────────────────────────
echo "[setup] Importing seed data..."
gunzip -c "$SEED_FILE" | docker exec -i "$CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -1 -q -o /dev/null

# ── Verify ────────────────────────────────────────────────────────────────────
echo "[setup] Imported row counts:"
psql_q "SELECT format('    %-24s %s', t.name, t.n) FROM (
    SELECT 'cards' AS name, count(*) AS n FROM cards
    UNION ALL SELECT 'printings', count(*) FROM printings
    UNION ALL SELECT 'card_translations', count(*) FROM card_translations
    UNION ALL SELECT 'banned_cards', count(*) FROM banned_cards
    UNION ALL SELECT 'facet_tag_definitions', count(*) FROM facet_tag_definitions
    UNION ALL SELECT 'card_facet_tags', count(*) FROM card_facet_tags
    UNION ALL SELECT 'tcg_groups', count(*) FROM tcg_groups
    UNION ALL SELECT 'locations', count(*) FROM locations
    UNION ALL SELECT 'articles', count(*) FROM articles
    UNION ALL SELECT 'curated_lists', count(*) FROM curated_lists
    UNION ALL SELECT 'curated_list_cards', count(*) FROM curated_list_cards
    UNION ALL SELECT 'decks_to_beat', count(*) FROM decks WHERE is_system_deck = true
  ) t"

if [ "$(psql_q "SELECT count(*) FROM cards")" -eq 0 ]; then
  echo "Error: import completed but cards table is empty — something went wrong."
  exit 1
fi

echo ""
echo "[setup] Done! Your local database is ready."
echo "        Start the app with: npm run dev"
