-- Add `essences` column to cards: the list of essence card pools a HERO
-- grants access to (Terra → {earth}, Oldhim → {earth,ice}, Bravo Star of the
-- Show → {earth,ice,lightning}, etc.). Empty `{}` for every non-hero card.
--
-- Why this column exists:
--   - Essences are a game rule, not a card subtype. The hero card itself has
--     types like {elemental, guardian, hero, young} — earth is granted via
--     the "essence of earth" keyword, not via a type entry.
--   - Previously the only place this lived was a hand-maintained TS roster
--     (`lib/fab-constants/heroes-rosters.ts`), which went stale every time a
--     new hero shipped. Add-card validation in PostgresDeckService now reads
--     this column directly.
--   - Has_earth / has_ice / has_lightning are already used by search filters
--     to mean "this card belongs to the earth-essence pool". They can't
--     double as "this hero grants earth essence access" without conflating
--     the two semantics (e.g. it would put Terra into earth-card search
--     results).
--
-- Pipeline 003_cards_to_printings_transformer.py parses the source JSON's
-- `card_keywords` for the "essence of X[, Y, and Z]" pattern and writes the
-- result here. Until 005 is re-run, existing rows have `{}` and the app
-- falls back to `getHeroInfo()` for hero essences.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS essences text[] NOT NULL DEFAULT ARRAY[]::text[];
