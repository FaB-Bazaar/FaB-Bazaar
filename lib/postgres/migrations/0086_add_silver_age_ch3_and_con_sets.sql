-- 0086: register the Silver Age Chapter 3 decks (SBA Briar, SBL Boltyn,
-- SBZ Blaze, SGB Gravy Bones, SLY Lyath Goldmane; released 2026-06-05) and
-- the Convention Promos pool (CON001-004, rainbow-foil promos — same shape
-- as OXO), whose printings were ingested without matching `sets` rows
-- (the PostgresSetsService orphan-code drift).
--
-- Names use the established "Silver Age Deck: <hero>" prefix — the /opt
-- deck-product filter groups derive Silver Age membership from that prefix
-- (SET_FILTER_GROUPS in lib/fab-constants/sets.ts).
--
-- Ordering values append at MAX+1 (release_order / display_order are both
-- globally unique and fully packed through 1122 — same approach as 0064).
-- Idempotent via ON CONFLICT. After applying, regenerate the constants
-- snapshot: npx tsx --env-file=.env.local scripts/generate-set-constants.ts

INSERT INTO sets (
  code, display_code, name, release_date,
  release_order, display_order,
  category, tier, is_core, has_first_edition, unlimited_before_first
) VALUES (
  'sba', 'SBA', 'Silver Age Deck: Briar', '2026-06-05',
  (SELECT COALESCE(MAX(release_order), 0) + 1 FROM sets),
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sets),
  'non-standard', 3, false, false, false
) ON CONFLICT (code) DO NOTHING;

INSERT INTO sets (
  code, display_code, name, release_date,
  release_order, display_order,
  category, tier, is_core, has_first_edition, unlimited_before_first
) VALUES (
  'sbl', 'SBL', 'Silver Age Deck: Boltyn', '2026-06-05',
  (SELECT COALESCE(MAX(release_order), 0) + 1 FROM sets),
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sets),
  'non-standard', 3, false, false, false
) ON CONFLICT (code) DO NOTHING;

INSERT INTO sets (
  code, display_code, name, release_date,
  release_order, display_order,
  category, tier, is_core, has_first_edition, unlimited_before_first
) VALUES (
  'sbz', 'SBZ', 'Silver Age Deck: Blaze', '2026-06-05',
  (SELECT COALESCE(MAX(release_order), 0) + 1 FROM sets),
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sets),
  'non-standard', 3, false, false, false
) ON CONFLICT (code) DO NOTHING;

INSERT INTO sets (
  code, display_code, name, release_date,
  release_order, display_order,
  category, tier, is_core, has_first_edition, unlimited_before_first
) VALUES (
  'sgb', 'SGB', 'Silver Age Deck: Gravy Bones', '2026-06-05',
  (SELECT COALESCE(MAX(release_order), 0) + 1 FROM sets),
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sets),
  'non-standard', 3, false, false, false
) ON CONFLICT (code) DO NOTHING;

INSERT INTO sets (
  code, display_code, name, release_date,
  release_order, display_order,
  category, tier, is_core, has_first_edition, unlimited_before_first
) VALUES (
  'sly', 'SLY', 'Silver Age Deck: Lyath Goldmane', '2026-06-05',
  (SELECT COALESCE(MAX(release_order), 0) + 1 FROM sets),
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sets),
  'non-standard', 3, false, false, false
) ON CONFLICT (code) DO NOTHING;

INSERT INTO sets (
  code, display_code, name, release_date,
  release_order, display_order,
  category, tier, is_core, has_first_edition, unlimited_before_first
) VALUES (
  'con', 'CON', 'Convention Promos', NULL,
  (SELECT COALESCE(MAX(release_order), 0) + 1 FROM sets),
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM sets),
  'non-standard', 5, false, false, false
) ON CONFLICT (code) DO NOTHING;
