-- 0062_add_sets_display_order.sql
-- Curated printing-display ordering for sets. sortPrintings (and any other
-- printing carousel/picker ordering) ranks a printing's SET by this single
-- number instead of re-deriving tier → release-date order in code, so the
-- order can be hand-curated per row: UPDATE sets SET display_order = …, then
-- regenerate the constants snapshot (scripts/generate-set-constants.ts).
--
-- Seeded from the previously-derived order so behavior is unchanged until a
-- row is curated: tier display position (1 main → 2 supplemental → 5 promo →
-- 3 blitz/hero → 4 armory), then release date (oldest first, NULLs last),
-- then code. Spaced by 10 so new sets slot in without renumbering.

ALTER TABLE sets ADD COLUMN IF NOT EXISTS display_order integer;

WITH ranked AS (
  SELECT code,
         (ROW_NUMBER() OVER (
           ORDER BY
             CASE tier WHEN 1 THEN 0 WHEN 2 THEN 1 WHEN 5 THEN 2 WHEN 3 THEN 3 WHEN 4 THEN 4 ELSE 5 END,
             release_date ASC NULLS LAST,
             code
         )) * 10 AS ord
  FROM sets
)
UPDATE sets s
SET display_order = r.ord
FROM ranked r
WHERE s.code = r.code AND s.display_order IS NULL;

ALTER TABLE sets ALTER COLUMN display_order SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sets_display_order_key') THEN
    ALTER TABLE sets ADD CONSTRAINT sets_display_order_key UNIQUE (display_order);
  END IF;
END $$;
