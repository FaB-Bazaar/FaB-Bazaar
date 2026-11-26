-- 0133: deck versions
--
-- A deck is edited in place (`deck_cards`), so the list it had last month is
-- gone the moment a card changes. `deck_versions` keeps an immutable copy of
-- the list each time the owner saves a version: the cards as JSON (printing,
-- zone, quantity, plus the card's name and pitch so an old version still reads
-- if a printing is later removed), numbered 1, 2, 3… per deck.
--
-- `deck_cards` stays the working copy — nothing here changes how a deck is
-- edited or read. `content_hash` is the list's fingerprint (printing + zone +
-- quantity), used to skip a save when nothing changed since the last version.
-- Rows are never updated. Idempotent.

CREATE TABLE IF NOT EXISTS deck_versions (
  id             TEXT PRIMARY KEY,
  deck_id        TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  label          TEXT,
  content_hash   TEXT NOT NULL,
  snapshot       JSONB NOT NULL,
  created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT unique_deck_versions_deck_number UNIQUE (deck_id, version_number)
);
