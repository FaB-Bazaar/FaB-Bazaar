-- Fix immutable_unaccent under an empty search_path.
--
-- Migration 0066 defined the wrapper as `unaccent('unaccent', $1)` —
-- UNQUALIFIED. pg_dump-generated files (prod backup restores, seed imports)
-- run with `search_path = ''` for hardening, so any COPY into cards that
-- maintains cards_name_unaccent_trgm_idx fails with:
--   function unaccent(unknown, text) does not exist
--
-- Schema-qualifying both the function and the dictionary makes the wrapper
-- resolve under any search_path. Same body the refresh-local-db flow used to
-- patch in by hand at restore time; this migration makes that fix permanent.
-- CREATE OR REPLACE keeps the function OID, so the existing index stays valid
-- (the function is IMMUTABLE and its output is unchanged).
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
