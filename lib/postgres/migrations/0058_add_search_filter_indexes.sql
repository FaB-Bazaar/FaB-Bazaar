-- Search filter indexes
--
-- The card search filters on array-overlap (&&) over cards.{types,keywords,
-- classes,talents,traits} and sorts/filters on printings.tcg_low, all of which
-- previously forced sequential scans. Measured on the local dev DB (4.8k cards /
-- 40k printings) via EXPLAIN ANALYZE:
--   * GIN on cards.types         : grouped page load 21.9ms -> 7.7ms; count 8.3ms -> 3.9ms
--   * GIN on cards.keywords      : enables BitmapAnd with types (keyword+type queries)
--   * btree on printings.tcg_low : price-sorted page 12-20ms -> 0.5-0.8ms (~25x)
--   * (language, card_unique_id) : grouped DISTINCT-ON count 8.3ms -> 3.9ms (index-only scan)
-- These matter more as the catalog grows.

-- GIN indexes for `&&` array-overlap on the card facet arrays.
CREATE INDEX IF NOT EXISTS idx_cards_types_gin    ON cards USING GIN (types);
CREATE INDEX IF NOT EXISTS idx_cards_keywords_gin ON cards USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_cards_classes_gin  ON cards USING GIN (classes);
CREATE INDEX IF NOT EXISTS idx_cards_talents_gin  ON cards USING GIN (talents);
CREATE INDEX IF NOT EXISTS idx_cards_traits_gin   ON cards USING GIN (traits);

-- btree on price for range filters AND the "sort by price" path (pre-sorted,
-- NULLS LAST to match the service's ORDER BY tcg_low ASC NULLS LAST).
CREATE INDEX IF NOT EXISTS idx_printings_tcg_low ON printings (tcg_low ASC NULLS LAST);

-- Composite for the grouped (DISTINCT ON card_unique_id) path: lets the language
-- filter + per-card grouping run as an index-only scan instead of a full hash join.
CREATE INDEX IF NOT EXISTS idx_printings_lang_card_id ON printings (language, card_unique_id);
