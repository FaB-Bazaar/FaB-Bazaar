#!/usr/bin/env bash
# Regenerate seeds/cards.sql.gz from the local Docker postgres.
# Run whenever a new FaB set is ingested or curated content should ship to forks.
# Usage: bash scripts/dump-seed-data.sh
#
# Safety model (this file is committed to a PUBLIC repo):
#   1. Allow-list only — every table and column is named explicitly below.
#   2. Drift guard — tables dumped with a hand-written column list are checked
#      against information_schema first. If a table gained or lost a column the
#      script FAILS until the column is classified: public → add it to the COPY
#      list; private → add it to the EXPECTED_COLS entry only.
#   3. Leak gate — the generated SQL is scanned for private columns and user
#      data before it is compressed.
# Deeper inspection of the artifact: /inspect-seed
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEED_FILE="${SCRIPT_DIR}/../seeds/cards.sql"
CONTAINER="fabbazaar-postgres"
DB_USER="fabbazaar"
DB_NAME="fabbazaar"
PLACEHOLDER_ID="fabbazaar-team-seed-user-000"

psql_q() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "$1"
}

fail() { echo "[seed] ERROR: $1" >&2; exit 1; }

mkdir -p "$(dirname "$SEED_FILE")"

# ── Drift guard ───────────────────────────────────────────────────────────────
# Full column set (public + deliberately excluded) for every table we dump with
# a hand-written column list, sorted alphabetically. Whole-table pg_dump tables
# (cards, printings, …) don't need this — pg_dump emits its own column lists.
assert_columns() {
  local table="$1" expected="$2" actual
  actual=$(psql_q "SELECT string_agg(column_name, ' ' ORDER BY column_name)
                   FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = '${table}'")
  if [ "$actual" != "$expected" ]; then
    echo "[seed] Column drift detected in '${table}':" >&2
    echo "  expected: ${expected}" >&2
    echo "  actual:   ${actual}" >&2
    fail "classify the changed column(s) in dump-seed-data.sh before dumping (public → COPY list, private → expected list only)"
  fi
}

echo "[seed] Checking for column drift..."
assert_columns locations "active address_city address_country address_country_id address_line1 address_postal_code address_state address_state_id category contact_email contact_email_iv contact_phone contact_website created_at discord_invite_url facebook_id follower_count geo_lat geo_lng google_place_id id images manager_email manager_email_iv manager_name manager_phone name notes tags tcgplayer_id tcgplayer_storefront_url updated_at"
assert_columns articles "author_id categories content content_type created_at hero_class hero_slug id image is_user_article promoted public_id sections slug status subtitle title updated_at"
assert_columns curated_lists "class_name created_at created_by description format hero_name id is_published name parent_id sort_order tags updated_at variant_type"
assert_columns curated_list_cards "comment id list_id printing_id sort_order"
assert_columns decks "available_on_talishar co_owners created_at description event_date event_name featured format hero_name id is_system_deck metadata metafy_guide_id name pinned_in_nav placing public_id slug tags updated_at user_id visibility"
assert_columns deck_cards "added_at category deck_id id notes printing_id quantity"
echo "[seed] No drift."

echo "[seed] Generating seed file..."

# ── Header + placeholder user ────────────────────────────────────────────────
cat > "$SEED_FILE" << SQL
-- FabBazaar seed data — generated $(date -u +%Y-%m-%d)
-- Card data licensed CC-BY-SA 4.0 — see DATA-LICENSE.md.
--
-- Tables:
--   cards, printings, banned_cards, card_translations,
--   facet_tag_definitions, card_facet_tags, tcg_groups,
--   locations (public fields only), articles (published),
--   curated_lists (published) + curated_list_cards,
--   decks (Decks to Beat only) + deck_cards
--
-- User-attributed content (articles, curated lists, system decks) is remapped
-- to a placeholder FabBazaar user. This file is safe to import into a fresh
-- local database. countries/states and sets are seeded by migrations.

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

# ── Whole-table reference data (no user FKs) ─────────────────────────────────
# Separate pg_dump calls pin FK-safe import order (definitions before tags, …).
# countries/states (migration 0013) and sets (migration 0061) are excluded —
# migrations seed those.
dump_tables() {
  docker exec "$CONTAINER" pg_dump \
    -U "$DB_USER" -d "$DB_NAME" \
    --data-only --no-owner --no-acl \
    "$@" >> "$SEED_FILE"
}

# facet_tag_definitions and tcg_groups are PARTIALLY seeded by migrations
# (0060, 0067) — a fresh fork DB already has baseline rows, so plain COPY
# would hit duplicate keys. DELETE-then-COPY converges them to the dump state.
# Both must land BEFORE their referencing tables (card_facet_tags, printings)
# so the DELETE runs while those are still empty and the FKs are satisfied.
echo "[seed] Dumping facet tag vocabulary..."
echo "DELETE FROM public.facet_tag_definitions;" >> "$SEED_FILE"
dump_tables --table=facet_tag_definitions

echo "[seed] Dumping tcg_groups..."
echo "DELETE FROM public.tcg_groups;" >> "$SEED_FILE"
dump_tables --table=tcg_groups

echo "[seed] Dumping cards, printings, banned_cards..."
dump_tables --table=cards --table=printings --table=banned_cards

echo "[seed] Dumping card_translations..."
dump_tables --table=card_translations

echo "[seed] Dumping card facet tag assignments..."
dump_tables --table=card_facet_tags

# ── Locations (public fields only — no manager/contact email/phone/notes) ─────
echo "[seed] Dumping locations..."
echo "" >> "$SEED_FILE"
echo "COPY public.locations (id, category, name, address_line1, address_city, address_state, address_postal_code, address_country, address_country_id, address_state_id, contact_website, tcgplayer_id, google_place_id, facebook_id, tcgplayer_storefront_url, discord_invite_url, tags, active, geo_lat, geo_lng, images, follower_count, created_at, updated_at) FROM stdin;" >> "$SEED_FILE"
psql_q "COPY (
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
echo "COPY public.articles (id, title, subtitle, public_id, slug, content, author_id, status, content_type, categories, image, sections, is_user_article, promoted, hero_slug, hero_class, created_at, updated_at) FROM stdin;" >> "$SEED_FILE"
psql_q "COPY (
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
psql_q "COPY (
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
psql_q "COPY (
    SELECT clc.id, clc.list_id, clc.printing_id, clc.sort_order, clc.comment
    FROM curated_list_cards clc
    INNER JOIN curated_lists cl ON cl.id = clc.list_id
    WHERE cl.is_published = true
  ) TO STDOUT" >> "$SEED_FILE"
