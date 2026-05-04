#!/usr/bin/env bash
# Regenerate seeds/cards.sql.gz from the local Docker postgres.
# Run this whenever a new FaB set is ingested by the pipeline.
# Usage: bash scripts/dump-seed-data.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_FILE="${SCRIPT_DIR}/../seeds/cards.sql"
CONTAINER="fabbazaar-postgres"
DB_USER="fabbazaar"
DB_NAME="fabbazaar"
PLACEHOLDER_ID="fabbazaar-team-seed-user-000"

mkdir -p "$(dirname "$SEED_FILE")"

echo "[seed] Generating seed file..."

# ── Header + placeholder user ────────────────────────────────────────────────
cat > "$SEED_FILE" << SQL
-- FabBazaar seed data — generated $(date -u +%Y-%m-%d)
-- Tables: cards, printings, banned_cards, locations,
--         articles (published), curated_lists (published), curated_list_cards
--
-- Articles and curated lists are attributed to a placeholder FabBazaar user.
-- This file is safe to import into a fresh local database.

INSERT INTO users (
  id, username, display_username,
  is_admin, is_super_admin, is_content_creator, can_manage_locations,
  can_import_card_collections, can_moderate_forums, is_local_gaming_store,
  is_metafy_supporter, is_curator, is_shop, is_tcg_seller,
  created_at, updated_at
) VALUES (
  '$PLACEHOLDER_ID', 'fabbazaar', 'FabBazaar',
  false, false, false, false, false, false, false, false, false, false, false,
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

SQL

# ── Simple tables (no user FKs) ──────────────────────────────────────────────
# countries and states are already seeded by migration 0013 — excluded here
echo "[seed] Dumping cards, printings, banned_cards..."
docker exec "$CONTAINER" pg_dump \
  -U "$DB_USER" -d "$DB_NAME" \
  --data-only --no-owner --no-acl \
  --table=cards \
  --table=printings \
  --table=banned_cards \
  >> "$SEED_FILE"

# ── Locations (public fields only — no manager/contact email/phone/notes) ─────
echo "[seed] Dumping locations..."
echo "" >> "$SEED_FILE"
echo "COPY public.locations (id, category, name, address_line1, address_city, address_state, address_postal_code, address_country, address_country_id, address_state_id, contact_website, tcgplayer_id, google_place_id, facebook_id, tcgplayer_storefront_url, discord_invite_url, tags, active, geo_lat, geo_lng, images, follower_count, created_at, updated_at) FROM stdin;" >> "$SEED_FILE"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
  "COPY (
    SELECT id, category, name, address_line1, address_city, address_state,
      address_postal_code, address_country, address_country_id, address_state_id,
      contact_website, tcgplayer_id, google_place_id, facebook_id,
      tcgplayer_storefront_url, discord_invite_url, tags, active,
      geo_lat, geo_lng, images, follower_count, created_at, updated_at
    FROM locations
  ) TO STDOUT" >> "$SEED_FILE"
printf '\\.\n\n' >> "$SEED_FILE"

# ── Articles (published only, author_id → placeholder) ───────────────────────
echo "[seed] Dumping articles..."
echo "" >> "$SEED_FILE"
echo "COPY public.articles (id, title, subtitle, public_id, slug, content, author_id, status, content_type, categories, image, sections, is_user_article, promoted, hero_slug, hero_class, created_at, updated_at) FROM stdin;" >> "$SEED_FILE"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
  "COPY (
    SELECT id, title, subtitle, public_id, slug, content,
      '$PLACEHOLDER_ID',
      status, content_type, categories, image, sections,
      is_user_article, promoted, hero_slug, hero_class, created_at, updated_at
    FROM articles
    WHERE status = 'published'
  ) TO STDOUT" >> "$SEED_FILE"
printf '\\.\n\n' >> "$SEED_FILE"

# ── Curated lists (published only, created_by → placeholder) ─────────────────
echo "[seed] Dumping curated_lists..."
echo "COPY public.curated_lists (id, name, description, hero_name, class_name, format, tags, is_published, sort_order, parent_id, variant_type, created_by, created_at, updated_at) FROM stdin;" >> "$SEED_FILE"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
  "COPY (
    SELECT id, name, description, hero_name, class_name, format, tags,
      is_published, sort_order, parent_id, variant_type,
      '$PLACEHOLDER_ID',
      created_at, updated_at
    FROM curated_lists
    WHERE is_published = true
  ) TO STDOUT" >> "$SEED_FILE"
printf '\\.\n\n' >> "$SEED_FILE"

# ── Curated list cards (only for published lists) ─────────────────────────────
echo "[seed] Dumping curated_list_cards..."
echo "COPY public.curated_list_cards (id, list_id, printing_id, sort_order, comment) FROM stdin;" >> "$SEED_FILE"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c \
  "COPY (
    SELECT clc.id, clc.list_id, clc.printing_id, clc.sort_order, clc.comment
    FROM curated_list_cards clc
    INNER JOIN curated_lists cl ON cl.id = clc.list_id
    WHERE cl.is_published = true
  ) TO STDOUT" >> "$SEED_FILE"
printf '\\.\n\n' >> "$SEED_FILE"

# ── Compress ──────────────────────────────────────────────────────────────────
echo "[seed] Compressing..."
gzip -f "$SEED_FILE"

echo "[seed] Done!"
echo "  Plain:      $(du -sh "${SEED_FILE}" 2>/dev/null || echo 'n/a (compressed)') "
echo "  Compressed: $(du -sh "${SEED_FILE}.gz" | cut -f1)  →  seeds/cards.sql.gz"
echo ""
echo "  Commit seeds/cards.sql.gz to ship the update to contributors."
