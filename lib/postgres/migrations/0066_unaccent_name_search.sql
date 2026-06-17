-- Accent-insensitive strict name search.
-- Lets a plain-ASCII query (e.g. "tropal") match diacritic card names
-- (e.g. "Riches of Trōpal-Dhani") in the default strict search mode.

-- unaccent() text-search dictionary + function.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent(text) is only STABLE (it depends on the search-path-resolved
-- dictionary), so it cannot be used in an index expression directly. Pinning
-- the dictionary name makes the result deterministic, so this wrapper is safe
-- to mark IMMUTABLE — which lets us build a functional index on it.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT unaccent('unaccent', $1) $$;

-- Functional trigram index so accent-insensitive ILIKE '%q%' stays index-fast
-- (the existing cards_name_trgm_idx can't serve immutable_unaccent(name)).
CREATE INDEX IF NOT EXISTS cards_name_unaccent_trgm_idx
  ON cards USING GIN (immutable_unaccent(name) gin_trgm_ops);
