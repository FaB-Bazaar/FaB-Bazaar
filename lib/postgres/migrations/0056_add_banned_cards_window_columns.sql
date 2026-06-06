-- Refine the banned_cards registry to model FaB's full legality taxonomy.
--
-- The `restriction_type` column previously only carried 'banned' | 'restricted'.
-- FaB actually has four distinct states, and we now store them all here:
--   - banned        : permanent, per-format (unchanged)
--   - restricted    : Living Legend 1-of (unchanged)
--   - benched       : Silver Age heroes, TIME-BOXED — auto-return at season end
--   - living_legend : adult hero + signature weapon pseudo-ban (graduated out of CC)
--
-- restriction_type is plain text (no DB enum/check), so the two new values need
-- no column change. What's new is the benching WINDOW: a benched hero is only
-- in effect between date_in_effect (the "from") and date_expires (the "until"),
-- with until_set / reason capturing FaB's "UNTIL Set 20 / community vote" detail.
--
-- All nullable — every existing row (and every banned/restricted/living_legend
-- row) leaves them NULL; only benched entries populate them.

ALTER TABLE banned_cards
  ADD COLUMN IF NOT EXISTS date_expires timestamp,
  ADD COLUMN IF NOT EXISTS until_set    text,
  ADD COLUMN IF NOT EXISTS reason       text;

-- Widen the restriction_type CHECK to admit the two new statuses. The old
-- constraint only allowed 'banned' | 'restricted'.
ALTER TABLE banned_cards
  DROP CONSTRAINT IF EXISTS banned_cards_restriction_type_check;

ALTER TABLE banned_cards
  ADD CONSTRAINT banned_cards_restriction_type_check
  CHECK (restriction_type = ANY (ARRAY['banned', 'restricted', 'benched', 'living_legend']));
