-- 0129: Pirate is a CLASS on CardVault-ingested (provisional) cards too.
--
-- Why: the CardVault ingest (lib/import/cardvault-ingest.ts) listed 'pirate'
-- among the TALENTS, so Favorable Winds (IAR251, "Pirate Ranger Action")
-- landed as classes {ranger}, talents {pirate}. The precise hero-legality
-- check needs the hero to hold every class AND share the talent, and no hero
-- has a Pirate talent, so the card was missing from Marlynn's deck search and
-- FaBrary imports. Same mistake 0065/0104 fixed for the fab-cube transformer.
-- The ingest is fixed. This rewrites existing rows in the ingest's new shape:
-- classes = class tokens of `types` in typebox order, pirate dropped from
-- talents, combination flags recomputed with the ingest's (= 003's) formulas.
-- has_pirate stays true (it is the Pirate class flag; there is no is_pirate).
--
-- Provisional rows only (fab_cube_card_id IS NULL): fab-cube cards already
-- come from 003 in class form, and adoption overwrites these with feed truth.
-- Idempotent: after one run no provisional row carries a pirate talent.

WITH fixed AS (
  SELECT c.card_unique_id,
         ARRAY(
           SELECT t FROM unnest(c.types) WITH ORDINALITY AS u(t, i)
            WHERE t = ANY (ARRAY['generic','brute','guardian','mechanologist','ranger','runeblade',
                                 'assassin','warrior','ninja','wizard','merchant','bard','adjudicator',
                                 'illusionist','thief','shapeshifter','necromancer','pirate'])
            ORDER BY i
         ) AS classes,
         array_remove(c.talents, 'pirate') AS talents
    FROM cards c
   WHERE c.fab_cube_card_id IS NULL
     AND 'pirate' = ANY (c.talents)
)
UPDATE cards c
SET classes = f.classes,
    talents = f.talents,
    has_pirate = true,
    is_generic_only      = (f.classes = ARRAY['generic'] AND cardinality(f.talents) = 0),
    has_class_and_talent = (cardinality(f.classes) > 0 AND cardinality(f.talents) > 0 AND f.classes <> ARRAY['generic']),
    has_class_only       = (cardinality(f.classes) > 0 AND cardinality(f.talents) = 0 AND f.classes <> ARRAY['generic']),
    has_talent_only      = (cardinality(f.classes) <= 1 AND 'generic' = ANY (f.classes) AND cardinality(f.talents) > 0)
FROM fixed f
WHERE c.card_unique_id = f.card_unique_id;
