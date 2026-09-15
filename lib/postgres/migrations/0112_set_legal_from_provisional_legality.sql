-- 0112: constructed legality for spoiler-season (provisional) sets.
--
-- A set ingested from CardVault before fab-cube publishes it creates
-- provisional `cards` rows (fab_cube_card_id IS NULL) with every *_legal flag
-- false, and pipeline 005 never writes those columns (CARD_ADMIN_OWNED_COLS).
-- So after release nothing makes the set legal until the feed adopts each row
-- — IAR sat at 21/263 CC-legal cards on prod two weeks before release day.
--
-- sets.legal_from: the date a set becomes constructed-legal. NULL = its
-- release_date. Set it earlier than release_date to open a set during
-- prerelease week (IAR below).
--
-- apply_provisional_legality(): derives the five flags for provisional cards
-- that have NEVER been flagged, in sets whose legal date has passed. Rules
-- mirror what the fab-cube feed emits for released sets:
--   cc / ll      = not a young hero
--   blitz        = not an adult hero
--   silver age   = non-hero with a common / rare / basic / token printing
--   commoner     = common / basic / token printing, and not an adult hero
-- Idempotent (only all-false rows qualify); called once here and nightly by
-- pipeline 005 so future sets flip on their own date. When fab-cube adopts
-- the rows the feed's flags do NOT overwrite these (admin-owned) —
-- scripts/backfill-format-legality.ts reconciles from the feed if needed.

ALTER TABLE sets ADD COLUMN IF NOT EXISTS legal_from date;
COMMENT ON COLUMN sets.legal_from IS 'Date the set becomes constructed-legal; NULL = release_date.';

CREATE OR REPLACE FUNCTION apply_provisional_legality() RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  n integer;
BEGIN
  WITH legal_sets AS (
    SELECT code FROM sets
    WHERE COALESCE(legal_from, release_date) <= CURRENT_DATE
      AND category <> 'excluded'
  ),
  candidates AS (
    SELECT c.card_unique_id,
           ('young' = ANY(c.types)) AS young,
           ('hero'  = ANY(c.types)) AS hero,
           bool_or(lower(p.rarity) IN ('c', 'r', 'b', 't')) AS low_rarity,
           bool_or(lower(p.rarity) IN ('c', 'b', 't'))      AS common_rarity
    FROM cards c
    JOIN printings p ON p.card_unique_id = c.card_unique_id
    JOIN legal_sets ls ON ls.code = p.set
    WHERE c.fab_cube_card_id IS NULL
      AND NOT (c.cc_legal OR c.blitz_legal OR c.silver_age_legal OR c.ll_legal OR c.commoner_legal)
    GROUP BY c.card_unique_id, c.types
  ),
  updated AS (
    UPDATE cards c SET
      cc_legal         = NOT k.young,
      ll_legal         = NOT k.young,
      blitz_legal      = NOT (k.hero AND NOT k.young),
      silver_age_legal = k.low_rarity AND NOT k.hero,
      commoner_legal   = k.common_rarity AND NOT (k.hero AND NOT k.young),
      updated_at       = NOW()
    FROM candidates k
    WHERE c.card_unique_id = k.card_unique_id
    RETURNING 1
  )
  SELECT count(*) INTO n FROM updated;
  RETURN n;
END;
$$;

-- Usurp the Shadow Throne: open for constructed play from prerelease week.
UPDATE sets SET legal_from = DATE '2026-09-14' WHERE code = 'iar';

SELECT apply_provisional_legality();
