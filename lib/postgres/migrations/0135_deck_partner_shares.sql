-- 0135: which connected apps a deck is sent to
--
-- Talishar sees a deck when `decks.available_on_talishar` is on. Partner game
-- clients (Cintari first) connect through OAuth instead, and a player picks,
-- per deck, which of their connected apps get it — someone with hundreds of
-- decks sends only the ones they play there. One row = this deck is shared
-- with this OAuth client. No row (every existing deck) = not shared; the
-- partner play API (/api/partner/v1/play) lists and serves only shared decks.
--
-- Deleting the deck or the OAuth client removes its rows. Idempotent.

CREATE TABLE IF NOT EXISTS deck_partner_shares (
  deck_id    TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  client_id  TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (deck_id, client_id)
);

-- The play API's list: every deck shared with one client.
CREATE INDEX IF NOT EXISTS idx_deck_partner_shares_client ON deck_partner_shares (client_id);
