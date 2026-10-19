-- 0127: GEM212 (GEM Pack 6 Seek Vengeance) is the BLUE card, not the red one.
--
-- Why: CardVault files print GEM212 under `seek-vengeance-1` (pitch 1, power 4)
-- and lists ASR012 (red) as its other languages, but its own card image shows
-- the blue printing: three pitch pips, blue strip, power 2. TCGplayer's product
-- (719529) names no pitch, and the fab-cube feed has no GEM212 yet. The
-- CardVault ingest copied LSS's link, so both GEM212 rows (non-foil + rainbow)
-- sat under the red card: the binder Add Card dialog showed them only under
-- red Seek Vengeance with the red card's stats, and users holding the blue card
-- couldn't find it. Checked the rest of GEM Pack 6 (image pitch strip vs
-- CardVault pitch, 2026-10-19): GEM212 is the only mislink.
--
-- Both rows are provisional (fab_cube_printing_id IS NULL), so neither 005 nor
-- a CardVault re-import (existing lss_print_id rows are skipped) rewrites
-- card_unique_id. Once fab-cube adopts GEM212, 005 takes the feed's card —
-- re-check then.
--
-- Keyed by natural key, not printing ids, and guarded on the current card's
-- pitch, so it is idempotent and a no-op on DBs without these rows.

UPDATE printings p
SET card_unique_id = blue.card_unique_id
FROM cards cur,
     (SELECT c.card_unique_id
        FROM printings bp JOIN cards c USING (card_unique_id)
       WHERE bp.collector_number = 'ASR022' AND bp.language = 'en'
         AND c.name ILIKE 'seek vengeance' AND c.pitch = 3
       LIMIT 1) blue
WHERE p.card_unique_id = cur.card_unique_id
  AND p.set = 'gem'
  AND p.collector_number = 'GEM212'
  AND cur.name ILIKE 'seek vengeance'
  AND cur.pitch = 1;
