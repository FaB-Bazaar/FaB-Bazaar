-- 0067: TCGplayer group dimension — the source of truth for sub-set product
-- groupings that our flat `printings.set` code collapses away.
--
-- Motivating case: the GEM set. LSS numbers GEM as one continuous set
-- (GEM001–GEM183), but each *season* ships a distinct "GEM Pack N" that
-- TCGplayer models as its own group id. All of those map to our single `gem`
-- set code, so the pack a card actually belongs to was previously unrecoverable
-- from our data. The TCGplayer group id is the authoritative per-pack identifier
-- (each GEM collector number resolves to exactly one group), so we record it
-- per printing.
--
-- A TCGplayer group is COARSER than our set codes in the general case (e.g. one
-- "Silver Age Chapter 1" group contains several of our hero-deck set codes), so
-- the group→set relationship is many-to-many and deliberately NOT modeled here.
-- The only link we need is per-printing: printings.tcg_group_id.
--
-- Names/dates are the canonical values from tcgcsv's groups endpoint
-- (https://tcgcsv.com/tcgplayer/62/groups). Seeded for the GEM packs now;
-- other groups are added as we backfill them.

CREATE TABLE IF NOT EXISTS tcg_groups (
  group_id     INTEGER PRIMARY KEY,                 -- TCGplayer group id
  name         TEXT NOT NULL,                       -- canonical group name, e.g. 'GEM Pack 5'
  abbreviation TEXT,                                -- TCGplayer abbreviation, e.g. 'GEM'
  published_on DATE,                                -- group publish date (seasonal release marker)
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO tcg_groups (group_id, name, abbreviation, published_on) VALUES
  (24176, 'GEM Pack 1', 'GEM', '2025-02-01'),
  (24334, 'GEM Pack 2', 'GEM', '2025-06-02'),
  (24446, 'GEM Pack 3', 'GEM', '2025-09-30'),
  (24620, 'GEM Pack 4', 'GEM', '2026-02-14'),
  (24720, 'GEM Pack 5', 'GEM', '2026-06-05')
ON CONFLICT (group_id) DO NOTHING;

-- Per-printing link to the TCGplayer group it was sold in. Nullable: most
-- printings outside multi-group sets don't need it, and backfill is incremental.
ALTER TABLE printings
  ADD COLUMN IF NOT EXISTS tcg_group_id INTEGER REFERENCES tcg_groups(group_id);

CREATE INDEX IF NOT EXISTS idx_printings_tcg_group_id ON printings(tcg_group_id);

-- Correct the mislabeled umbrella set name. `gem` was seeded (migration 0061) as
-- "GEM Pack 2", but it is the union of all GEM packs, not pack 2 specifically.
UPDATE sets
   SET name = 'GEM', updated_at = now()
 WHERE code = 'gem' AND name = 'GEM Pack 2';
