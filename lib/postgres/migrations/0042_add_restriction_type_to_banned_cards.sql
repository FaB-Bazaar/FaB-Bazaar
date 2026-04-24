-- Migration: Add restriction_type column to banned_cards
-- Living Legend introduces a "restricted" concept (max 1 copy per deck) on top
-- of the existing "banned" (0 copies). We reuse the banned_cards table — same
-- lookup patterns — with an extra column to distinguish the two restriction
-- levels. Existing rows default to 'banned'.

ALTER TABLE "banned_cards"
  ADD COLUMN "restriction_type" text NOT NULL DEFAULT 'banned';

ALTER TABLE "banned_cards"
  ADD CONSTRAINT "banned_cards_restriction_type_check"
  CHECK ("restriction_type" IN ('banned', 'restricted'));

-- The uniqueness constraint now needs to include restriction_type so a single
-- card can be both "banned" and "restricted" in different entries (rare, but
-- preserves history correctly when a card moves between tiers).
ALTER TABLE "banned_cards"
  DROP CONSTRAINT IF EXISTS "banned_cards_card_unique_id_format_unique";

ALTER TABLE "banned_cards"
  ADD CONSTRAINT "banned_cards_card_unique_id_format_restriction_unique"
  UNIQUE ("card_unique_id", "format", "restriction_type");

-- Grant the runtime app role access to the altered table (no-op if already
-- granted; re-running is cheap).
-- Note: default privileges should already cover this if ALTER DEFAULT
-- PRIVILEGES was set. Kept here for explicit safety on environments where
-- the default privilege step hasn't been run.
DO $$ BEGIN
  PERFORM 1 FROM pg_roles WHERE rolname = 'fabbazaar_app';
  IF FOUND THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.banned_cards TO fabbazaar_app;
  END IF;
END $$;
