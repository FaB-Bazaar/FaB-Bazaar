-- 0077: curated per-card strategy prose (why it's good / how it's used).
-- Curation-owned like facet_tags: written only via facetService (or admin
-- tooling), NEVER by the pipeline — registered in CARD_ADMIN_OWNED_COLS in
-- pipeline/scripts/005_weekly_printings_updater.py.
--
-- Deliberately per card_unique_id with NO same-name fan-out (unlike facet
-- tags): red and blue pitches of a card can play different roles, so each
-- variant gets its own prose. No index — display/lookup only, never filtered.

ALTER TABLE cards ADD COLUMN IF NOT EXISTS strategy_notes text;

COMMENT ON COLUMN cards.strategy_notes IS
  'Curated strategy prose (markdown). Curation-owned; pipeline must never write it.';
