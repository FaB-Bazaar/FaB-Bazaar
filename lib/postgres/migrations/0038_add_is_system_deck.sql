-- Add is_system_deck flag to decks
-- System decks are site-managed reference decks (e.g. Decks to Beat) owned by the superadmin.
-- They are hidden from the owner's personal views (navbar, decks page, Discord, MCP, Talishar sync)
-- but remain publicly accessible via direct URL and the Decks to Beat page.
ALTER TABLE decks ADD COLUMN is_system_deck boolean NOT NULL DEFAULT false;
