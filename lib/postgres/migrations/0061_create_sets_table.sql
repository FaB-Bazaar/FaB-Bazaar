-- 0061_create_sets_table.sql
-- Normalized set metadata — SOURCE OF TRUTH for set names, release dates,
-- release ordering, category/tier, and core-set status. Replaces the scattered
-- compile-time constants (lib/fab-constants/sets.ts SET_MAP + SET_METADATA,
-- lib/set-images.ts SET_IMAGES) so new sets / corrections are a row edit, not
-- a deploy. lib/fab-constants stays as a generated client-side snapshot
-- (regenerated from this table by scripts/generate-set-constants.ts).
--
-- Seed data reconciled 2026-06-11 from: the-fab-cube set.json (canonical codes
-- + per-edition release dates; fixed 47 wrong dates in SET_METADATA, mostly
-- armory decks), SET_MAP display names, SET_METADATA category/tier flags, and
-- SET_IMAGES Cloudflare ids. `iar` = Íarathael Preview Cards (future-set
-- previews rarely inserted in Omens packs, treated as a standalone set).
--
-- release_order is a global chronological ordering spaced by 10 so future
-- sets slot in without renumbering. is_core = main booster sets ("core" in
-- the SET_MAP sense): category 'standard' AND tier 1.

CREATE TABLE IF NOT EXISTS sets (
  code                    text PRIMARY KEY,          -- lowercase, matches printings.set
  display_code            text NOT NULL,             -- e.g. 'WTR'
  name                    text NOT NULL,             -- display name
  release_date            date,                      -- first product release (NULL = unannounced)
  release_order           integer NOT NULL UNIQUE,
  category                text NOT NULL DEFAULT 'non-standard'
                            CHECK (category IN ('standard', 'armory', 'non-standard', 'excluded')),
  tier                    smallint NOT NULL DEFAULT 5 CHECK (tier BETWEEN 1 AND 5),
  is_core                 boolean NOT NULL DEFAULT false,
  has_first_edition       boolean NOT NULL DEFAULT false,
  unlimited_before_first  boolean NOT NULL DEFAULT false,  -- WTR/ARC/CRU/MON: unlimited is the accessible printing
  default_rarity          text,
  image_id                text,                      -- Cloudflare image id (set logo)
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sets_release_order ON sets (release_order);

INSERT INTO sets (code, display_code, name, release_date, release_order, category, tier, is_core, has_first_edition, unlimited_before_first, default_rarity, image_id) VALUES
  ('ira', 'IRA', 'Welcome Deck: Ira', '2019-08-31', 10, 'excluded', 3, false, false, false, NULL, NULL),
  ('wtr', 'WTR', 'Welcome to Rathe', '2019-10-11', 20, 'standard', 1, true, true, true, NULL, '662cd0af-99ab-4841-bf69-95340c122700'),
  ('bvo', 'BVO', 'Hero Deck: Bravo', '2019-10-11', 30, 'non-standard', 3, false, false, false, NULL, NULL),
  ('ksu', 'KSU', 'Hero Deck: Katsu', '2019-10-11', 40, 'non-standard', 3, false, false, false, NULL, NULL),
  ('rnr', 'RNR', 'Hero Deck: Rhinar', '2019-10-11', 50, 'non-standard', 3, false, false, false, NULL, NULL),
  ('tea', 'TEA', 'Hero Deck: Dorinthea', '2019-10-11', 60, 'non-standard', 3, false, false, false, NULL, NULL),
  ('fab', 'FAB', 'Flesh and Blood: Promo Cards', '2019-10-11', 70, 'non-standard', 5, false, false, false, NULL, '733780de-03aa-4a4a-c754-e0d5771cf300'),
  ('her', 'HER', 'Hero Card Promos', '2019-10-11', 80, 'non-standard', 5, false, false, false, NULL, NULL),
  ('jdg', 'JDG', 'Judge Promos', '2019-10-11', 90, 'non-standard', 5, false, false, false, NULL, NULL),
  ('lgs', 'LGS', 'Local Game Store Promos', '2019-10-11', 100, 'non-standard', 5, false, false, false, NULL, NULL),
  ('lss', 'LSS', 'LSS Promos', '2019-10-11', 110, 'non-standard', 5, false, false, false, NULL, NULL),
  ('tnp', 'TNP', 'Tournament Prize Cards', '2019-10-11', 120, 'non-standard', 5, false, false, false, NULL, NULL),
  ('win', 'WIN', 'Worlds / Pro Tour Prize Cards', '2019-10-11', 130, 'non-standard', 5, false, false, false, NULL, NULL),
  ('xxx', 'XXX', 'OP Event Tokens', '2019-10-11', 140, 'excluded', 5, false, false, false, NULL, NULL),
  ('arc', 'ARC', 'Arcane Rising', '2020-03-27', 150, 'standard', 1, true, true, true, NULL, '1ddbff85-ebe1-48c5-3f4f-a07e76b10d00'),
  ('cru', 'CRU', 'Crucible of War', '2020-08-28', 160, 'standard', 1, true, true, true, NULL, '73447dd1-5812-4c90-ec79-a33b018c2600'),
  ('mon', 'MON', 'Monarch', '2021-05-07', 170, 'standard', 1, true, true, true, NULL, 'ed110d5d-d334-4d1b-fdd0-90457a7ae200'),
  ('bol', 'BOL', 'Blitz Deck: Monarch - Boltyn', '2021-05-07', 180, 'non-standard', 3, false, false, false, NULL, NULL),
  ('chn', 'CHN', 'Blitz Deck: Monarch - Chane', '2021-05-07', 190, 'non-standard', 3, false, false, false, NULL, NULL),
  ('lev', 'LEV', 'Blitz Deck: Monarch - Levia', '2021-05-07', 200, 'non-standard', 3, false, false, false, NULL, NULL),
  ('psm', 'PSM', 'Blitz Deck: Monarch - Prism', '2021-05-07', 210, 'non-standard', 3, false, false, false, NULL, NULL),
  ('ele', 'ELE', 'Tales of Aria', '2021-09-24', 220, 'standard', 1, true, true, false, NULL, '6c47e6cb-7ce0-4219-9c81-5a80557b7f00'),
  ('bri', 'BRI', 'Blitz Deck: Tales of Aria - Briar', '2021-11-24', 230, 'non-standard', 3, false, false, false, NULL, NULL),
  ('lxi', 'LXI', 'Blitz Deck: Tales of Aria - Lexi', '2021-11-24', 240, 'non-standard', 3, false, false, false, NULL, NULL),
  ('old', 'OLD', 'Blitz Deck: Tales of Aria - Oldhim', '2021-11-24', 250, 'non-standard', 3, false, false, false, NULL, NULL),
  ('evr', 'EVR', 'Everfest', '2022-02-04', 260, 'standard', 1, true, false, false, NULL, '403c910a-bbfc-4670-8ade-e430b7518100'),
  ('1hp', '1HP', 'History Pack Vol.1', '2022-05-06', 270, 'standard', 2, false, false, false, NULL, '232cc691-4946-4f29-a908-52e327666600'),
  ('dvr', 'DVR', 'Classic Battles: Rhinar vs Dorinthea', '2022-05-27', 280, 'non-standard', 2, false, false, false, NULL, NULL),
  ('rvd', 'RVD', 'Classic Battles: Rhinar vs Dorinthea - Rhinar', '2022-05-27', 290, 'non-standard', 2, false, false, false, NULL, NULL),
  ('upr', 'UPR', 'Uprising', '2022-06-24', 300, 'standard', 1, true, false, false, NULL, 'f5c4b4f6-1cb8-4f78-c5d0-835c80bfa700'),
  ('dro', 'DRO', 'Blitz Deck: Uprising - Dromai', '2022-06-24', 310, 'non-standard', 3, false, false, false, NULL, NULL),
  ('fai', 'FAI', 'Blitz Deck: Uprising - Fai', '2022-06-24', 320, 'non-standard', 3, false, false, false, NULL, NULL),
  ('dyn', 'DYN', 'Dynasty', '2022-11-11', 330, 'standard', 1, true, false, false, NULL, '71642461-5479-4dd2-a6e9-de3b41c62900'),
  ('1hb', '1HB', 'Historic Pack 1 Blitz Deck: Bravo', '2023-02-24', 340, 'non-standard', 3, false, false, false, NULL, NULL),
  ('1hd', '1HD', 'Historic Pack 1 Blitz Deck: Dash', '2023-02-24', 350, 'non-standard', 3, false, false, false, NULL, NULL),
  ('1hk', '1HK', 'Historic Pack 1 Blitz Deck: Kano', '2023-02-24', 360, 'non-standard', 3, false, false, false, NULL, NULL),
  ('1hr', '1HR', 'Historic Pack 1 Blitz Deck: Rhinar', '2023-02-24', 370, 'non-standard', 3, false, false, false, NULL, NULL),
  ('1ht', '1HT', 'Historic Pack 1 Blitz Deck: Dorinthea', '2023-02-24', 380, 'non-standard', 3, false, false, false, NULL, NULL),
  ('1hv', '1HV', 'Historic Pack 1 Blitz Deck: Viserai', '2023-02-24', 390, 'non-standard', 3, false, false, false, NULL, NULL),
  ('out', 'OUT', 'Outsiders', '2023-03-24', 400, 'standard', 1, true, false, false, NULL, 'e73606b1-8199-4656-dfb7-8653bc4d1900'),
  ('ara', 'ARA', 'Blitz Deck: Outsiders - Arakni', '2023-03-24', 410, 'non-standard', 3, false, false, false, NULL, NULL),
  ('azl', 'AZL', 'Blitz Deck: Outsiders - Azalea', '2023-03-24', 420, 'non-standard', 3, false, false, false, NULL, NULL),
  ('ben', 'BEN', 'Blitz Deck: Outsiders - Benji', '2023-03-24', 430, 'non-standard', 3, false, false, false, NULL, NULL),
  ('kat', 'KAT', 'Blitz Deck: Outsiders - Katsu', '2023-03-24', 440, 'non-standard', 3, false, false, false, NULL, NULL),
  ('rip', 'RIP', 'Blitz Deck: Outsiders - Riptide', '2023-03-24', 450, 'non-standard', 3, false, false, false, NULL, NULL),
  ('uzu', 'UZU', 'Blitz Deck: Outsiders - Uzuri', '2023-03-24', 460, 'non-standard', 3, false, false, false, NULL, NULL),
  ('dtd', 'DTD', 'Dusk till Dawn', '2023-07-23', 470, 'standard', 1, true, false, false, NULL, 'dea06055-da1c-41a9-75a8-7d8625e81000'),
  ('tcc', 'TCC', 'Round the Table: TCCxLSS', '2023-09-29', 480, 'non-standard', 5, false, false, false, NULL, '9b38dc29-0c62-44b5-f9ee-7f094dfa2000'),
  ('evo', 'EVO', 'Bright Lights', '2023-10-06', 490, 'standard', 1, true, false, false, NULL, '9ff80bea-f761-4401-5f0e-51292a525600'),
  ('gem', 'GEM', 'GEM Pack 2', '2024-01-01', 500, 'non-standard', 5, false, false, false, NULL, '3ef5e82d-b660-47f0-79ae-3f0345545c00'),
  ('oxo', 'OXO', 'Slingshot Underground Promos', '2024-01-01', 510, 'non-standard', 5, false, false, false, NULL, NULL),
  ('hvy', 'HVY', 'Heavy Hitters', '2024-02-02', 520, 'standard', 1, true, false, false, NULL, 'ae2ce1ba-6a99-49f8-44b6-8fe78f318d00'),
  ('bet', 'BET', 'Blitz Deck: Heavy Hitters - Betsy', '2024-02-02', 530, 'non-standard', 3, false, false, false, NULL, NULL),
  ('ksi', 'KSI', 'Blitz Deck: Heavy Hitters - Kassai', '2024-02-02', 540, 'non-standard', 3, false, false, false, NULL, NULL),
  ('kyo', 'KYO', 'Blitz Deck: Heavy Hitters - Kayo', '2024-02-02', 550, 'non-standard', 3, false, false, false, NULL, NULL),
  ('ola', 'OLA', 'Blitz Deck: Heavy Hitters - Olympia', '2024-02-02', 560, 'non-standard', 3, false, false, false, NULL, NULL),
  ('rhi', 'RHI', 'Blitz Deck: Heavy Hitters - Rhinar', '2024-02-02', 570, 'non-standard', 3, false, false, false, NULL, NULL),
  ('vic', 'VIC', 'Blitz Deck: Heavy Hitters - Victor', '2024-02-02', 580, 'non-standard', 3, false, false, false, NULL, NULL),
  ('ako', 'AKO', 'Armory Deck: Kayo', '2024-05-03', 590, 'armory', 4, false, false, false, NULL, NULL),
  ('mst', 'MST', 'Part the Mistveil', '2024-05-31', 600, 'standard', 1, true, false, false, NULL, '5a675dac-4b79-495e-f1d2-85c897a72700'),
  ('eng', 'ENG', 'Blitz Deck: Part the Mistveil - Enigma', '2024-05-31', 610, 'non-standard', 3, false, false, false, NULL, NULL),
  ('nuu', 'NUU', 'Blitz Deck: Part the Mistveil - Nuu', '2024-05-31', 620, 'non-standard', 3, false, false, false, NULL, NULL),
  ('zen', 'ZEN', 'Blitz Deck: Part the Mistveil - Zen', '2024-05-31', 630, 'non-standard', 3, false, false, false, NULL, NULL),
  ('asb', 'ASB', 'Armory Deck: Boltyn', '2024-07-12', 640, 'armory', 4, false, false, false, NULL, NULL),
  ('aaz', 'AAZ', 'Armory Deck: Azalea', '2024-08-02', 650, 'armory', 4, false, false, false, NULL, NULL),
  ('aur', 'AUR', '1st Strike', '2024-08-23', 660, 'non-standard', 2, false, false, false, NULL, NULL),
  ('ter', 'TER', 'First Strike: Terra', '2024-08-23', 670, 'non-standard', 2, false, false, false, NULL, NULL),
  ('ros', 'ROS', 'Rosetta', '2024-09-20', 680, 'standard', 1, true, false, false, NULL, 'b04d7f29-f907-4b1f-6707-2593dc6f2f00'),
  ('aua', 'AUA', 'Blitz Deck: Rosetta - Aurora', '2024-09-20', 690, 'non-standard', 3, false, false, false, NULL, NULL),
  ('flr', 'FLR', 'Blitz Deck: Rosetta - Florian', '2024-09-20', 700, 'non-standard', 3, false, false, false, NULL, NULL),
  ('osc', 'OSC', 'Blitz Deck: Rosetta - Oscilio', '2024-09-20', 710, 'non-standard', 3, false, false, false, NULL, NULL),
  ('ver', 'VER', 'Blitz Deck: Rosetta - Verdance', '2024-09-20', 720, 'non-standard', 3, false, false, false, NULL, NULL),
  ('aio', 'AIO', 'Armory Deck: Dash', '2024-10-18', 730, 'armory', 4, false, false, false, NULL, NULL),
  ('ajv', 'AJV', 'Armory Deck: Jarl Vetreidi', '2024-11-29', 740, 'armory', 4, false, false, false, NULL, NULL),
  ('hnt', 'HNT', 'The Hunted', '2025-01-31', 750, 'standard', 1, true, false, false, 'L', '71eef9e0-d486-4e22-2b73-5d71146cd200'),
  ('ark', 'ARK', 'Blitz Deck: The Hunted - Arakni', '2025-01-31', 760, 'non-standard', 3, false, false, false, NULL, NULL),
  ('cin', 'CIN', 'Blitz Deck: The Hunted - Cindra', '2025-01-31', 770, 'non-standard', 3, false, false, false, NULL, NULL),
  ('fng', 'FNG', 'Blitz Deck: The Hunted - Fang', '2025-01-31', 780, 'non-standard', 3, false, false, false, NULL, NULL),
  ('wod', 'WOD', 'Blitz Deck: The Hunted - Arakni, Web of Deceit', '2025-01-31', 790, 'non-standard', 3, false, false, false, NULL, NULL),
  ('ast', 'AST', 'Armory Deck: Aurora', '2025-03-14', 800, 'armory', 4, false, false, false, NULL, NULL),
  ('amx', 'AMX', 'Armory Deck: Maxx Nitro', '2025-04-17', 810, 'armory', 4, false, false, false, NULL, NULL),
  ('agb', 'AGB', 'Armory Deck: Gravy Bones', '2025-05-30', 820, 'armory', 4, false, false, false, NULL, NULL),
  ('sea', 'SEA', 'High Seas', '2025-06-06', 830, 'standard', 1, true, false, false, 'L', 'ecd78249-2a7f-415a-2c6c-89980e745400'),
  ('asr', 'ASR', 'Armory Deck: Ira', '2025-07-11', 840, 'armory', 4, false, false, false, NULL, NULL),
  ('apr', 'APR', 'Armory Deck Legends: Prism', '2025-07-24', 850, 'armory', 4, false, false, false, NULL, NULL),
  ('avs', 'AVS', 'Armory Deck Legends: Viserai', '2025-07-24', 860, 'armory', 4, false, false, false, NULL, NULL),
  ('mpg', 'MPG', 'Mastery Pack Guardian', '2025-08-08', 870, 'standard', 1, true, false, false, NULL, '3dd6c60e-cdb6-4bf4-7bc4-989156e13700'),
  ('bdd', 'BDD', 'Bravo Demo Deck', '2025-08-08', 880, 'excluded', 3, false, false, false, NULL, NULL),
  ('smp', 'SMP', 'Smash Palace', '2025-08-29', 890, 'non-standard', 5, false, false, false, NULL, '8e5b5a22-4290-43cf-ab73-22b6ec5f5f00'),
  ('aps', 'APS', 'Armory Deck: Pleiades', '2025-09-19', 900, 'armory', 4, false, false, false, NULL, NULL),
  ('sup', 'SUP', 'Super Slam', '2025-09-26', 910, 'standard', 1, true, false, false, NULL, 'e252874d-eeb0-41b9-7d17-19c117f17e00'),
  ('arr', 'ARR', 'Armory Deck: Rhinar', '2025-11-14', 920, 'armory', 4, false, false, false, NULL, NULL),
  ('aac', 'AAC', 'Armory Deck: Arakni', '2025-12-12', 930, 'armory', 4, false, false, false, NULL, NULL),
  ('anq', 'ANQ', 'Antiquity Pack', '2026-02-13', 940, 'standard', 2, false, false, false, NULL, '1b879518-bef3-4abc-5b89-a4fb27ff7500'),
  ('pen', 'PEN', 'Compendium of Rathe', '2026-02-13', 950, 'standard', 2, false, false, false, NULL, '1b879518-bef3-4abc-5b89-a4fb27ff7500'),
  ('sar', 'SAR', 'Silver Age Deck: Arakni', '2026-02-13', 960, 'non-standard', 3, false, false, false, NULL, NULL),
  ('saz', 'SAZ', 'Silver Age Deck: Azalea', '2026-02-13', 970, 'non-standard', 3, false, false, false, NULL, NULL),
  ('sbr', 'SBR', 'Silver Age Deck: Bravo', '2026-02-13', 980, 'non-standard', 3, false, false, false, NULL, NULL),
  ('sda', 'SDA', 'Silver Age Deck: Dash', '2026-02-13', 990, 'non-standard', 3, false, false, false, NULL, NULL),
  ('sdo', 'SDO', 'Silver Age Deck: Dorinthea', '2026-02-13', 1000, 'non-standard', 3, false, false, false, NULL, NULL),
  ('sen', 'SEN', 'Silver Age Deck: Enigma', '2026-02-13', 1010, 'non-standard', 3, false, false, false, NULL, NULL),
  ('sfa', 'SFA', 'Silver Age Deck: Fai', '2026-02-13', 1020, 'non-standard', 3, false, false, false, NULL, NULL),
  ('siy', 'SIY', 'Silver Age Deck: Iyslander', '2026-02-13', 1030, 'non-standard', 3, false, false, false, NULL, NULL),
  ('ska', 'SKA', 'Silver Age Deck: Kayo', '2026-02-13', 1040, 'non-standard', 3, false, false, false, NULL, NULL),
  ('svi', 'SVI', 'Silver Age Deck: Viserai', '2026-02-13', 1050, 'non-standard', 3, false, false, false, NULL, NULL),
  ('aha', 'AHA', 'Armory Deck Origins: Hala', '2026-04-17', 1060, 'armory', 4, false, false, false, NULL, NULL),
  ('azs', 'AZS', 'Armory Deck: Zyggy', '2026-05-29', 1070, 'armory', 4, false, false, false, NULL, NULL),
  ('omn', 'OMN', 'Omens of the Third Age', '2026-06-05', 1080, 'standard', 1, true, false, false, NULL, '3f1d8a2c-0223-47ce-22e3-6db46e976b00'),
  ('iar', 'IAR', 'Íarathael Preview Cards', '2026-06-05', 1090, 'non-standard', 5, false, false, false, NULL, NULL),
  ('mpw', 'MPW', 'Mastery Pack Warrior', '2026-07-08', 1100, 'non-standard', 5, false, false, false, NULL, NULL),
  ('ddd', 'DDD', 'Dorinthea Demo Deck', '2026-08-07', 1110, 'excluded', 3, false, false, false, NULL, NULL),
  ('aol', 'AOL', 'Armory Deck: Olympia', '2026-08-07', 1120, 'armory', 4, false, false, false, NULL, NULL)
ON CONFLICT (code) DO NOTHING;
