-- 0137: young heroes are Silver Age legal (and Commoner legal when rare).
--
-- TRP 7.4: a Silver Age card-pool is 1 young hero plus deck cards, and "both
-- the hero and cards in the card-pool must be common- or rare-rarity" (a card
-- printed at basic counts as common). apply_provisional_legality() (0112/0130)
-- derived silver_age_legal = low_rarity AND NOT hero, so no hero it flagged ever
-- reached Silver Age: MPA's young Dr. Mortimer and IAR's Malice, Viserai and
-- Baalghor released Blitz-only, and every young OBK hero would on 2027-02-12.
-- Only ADULT heroes are excluded.
--
-- Commoner: the hero may be common or rare (lib/deck/format-rules.ts; CardVault
-- lists rare Baalghor as Commoner legal), so a young hero needs low_rarity, not
-- common_rarity. Deck cards keep the common rule.
--
-- Legality columns are admin-owned (pipeline 005 never writes them), so the
-- function only fixes future sets; the heroes already flagged are repaired
-- below. Each was checked against CardVault's card_legality (2026-11-28): all
-- six Silver Age legal, Baalghor / Blaze / Prism also Commoner legal. Keyed by
-- name, not card_unique_id, because locally-ingested sets have different ids.
-- Benches stay in banned_cards / silver_age_suspended — untouched here.

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
      silver_age_legal = k.low_rarity AND NOT (k.hero AND NOT k.young),
      commoner_legal   = (k.common_rarity OR (k.hero AND k.young AND k.low_rarity))
                         AND NOT (k.hero AND NOT k.young),
      updated_at       = NOW()
    FROM candidates k
    WHERE c.card_unique_id = k.card_unique_id
    RETURNING 1
  )
  SELECT count(*) INTO n FROM updated;
  RETURN n;
END;
$$;

UPDATE cards SET silver_age_legal = true, updated_at = NOW()
WHERE 'hero' = ANY(types) AND 'young' = ANY(types) AND NOT silver_age_legal
  AND lower(name) IN ('baalghor, omen of the end', 'blaze, firemind', 'dr. mortimer',
                      'malice', 'prism, advent of thrones', 'viserai, between worlds');

UPDATE cards SET commoner_legal = true, updated_at = NOW()
WHERE 'hero' = ANY(types) AND 'young' = ANY(types) AND NOT commoner_legal
  AND lower(name) IN ('baalghor, omen of the end', 'blaze, firemind', 'prism, advent of thrones');
