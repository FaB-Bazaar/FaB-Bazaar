-- Compare the active CC and Silver Age ban registries against the official
-- lists. Reports two sections per format:
--   * MISSING: card on the official list but no active row in banned_cards
--   * EXTRA:   active row in banned_cards but card is not on the official list
--
-- Usage: docker exec -i fabbazaar-postgres psql -U fabbazaar -d fabbazaar < scripts/diff-cc-sa-bans.sql
--
-- For pitch-specific entries (e.g. Bonds of Ancestry Blue+Yellow), pitch is
-- matched explicitly. Pitch encoding: 1=red, 2=yellow, 3=blue. For entries
-- without a pitch, any pitch matches.

\echo '======================================================================'
\echo '  CLASSIC CONSTRUCTED — diff vs official list'
\echo '======================================================================'

WITH expected AS (
  SELECT lower(name) AS name, pitch
  FROM (VALUES
    -- Regular CC bans (32)
    ('art of war'::text, NULL::int),
    ('awakening', NULL),
    ('ball lightning', NULL),
    ('belittle', NULL),
    ('berserk', NULL),
    ('bloodsheath skeleta', NULL),
    ('bonds of agony', NULL),
    ('bonds of ancestry', 2),  -- yellow
    ('bonds of ancestry', 3),  -- blue
    ('brand with cinderclaw', NULL),
    ('cash in', NULL),
    ('chart the high seas', NULL),
    ('count your blessings', NULL),
    ('crown of seeds', NULL),
    ('drone of brutality', NULL),
    ('duskblade', NULL),
    ('golden tipple', 1),  -- red
    ('golden tipple', 2),  -- yellow
    ('high octane', NULL),
    ('orb-weaver spinneret', 2),  -- yellow
    ('orb-weaver spinneret', 3),  -- blue
    ('orihon of mystic tenets', NULL),
    ('plume of evergrowth', NULL),
    ('plunder run', NULL),
    ('stubby hammerers', NULL),
    ('talk a big game', NULL),
    ('tome of aetherwind', NULL),
    ('tome of divinity', NULL),
    ('tome of fyendal', NULL),
    ('tome of firebrand', NULL),
    ('wrath of retribution', NULL),
    ('zephyr needle', NULL),
    -- LL-attained CC heroes (19)
    ('aurora, shooting star', NULL),
    ('azalea, ace in the hole', NULL),
    ('bravo, star of the show', NULL),
    ('briar, warden of thorns', NULL),
    ('chane, bound by shadow', NULL),
    ('dash, inventor extraordinaire', NULL),
    ('dromai, ash artist', NULL),
    ('enigma, ledger of ancestry', NULL),
    ('florian, rotwood harbinger', NULL),
    ('iyslander, stormbind', NULL),
    ('kano, dracai of aether', NULL),
    ('kayo, armed and dangerous', NULL),
    ('lexi, livewire', NULL),
    ('nuu, alluring desire', NULL),
    ('oldhim, grandfather of eternity', NULL),
    ('prism, sculptor of arc light', NULL),
    ('verdance, thorn of the rose', NULL),
    ('viserai, rune blood', NULL),
    ('zen, tamer of purpose', NULL),
    -- LL-attained CC sig weapons (18)
    ('star fall', NULL),
    ('death dealer', NULL),
    ('rosetta thorn', NULL),
    ('galaxxi black', NULL),
    ('teklo plasma pistol', NULL),
    ('storm of sandikai', NULL),
    ('cosmo, scroll of ancestral tapestry', NULL),
    ('rotwood reaper', NULL),
    ('kraken''s aethervein', NULL),
    ('crucible of aetherweave', NULL),
    ('mandible claw', NULL),
    ('voltaire, strike twice', NULL),
    ('beckoning mistblade', NULL),
    ('winter''s wail', NULL),
    ('luminaris', NULL),
    ('staff of verdant shoots', NULL),
    ('nebula blade', NULL),
    ('tiger taming khakkara', NULL)
  ) AS t(name, pitch)
),
expected_resolved AS (
  SELECT DISTINCT e.name, e.pitch, c.card_unique_id
  FROM expected e
  LEFT JOIN cards c
    ON lower(c.name) = e.name
    AND (e.pitch IS NULL OR c.pitch = e.pitch)
),
active_cc AS (
  SELECT bc.card_unique_id, c.name, c.pitch
  FROM banned_cards bc
  JOIN cards c ON c.card_unique_id = bc.card_unique_id
  WHERE bc.format = 'classic_constructed'
    AND bc.restriction_type = 'banned'
    AND bc.status_active = true
),
missing AS (
  SELECT 'MISSING' AS status, e.name, e.pitch
  FROM expected e
  WHERE NOT EXISTS (
    SELECT 1 FROM active_cc a, cards c
    WHERE a.card_unique_id = c.card_unique_id
      AND lower(c.name) = e.name
      AND (e.pitch IS NULL OR c.pitch = e.pitch)
  )
),
extra AS (
  SELECT 'EXTRA  ' AS status, a.name, a.pitch
  FROM active_cc a
  WHERE NOT EXISTS (
    SELECT 1 FROM expected e
    WHERE lower(a.name) = e.name
      AND (e.pitch IS NULL OR a.pitch = e.pitch)
  )
)
SELECT * FROM missing
UNION ALL
SELECT * FROM extra
ORDER BY status, name, pitch;

