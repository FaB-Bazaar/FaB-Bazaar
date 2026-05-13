-- Add `talishar_card_id` to cards: the canonical identifier Talishar uses
-- internally to refer to this card. Derived from (display_name, pitch) via the
-- algorithm in lib/talishar/cardId.ts (a port of Talishar's own
-- GetCardIdentifier function from zzCardCodeGenerator.php).
--
-- Why this column exists:
--   - Talishar emits these identifiers in game-result payloads (card_results,
--     turn_log, etc.). Previously, resolving a Talishar id back to one of our
--     printings required either (a) fuzzy-matching against card_results.cardName
--     with a per-card searchPrintings call, or (b) iterating the deck list. Both
--     are slow and prone to misses on punctuation (e.g. "Titan's Fist" vs
--     "Titans Fist"). The new column lets us answer the lookup with a single
--     indexed equality query.
--   - The algorithm is deterministic, so the column is derived data — kept in
--     sync by the pipeline (script 003 computes it, script 005 writes it).
--
-- Lookup-side normalization (strip _equip / _ally / _r suffixes and any
-- ^[A-Z]{3}\d{3}_ alt-art set prefix) is done in TS, not SQL — see
-- normalizeTalisharId in lib/talishar/cardId.ts.
--
-- Nullable for now: cards inserted before the pipeline is re-run will have
-- NULL until backfilled (scripts/backfill-talishar-card-id.ts).

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS talishar_card_id text;

CREATE INDEX IF NOT EXISTS cards_talishar_card_id_idx
  ON cards(talishar_card_id)
  WHERE talishar_card_id IS NOT NULL;
