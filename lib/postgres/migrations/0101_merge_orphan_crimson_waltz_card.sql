-- 0101: Merge the orphaned non-English Crimson Waltz (MPW064) onto its real card
--
-- import-i18n.ts landed the fr + ja printings of MPW064 on a card row of their
-- own instead of the English card, and that row carries stale spoiler-era stats
-- (pitch 1 / cost 1 / no colour). The real card — anchored to fab-cube, pitch 2,
-- cost 2, yellow — is correct and matches the printed card.
--
-- Consequence while split: language-aware search joins on
-- (card_unique_id, printings.language), so the French/Japanese Crimson Waltz is
-- unreachable — a fr/ja viewer always falls back to the English printing — and
-- the card shows up twice in search with one entry's stats wrong.
--
-- This is a ONE-OFF: a DB-wide sweep found exactly one card row holding foreign
-- printings with no English printing of its own (4 printings, this card).
--
-- Predicate-matched rather than keyed on nanoids: printing_id / card_unique_id
-- are minted per environment for CardVault-ingested rows. Every statement is a
-- no-op if the shape does not match, so this is safe to re-run and safe on an
-- environment where the merge already happened.

-- 1. Translations move first — they are the phantom's only unique payload, and
--    the card row FK cascades, so deleting before moving would destroy them.
UPDATE card_translations tr
   SET card_unique_id = real_card.card_unique_id
  FROM cards phantom, cards real_card
 WHERE tr.card_unique_id = phantom.card_unique_id
   AND phantom.name = 'crimson waltz' AND phantom.pitch = 1
   AND phantom.fab_cube_card_id IS NULL
   AND real_card.name = 'crimson waltz' AND real_card.pitch = 2
   AND real_card.fab_cube_card_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM card_translations existing
      WHERE existing.card_unique_id = real_card.card_unique_id
        AND existing.language = tr.language);

-- 2. Re-point the fr/ja printings. printing_id is untouched, so any binder,
--    deck or wants row referencing them keeps working; they simply inherit the
--    correct pitch/cost/colour, which live on the card row.
UPDATE printings p
   SET card_unique_id = real_card.card_unique_id
  FROM cards phantom, cards real_card
 WHERE p.card_unique_id = phantom.card_unique_id
   AND phantom.name = 'crimson waltz' AND phantom.pitch = 1
   AND phantom.fab_cube_card_id IS NULL
   AND real_card.name = 'crimson waltz' AND real_card.pitch = 2
   AND real_card.fab_cube_card_id IS NOT NULL;

-- 3. Drop the now-empty phantom. The NOT EXISTS guard means that if step 2 left
--    anything behind, the row survives instead of tripping the printings FK.
DELETE FROM cards phantom
 WHERE phantom.name = 'crimson waltz' AND phantom.pitch = 1
   AND phantom.fab_cube_card_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM printings p WHERE p.card_unique_id = phantom.card_unique_id);
