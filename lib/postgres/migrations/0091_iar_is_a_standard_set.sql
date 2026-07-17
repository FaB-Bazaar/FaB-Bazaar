-- 0091: IAR (Usurp the Shadow Throne) is set 20 — a mainline standard
-- release. The drift-handler registered it as non-standard/tier-5 when the
-- OMN-era preview marvels first appeared, which (a) miscategorizes it and
-- (b) hides it from /sets entirely: getOrderedSets shows category='standard'
-- sets plus only the hardcoded NON_STANDARD_ORDER codes, and 'iar' is in
-- neither.
--
-- display_order 195 slots the printing-carousel ranking between OMN (190)
-- and History Pack Vol.1 (200) — the slot is free.
--
-- release_date stays at the placeholder (OMN's date, inherited at drift
-- registration) until LSS announces the real one: /sets orders standard sets
-- by releaseDate, and a NULL would NaN the sort. Update it on announcement.
--
-- Idempotent: only matches the drift-registered shape.

UPDATE sets
   SET category = 'standard',
       tier = 1,
       is_core = true,
       display_order = 195
 WHERE code = 'iar'
   AND category = 'non-standard';
