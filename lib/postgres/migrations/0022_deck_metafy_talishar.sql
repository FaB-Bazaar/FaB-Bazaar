-- Migration 0022: Add Metafy partner flag to users and guide/Talishar fields to decks

-- Store Metafy partner status on users (verified coaches only)
ALTER TABLE users ADD COLUMN IF NOT EXISTS metafy_partner boolean DEFAULT false;

-- Deck: link to a Metafy guide (restricts access to purchasers)
ALTER TABLE decks ADD COLUMN IF NOT EXISTS metafy_guide_id text;

-- Deck: opt-in to appearing in Talishar deck list
ALTER TABLE decks ADD COLUMN IF NOT EXISTS available_on_talishar boolean NOT NULL DEFAULT false;

GRANT ALL ON TABLE decks TO fabbazaar_app;
GRANT ALL ON TABLE users TO fabbazaar_app;
