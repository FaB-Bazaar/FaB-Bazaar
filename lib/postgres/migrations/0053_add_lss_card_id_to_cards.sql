-- Add `lss_card_id` to cards: the upstream LSS card UUID (e.g.
-- "366d51cf-1639-45d1-a4ff-f1912d736995" for Fyendal's Spring Tunic).
--
-- Why:
--   - Cross-reference our card_unique_id with LSS's database without
--     re-resolving by name/code on every import.
--   - Re-run the LSS feed against our DB and detect "we already have this
--     card" by UUID, faster than the printed_code probe.
--
-- NOT unique: DFCs share one LSS UUID across multiple of our card rows.
-- E.g. Mistcloak Gully (one card_unique_id) and Inner Chi (another
-- card_unique_id) both come from LSS card UUID
-- "5a1b...id-of-Mistcloak-DFC". Indexed (non-unique) for fast lookups.
--
-- Backfill: pulls from card_translations.source_card_id for the cards
-- already imported via the LSS feed.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS lss_card_id text;

CREATE INDEX IF NOT EXISTS idx_cards_lss_card_id
  ON cards(lss_card_id)
  WHERE lss_card_id IS NOT NULL;

UPDATE cards c
   SET lss_card_id = sub.source_card_id
  FROM (
    SELECT DISTINCT ON (card_unique_id) card_unique_id, source_card_id
      FROM card_translations
     WHERE source_card_id IS NOT NULL
     ORDER BY card_unique_id, updated_at DESC
  ) sub
 WHERE c.card_unique_id = sub.card_unique_id
   AND c.lss_card_id IS NULL;
