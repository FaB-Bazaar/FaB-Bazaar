-- 0065_reclassify_pirate_as_class.sql
--
-- Pirate is a CLASS in Flesh and Blood (dual-class heroes like Puffin =
-- "Pirate Mechanologist", Marlynn = "Pirate Ranger"), but the source card data
-- filed "pirate" under the talents array instead of classes. Move it so pirate
-- behaves as a real class everywhere (card search, who-has, deck building,
-- hero-pool legality).
--
-- Hero and non-hero cards are reclassified together, keeping hero pools
-- consistent (the hero card's own classes/talents move the same way as its
-- pool cards). Idempotent: only rows that still carry pirate-in-talents and do
-- not already have pirate-in-classes are touched.

UPDATE cards
SET classes = array_append(classes, 'pirate'),
    talents = array_remove(talents, 'pirate')
WHERE 'pirate' = ANY(talents)
  AND NOT ('pirate' = ANY(classes));
