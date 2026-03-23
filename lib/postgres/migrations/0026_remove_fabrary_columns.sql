-- Remove unused Fabrary integration columns
ALTER TABLE decks DROP COLUMN IF EXISTS fabrary_url;
ALTER TABLE decks DROP COLUMN IF EXISTS fabrary_deck_id;
