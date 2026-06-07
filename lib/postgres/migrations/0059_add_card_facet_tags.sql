-- Card facet classification — curated, interpretive "what a card does" tags.
-- Vocabulary (allowed tag values) lives in lib/search/card-facets.ts.
--
-- Two structures:
--   card_facet_tags  — curated SOURCE OF TRUTH (one row per card_unique_id × tag).
--   cards.facet_tags — denormalized SEARCH PROJECTION (text[] + GIN), rebuilt from
--                      the table by scripts/load-card-facets (table → column).
--
-- OWNERSHIP: both are curation-owned. The data pipeline must NEVER overwrite
-- cards.facet_tags — it is registered in CARD_ADMIN_OWNED_COLS in
-- pipeline/scripts/005_weekly_printings_updater.py and starts empty.

CREATE TABLE IF NOT EXISTS card_facet_tags (
  card_unique_id text NOT NULL REFERENCES cards(card_unique_id) ON DELETE CASCADE,
  tag            text NOT NULL,
  PRIMARY KEY (card_unique_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_card_facet_tags_tag ON card_facet_tags (tag);

-- Denormalized projection for fast single-table search (facet_tags && ARRAY[...]).
ALTER TABLE cards ADD COLUMN IF NOT EXISTS facet_tags text[] NOT NULL DEFAULT ARRAY[]::text[];
CREATE INDEX IF NOT EXISTS idx_cards_facet_tags_gin ON cards USING GIN (facet_tags);