printf '\\.\n\n' >> "$SEED_FILE"

# ── Decks to Beat (system decks only, owner → placeholder) ────────────────────
# metafy_guide_id / co_owners / pinned_in_nav are omitted — defaults apply.
echo "[seed] Dumping Decks to Beat..."
echo "COPY public.decks (id, public_id, user_id, name, slug, description, format, hero_name, visibility, available_on_talishar, featured, is_system_deck, event_name, event_date, \"placing\", tags, metadata, created_at, updated_at) FROM stdin;" >> "$SEED_FILE"
psql_q "COPY (
    SELECT id, public_id,
      '$PLACEHOLDER_ID',
      name, slug, description, format, hero_name, visibility,
      available_on_talishar, featured, is_system_deck,
      event_name, event_date, \"placing\", tags, metadata,
      created_at, updated_at
    FROM decks
    WHERE is_system_deck = true
  ) TO STDOUT" >> "$SEED_FILE"
printf '\\.\n\n' >> "$SEED_FILE"

echo "[seed] Dumping Decks to Beat cards..."
echo "COPY public.deck_cards (id, deck_id, printing_id, quantity, category, notes, added_at) FROM stdin;" >> "$SEED_FILE"
psql_q "COPY (
    SELECT dc.id, dc.deck_id, dc.printing_id, dc.quantity, dc.category, dc.notes, dc.added_at
    FROM deck_cards dc
    INNER JOIN decks d ON d.id = dc.deck_id
    WHERE d.is_system_deck = true
  ) TO STDOUT" >> "$SEED_FILE"
printf '\\.\n\n' >> "$SEED_FILE"

# ── Leak gate ─────────────────────────────────────────────────────────────────
echo "[seed] Running leak gate..."

# 1. The only users content is the single placeholder INSERT.
[ "$(grep -c '^COPY public\.users' "$SEED_FILE" || true)" -eq 0 ] \
  || fail "leak gate: found a COPY of the users table"
[ "$(grep -c '^INSERT INTO users' "$SEED_FILE" || true)" -eq 1 ] \
  || fail "leak gate: expected exactly one placeholder users INSERT"

# 2. Per-table forbidden columns must not appear in that table's COPY header.
check_header() {
  local table="$1"; shift
  local header
  header=$(grep "^COPY public\.${table} " "$SEED_FILE" || true)
  [ -n "$header" ] || fail "leak gate: no COPY block found for ${table}"
  for col in "$@"; do
    if echo "$header" | grep -qw "$col"; then
      fail "leak gate: private column '${col}' in ${table} COPY header"
    fi
  done
}
check_header locations contact_email contact_email_iv contact_phone \
  manager_email manager_email_iv manager_name manager_phone notes
check_header decks metafy_guide_id co_owners

# 3. No sensitive column names in ANY COPY header (users-shaped leakage).
if grep '^COPY public\.' "$SEED_FILE" | grep -Ew 'password_hash|email_hash|email_iv|discord_id|access_token'; then
  fail "leak gate: sensitive column name found in a COPY header"
fi

# 4. Email address scan — warn for human review (article/flavor text can
#    legitimately contain public emails; the /inspect-seed skill digs deeper).
email_hits=$(grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "$SEED_FILE" | sort -u || true)
if [ -n "$email_hits" ]; then
  echo "[seed] WARNING: email-like strings found — review before committing:"
  echo "$email_hits" | head -10 | sed 's/^/    /'
fi

echo "[seed] Leak gate passed."

# ── Row-count summary ─────────────────────────────────────────────────────────
echo "[seed] Row counts:"
awk '/^COPY public\./ { tab=$2; n=0; next }
     /^\\\.$/ { if (tab != "") { printf "    %-28s %7d rows\n", tab, n; tab="" }; next }
     tab != "" { n++ }' "$SEED_FILE"

# ── Compress ──────────────────────────────────────────────────────────────────
echo "[seed] Compressing..."
gzip -f "$SEED_FILE"

echo "[seed] Done!"
echo "  Compressed: $(du -sh "${SEED_FILE}.gz" | cut -f1)  →  seeds/cards.sql.gz"
echo ""
echo "  Inspect with /inspect-seed, then commit seeds/cards.sql.gz to ship the update."
