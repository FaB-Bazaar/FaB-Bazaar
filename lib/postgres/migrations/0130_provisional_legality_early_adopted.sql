-- 0130: apply_provisional_legality() also covers cards the feed adopted early.
--
-- 0112 only derived flags for provisional cards (fab_cube_card_id IS NULL).
-- But a card previewed early in spoiler season is ingested from CardVault and
-- then ADOPTED by fab-cube weeks before its set is legal: the anchor is
-- stamped while every *_legal flag is still false, the function skips it from
-- then on, and pipeline 005 never writes those columns. The card stays illegal
-- in every format after release — MPA shipped with Dr. Mortimer (adult and
-- young), Mutually Assured Destruction, Prey on Insecurity, Remember the Mists
-- and Seed Inertia missing from all format pools.
--
-- A never-flagged card now qualifies when it is provisional OR it has an
-- English CardVault-ingested printing (lss_print_id) in a set whose legal date
-- has passed. That marker keeps the scope to spoiler-season ingests:
--   * feed-origin cards have no lss_print_id printing, so a deliberate
--     all-false row on an old card (promo / prize sets) is left alone;
--   * the i18n import also stamps lss_print_id, but only on non-English
--     printings, hence the language check.
-- Derivation rules are unchanged from 0112. Still idempotent (only all-false
-- rows qualify) and still run nightly by pipeline 005.

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
    WHERE NOT (c.cc_legal OR c.blitz_legal OR c.silver_age_legal OR c.ll_legal OR c.commoner_legal)
    GROUP BY c.card_unique_id, c.types, c.fab_cube_card_id
    HAVING c.fab_cube_card_id IS NULL
        OR bool_or(p.lss_print_id IS NOT NULL AND p.language = 'en')
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

-- Heal the cards already stuck (MPA / AMO early previews).
SELECT apply_provisional_legality();
