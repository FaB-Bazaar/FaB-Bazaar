-- 0097: MPW (Mastery Pack Warrior) belongs under Standard Sets on /sets.
-- It was registered as non-standard/tier-5, which put it in the promo bucket
-- of the /sets page. Mastery Packs are standalone supplemental products, so
-- follow the History Pack precedent: category='standard', tier=2.
--
-- display_order stays at 400 (printing-carousel rank after the mainline
-- boosters — correct for a supplemental product) and is_core stays false
-- (not a mainline booster set, unlike IAR in migration 0091).
--
-- Idempotent: only matches the non-standard shape.

UPDATE sets
   SET category = 'standard',
       tier = 2
 WHERE code = 'mpw'
   AND category = 'non-standard';
