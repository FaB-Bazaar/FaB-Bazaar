-- Add original-case `keywords_display` column to cards.
-- Pairs with the existing lowercase `keywords` column the same way `display_name`
-- pairs with `name` and `type_text_display` pairs with `type_text`.
--
-- `keywords` continues to be lowercased for search/filter (e.g. ARRAY ops, ILIKE).
-- `keywords_display` preserves source casing (e.g. "Go Again", "Ward 10") for UI.
--
-- After applying, run pipeline 005_weekly_printings_updater.py against the
-- enhanced cards file to backfill the new column for existing rows. Until then,
-- existing rows have an empty array; frontends should fall back to `keywords`.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS keywords_display text[] NOT NULL DEFAULT ARRAY[]::text[];
