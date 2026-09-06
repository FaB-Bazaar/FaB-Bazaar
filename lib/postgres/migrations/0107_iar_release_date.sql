-- 0107: IAR (Usurp the Shadow Throne) releases 2026-09-25 (fabtcg.com
-- pre-release FAQ; same day as Armory Deck: Malice). The row still carried
-- OMN's 2026-06-05 as a placeholder from drift registration (see 0091:
-- "Update it on announcement"). With a past date the set was invisible to
-- the Future Classic Constructed pool (sets.release_date > CURRENT_DATE), so
-- IAR-only cards like Violent Gusto (IAR228) were missing from Future CC.
-- Idempotent: only matches the placeholder date.

UPDATE sets
   SET release_date = '2026-09-25',
       updated_at = NOW()
 WHERE code = 'iar'
   AND release_date = '2026-06-05';
