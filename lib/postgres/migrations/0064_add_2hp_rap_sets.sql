-- 0064: register the foreign-language-exclusive supplemental sets
-- History Pack Vol.2 (2HP) and RAP, so their printings render with a set name
-- instead of the raw code. These sets have no English printings of their own;
-- their cards are anchored to English printings in other sets.
--
-- Ordering values are appended at the end (MAX+1) so they can't collide with
-- the existing unique release_order / display_order. Idempotent via ON CONFLICT.

INSERT INTO sets (
  code, display_code, name, release_date,
  release_order, display_order,
  category, tier, is_core, has_first_edition, unlimited_before_first
) VALUES (
  '2hp', '2HP', 'History Pack Vol.2', NULL,
  (SELECT COALESCE(MAX(release_order), 0) + 1 FROM sets),
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sets),
  'standard', 2, false, false, false
) ON CONFLICT (code) DO NOTHING;

INSERT INTO sets (
  code, display_code, name, release_date,
  release_order, display_order,
  category, tier, is_core, has_first_edition, unlimited_before_first
) VALUES (
  'rap', 'RAP', 'Archive Pack - Rosetta', NULL,
  (SELECT COALESCE(MAX(release_order), 0) + 1 FROM sets),
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sets),
  'non-standard', 5, false, false, false
) ON CONFLICT (code) DO NOTHING;
