-- Add `language` to printings: which language the physical printing was
-- produced in. Drives image selection (the French print of WTR150 carries
-- different art than the English print) and is independent of the viewer's
-- preferred display language (that comes from a separate user setting and
-- the card_translations table — migration 0052).
--
-- Convention: lowercase ISO 639-1 codes ('en', 'fr', 'de', 'it', 'es', 'ja').
-- NOTE: `inventory_items.language` predates this and uses UPPERCASE ('EN').
-- Not harmonized here to avoid touching existing data. Joins between the two
-- columns must lower()/upper() one side.
--
-- Backfill: every existing row becomes 'en' via the column DEFAULT — no
-- separate UPDATE needed.

ALTER TABLE printings
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_printings_language
  ON printings(language);
