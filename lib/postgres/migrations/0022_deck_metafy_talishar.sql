-- Migration 0022: Add Metafy partner flag to users and guide/Talishar fields to decks

-- Store Metafy partner status on users (verified coaches only)
ALTER TABLE users ADD COLUMN IF NOT EXISTS metafy_partner boolean DEFAULT false;

-- Deck: link to a Metafy guide (restricts access to purchasers)
ALTER TABLE decks ADD COLUMN IF NOT EXISTS metafy_guide_id text;

-- Deck: opt-in to appearing in Talishar deck list
ALTER TABLE decks ADD COLUMN IF NOT EXISTS available_on_talishar boolean NOT NULL DEFAULT false;

-- Guarded: fabbazaar_app is production-only (local/fork installs run as the
-- fabbazaar superuser) — see the same pattern in 0047.
DO $$
BEGIN
  PERFORM 1 FROM pg_roles WHERE rolname = 'fabbazaar_app';
  IF FOUND THEN
    GRANT ALL ON TABLE decks TO fabbazaar_app;
    GRANT ALL ON TABLE users TO fabbazaar_app;
  END IF;
END $$;
