-- 0104: re-apply "pirate is a CLASS" — durably this time.
--
-- Why: 0065 moved pirate from cards.talents → cards.classes as a one-shot
-- UPDATE, but the nightly pipeline (003 transformer → 005 upsert) owns those
-- columns and still filed pirate under TALENTS, so the reclassification was
-- reverted the very next night. Result on prod: the /opt Class → Pirate
-- filter (`classes && ARRAY['pirate']`) matched zero cards, while heroes and
-- deck validation quietly kept working through the talents path.
--
-- The durable fix is in the pipeline (003 now lists pirate in CLASSES); this
-- migration brings the DB to the SAME shape the transformer now emits so the
-- app is correct at deploy time (not at the next nightly, which may also be
-- skipped by the RAM-gated pipeline rebuild), and so the nightly upsert is a
-- no-op rather than a flip-flop:
--   * pirate-only card:  classes {generic}      → {pirate}   (a class-restricted
--     card is not generic — only pirate heroes may play it, like any class card)
--   * dual-class card:   classes {necromancer}  → {necromancer, pirate}
--   * every case:        talents lose 'pirate'
-- and the derived flags are recomputed with the transformer's exact formulas.
-- has_pirate stays TRUE (there is no is_pirate column; the hasPirate search
-- filter reads has_pirate).
--
-- Value-only rewrite of pipeline-owned columns on the 141 pirate cards
-- (checked: none has generic alongside another class, none has another
-- talent). No ids change, no deletes, no user-data tables involved.
-- Idempotent: only rows still carrying pirate-in-talents are touched.

UPDATE cards
SET classes = array_remove(array_append(classes, 'pirate'), 'generic'),
    talents = array_remove(talents, 'pirate')
WHERE 'pirate' = ANY(talents)
  AND NOT ('pirate' = ANY(classes));

-- Recompute derived flags for every pirate-class card (mirrors
-- 003_cards_to_printings_transformer.get_class_talent_flags).
UPDATE cards
SET is_generic           = ('generic' = ANY(classes)),
    has_pirate           = TRUE,
    is_generic_only      = (cardinality(classes) = 1 AND 'generic' = ANY(classes) AND cardinality(talents) = 0),
    has_class_and_talent = (cardinality(classes) > 0 AND cardinality(talents) > 0
                            AND NOT ('generic' = ANY(classes) AND cardinality(classes) = 1)),
    has_class_only       = (cardinality(classes) > 0 AND cardinality(talents) = 0
                            AND NOT ('generic' = ANY(classes) AND cardinality(classes) = 1)),
    has_talent_only      = (cardinality(classes) <= 1 AND 'generic' = ANY(classes) AND cardinality(talents) > 0)
WHERE 'pirate' = ANY(classes);
