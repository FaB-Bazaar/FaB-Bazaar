-- 0079: arcane damage stat on cards.
-- Numeric arcane damage a card deals when played (FaBrary semantics), sourced
-- from the fab-cube feed's `arcane` field via pipeline 003/005. NULL for cards
-- that deal no arcane damage; variable amounts ("X") keep NULL here and the
-- raw token in arcane_text (same convention as power/power_text).
ALTER TABLE cards ADD COLUMN IF NOT EXISTS arcane integer;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS arcane_text text;
