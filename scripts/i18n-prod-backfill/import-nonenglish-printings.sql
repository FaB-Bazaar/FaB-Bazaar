-- Additive-only backfill of non-English printings into PROD.
--
-- SAFETY PROPERTIES (read before running):
--   * Wrapped in a transaction. The last line is ROLLBACK by default (dry run).
--     Change ROLLBACK -> COMMIT only after the reported counts look right.
--   * INSERT ... ON CONFLICT (printing_id) DO NOTHING  -> never updates/deletes
--     an existing prod row. Existing data is untouchable.
--   * WHERE EXISTS (cards ...) guard -> never raises a foreign-key error;
--     any row whose card is absent in prod is skipped, not aborted.
--   * staging filtered to language <> 'en' -> the English catalog is never touched.
--
-- Usage (on the VPS):
--   docker cp nonenglish_printings.csv fabbazaar-postgres:/tmp/nonenglish_printings.csv
--   docker exec -i fabbazaar-postgres sh -c \
--     'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -' \
--     < import-nonenglish-printings.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE staging_nonen (LIKE printings INCLUDING DEFAULTS) ON COMMIT DROP;

\copy staging_nonen ("printing_id","card_unique_id","set_printing_unique_id","collector_number","set","edition","foiling","rarity","is_first_edition","is_unlimited","is_normal_edition","is_normal_foil","is_rainbow_foil","is_cold_foil","is_extended_art","is_common","is_rare","is_super_rare","is_majestic","is_legendary","is_fabled","is_promo","image_url","image_rotation_degrees","artists","flavor_text","art_variations","tcgplayer_product_id","tcgplayer_url","tcgplayer_subtype_name","tcg_market","tcg_low","tcg_mid","tcg_high","has_price","price_updated_at","is_budget","is_under_5","is_under_10","is_under_25","is_under_50","is_under_100","is_expensive","is_premium","expansion_slot","content_hash","created_at","updated_at","other_face_printing_id","is_front_face","foil_inset_top","foil_inset_right","foil_inset_bottom","foil_inset_left","foil_inset_round","foil_inset_locked","language") FROM '/tmp/nonenglish_printings.csv' WITH (FORMAT csv, HEADER true)

-- Belt-and-suspenders: drop anything that isn't non-English.
DELETE FROM staging_nonen WHERE language = 'en';

\echo '--- staged rows by language ---'
SELECT language, count(*) FROM staging_nonen GROUP BY language ORDER BY language;

\echo '--- rows that will be SKIPPED: card missing in prod ---'
SELECT count(*) AS skip_missing_card
FROM staging_nonen s
WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.card_unique_id = s.card_unique_id);

\echo '--- rows that will be SKIPPED: printing_id already in prod ---'
SELECT count(*) AS already_present
FROM staging_nonen s
WHERE EXISTS (SELECT 1 FROM printings p WHERE p.printing_id = s.printing_id);

\echo '--- prod printings BEFORE insert ---'
SELECT language, count(*) FROM printings GROUP BY language ORDER BY language;

INSERT INTO printings (
  "printing_id","card_unique_id","set_printing_unique_id","collector_number","set","edition","foiling","rarity",
  "is_first_edition","is_unlimited","is_normal_edition","is_normal_foil","is_rainbow_foil","is_cold_foil","is_extended_art",
  "is_common","is_rare","is_super_rare","is_majestic","is_legendary","is_fabled","is_promo",
  "image_url","image_rotation_degrees","artists","flavor_text","art_variations",
  "tcgplayer_product_id","tcgplayer_url","tcgplayer_subtype_name","tcg_market","tcg_low","tcg_mid","tcg_high",
  "has_price","price_updated_at","is_budget","is_under_5","is_under_10","is_under_25","is_under_50","is_under_100",
  "is_expensive","is_premium","expansion_slot","content_hash","created_at","updated_at",
  "other_face_printing_id","is_front_face","foil_inset_top","foil_inset_right","foil_inset_bottom","foil_inset_left",
  "foil_inset_round","foil_inset_locked","language"
)
SELECT
  "printing_id","card_unique_id","set_printing_unique_id","collector_number","set","edition","foiling","rarity",
  "is_first_edition","is_unlimited","is_normal_edition","is_normal_foil","is_rainbow_foil","is_cold_foil","is_extended_art",
  "is_common","is_rare","is_super_rare","is_majestic","is_legendary","is_fabled","is_promo",
  "image_url","image_rotation_degrees","artists","flavor_text","art_variations",
  "tcgplayer_product_id","tcgplayer_url","tcgplayer_subtype_name","tcg_market","tcg_low","tcg_mid","tcg_high",
  "has_price","price_updated_at","is_budget","is_under_5","is_under_10","is_under_25","is_under_50","is_under_100",
  "is_expensive","is_premium","expansion_slot","content_hash","created_at","updated_at",
  "other_face_printing_id","is_front_face","foil_inset_top","foil_inset_right","foil_inset_bottom","foil_inset_left",
  "foil_inset_round","foil_inset_locked","language"
FROM staging_nonen s
WHERE EXISTS (SELECT 1 FROM cards c WHERE c.card_unique_id = s.card_unique_id)
ON CONFLICT (printing_id) DO NOTHING;

\echo '--- prod printings AFTER insert ---'
SELECT language, count(*) FROM printings GROUP BY language ORDER BY language;

-- DRY RUN by default. Review the counts above, then change ROLLBACK -> COMMIT.
ROLLBACK;