\echo ''
\echo '======================================================================'
\echo '  SILVER AGE — diff vs official list'
\echo '======================================================================'

WITH expected AS (
  SELECT lower(name) AS name, pitch
  FROM (VALUES
    ('aether flare'::text, NULL::int),
    ('aether ironweave', NULL),
    ('aether spindle', NULL),
    ('ball lightning', NULL),
    ('belittle', NULL),
    ('bonds of ancestry', NULL),
    ('bracers of belief', NULL),
    ('burn up // shock', NULL),
    ('cash in', NULL),
    ('count your blessings', NULL),
    ('deadwood dirge', NULL),
    ('drone of brutality', NULL),
    ('electromagnetic somersault', NULL),
    ('fate foreseen', NULL),
    ('fiddler''s green', NULL),
    ('flic flak', NULL),
    ('goliath gauntlet', NULL),
    ('heartened cross strap', NULL),
    ('honing hood', NULL),
    ('lightning press', NULL),
    ('mask of three tails', NULL),
    ('nimby', NULL),
    ('old knocker', NULL),
    ('plunder run', NULL),
    ('ragamuffin''s hat', NULL),
    ('reality refractor', NULL),
    ('rosetta thorn', NULL),
    ('seeds of agony', NULL),
    ('sigil of solace', NULL),
    ('sink below', NULL),
    ('sirens of safe harbor', NULL),
    ('snapdragon scalers', NULL),
    ('steelblade shunt', NULL),
    ('stubby hammerers', NULL),
    ('vest of the first fist', NULL),
    ('vigorous smashup', NULL),
    ('waning moon', NULL),
    ('zephyr needle', NULL)
  ) AS t(name, pitch)
),
active_sa AS (
  SELECT bc.card_unique_id, c.name, c.pitch
  FROM banned_cards bc
  JOIN cards c ON c.card_unique_id = bc.card_unique_id
  WHERE bc.format = 'silver_age'
    AND bc.restriction_type = 'banned'
    AND bc.status_active = true
),
missing AS (
  SELECT 'MISSING' AS status, e.name, e.pitch
  FROM expected e
  WHERE NOT EXISTS (
    SELECT 1 FROM active_sa a, cards c
    WHERE a.card_unique_id = c.card_unique_id
      AND lower(c.name) = e.name
      AND (e.pitch IS NULL OR c.pitch = e.pitch)
  )
),
-- For SA, expected list is name-only (any pitch matches).
-- An "extra" registry row is one where the card NAME doesn't appear in the expected list.
extra AS (
  SELECT DISTINCT 'EXTRA  ' AS status, a.name, NULL::int AS pitch
  FROM active_sa a
  WHERE NOT EXISTS (
    SELECT 1 FROM expected e WHERE lower(a.name) = e.name
  )
)
SELECT * FROM missing
UNION ALL
SELECT * FROM extra
ORDER BY status, name, pitch;
