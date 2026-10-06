-- 0123: sets.in_card_filters — filter-chip membership becomes data
--
-- CARD_FILTER_SETS (lib/fab-constants/sets.ts) was a hand-edited list: a new
-- standard set showed up in the binder / search / wants set chips only after a
-- code change + deploy. The runtime set overlay (lib/fab-constants/
-- set-overlay.ts) now reads this column: TRUE adds a set to the chips (newest
-- first), FALSE removes it, NULL follows the compiled list. Backfilled TRUE for
-- exactly today's list, so nothing changes on deploy. Idempotent.

ALTER TABLE sets ADD COLUMN IF NOT EXISTS in_card_filters BOOLEAN;

UPDATE sets SET in_card_filters = TRUE
 WHERE in_card_filters IS NULL
   AND code IN ('mpa', 'mpw', 'iar', 'omn', 'pen', 'anq', 'sup', 'mpg', 'sea', 'hnt', 'ros', 'mst', 'hvy', 'evo', 'dtd', 'out', 'dyn', 'upr', '1hp', 'evr', 'ele', 'mon', 'cru', 'arc', 'wtr');
