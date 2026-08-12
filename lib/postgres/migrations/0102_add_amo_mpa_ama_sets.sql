-- 0102: register the fall 2026 Assassin/Necromancer supplemental products,
-- spoiled on CardVault 2026-08-12:
--   AMA  Armory Deck: Malice        (releases 2026-09-25, with Usurp the Shadow Throne)
--   AMO  Armory Deck: Dr. Mortimer  (releases 2026-11-13)
--   MPA  Mastery Pack Assassin      (releases 2026-11-13)
--
-- Armory decks follow the AOL/AZS shape: category='armory', tier 4, both
-- ordering values appended at MAX+1 (the /opt deck-product filter derives
-- Armory group membership from category='armory').
--
-- The mastery pack follows the MPW precedent set by migration 0097:
-- category='standard', tier 2, display_order right after MPW's 400 (the
-- printing-carousel rank for supplemental products; 401 is a free slot),
-- release_order appended at MAX+1.
--
-- Idempotent via ON CONFLICT. After applying, regenerate the constants
-- snapshot: npx tsx --env-file=.env.local scripts/generate-set-constants.ts

INSERT INTO sets (
  code, display_code, name, release_date,
  release_order, display_order,
  category, tier, is_core, has_first_edition, unlimited_before_first
) VALUES (
  'ama', 'AMA', 'Armory Deck: Malice', '2026-09-25',
  (SELECT COALESCE(MAX(release_order), 0) + 1 FROM sets),
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sets),
  'armory', 4, false, false, false
) ON CONFLICT (code) DO NOTHING;

INSERT INTO sets (
  code, display_code, name, release_date,
  release_order, display_order,
  category, tier, is_core, has_first_edition, unlimited_before_first
) VALUES (
  'amo', 'AMO', 'Armory Deck: Dr. Mortimer', '2026-11-13',
  (SELECT COALESCE(MAX(release_order), 0) + 1 FROM sets),
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sets),
  'armory', 4, false, false, false
) ON CONFLICT (code) DO NOTHING;

INSERT INTO sets (
  code, display_code, name, release_date,
  release_order, display_order,
  category, tier, is_core, has_first_edition, unlimited_before_first
) VALUES (
  'mpa', 'MPA', 'Mastery Pack Assassin', '2026-11-13',
  (SELECT COALESCE(MAX(release_order), 0) + 1 FROM sets),
  401,
  'standard', 2, false, false, false
) ON CONFLICT (code) DO NOTHING;
