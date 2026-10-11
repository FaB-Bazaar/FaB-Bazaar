-- 0125: CardVault-ingested (provisional) cards get a color derived from pitch.
--
-- Why: the CardVault importer (buildProvisionalCard in
-- lib/import/cardvault-ingest.ts) never set cards.color, so every pitched
-- provisional card had pitch but no color — 227 locally on 2026-10-11 (216 in
-- IAR, plus AMA/GEM/FAB/JDG/MPA/LGS spoilers). The color filter (color:blue,
-- the red/yellow/blue chips) silently missed them until fab-cube adopted each
-- card. In the fab-cube feed color is exactly pitch (1 red, 2 yellow, 3 blue
-- across all 4,036 anchored pitched cards); gems (pitch 4) are colorless.
--
-- The importer now emits color the same way; this brings existing provisional
-- rows to that shape. Anchored rows are fab-cube-owned and untouched.
--
-- Idempotent: only provisional rows with no color are touched.

UPDATE cards
SET color = CASE pitch WHEN 1 THEN 'red' WHEN 2 THEN 'yellow' WHEN 3 THEN 'blue' END
WHERE fab_cube_card_id IS NULL
  AND color IS NULL
  AND pitch IN (1, 2, 3);
