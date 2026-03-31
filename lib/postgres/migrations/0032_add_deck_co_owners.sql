-- Add co-owners array to decks table
-- Co-owners share edit access to a deck (max 20, enforced at API layer)
ALTER TABLE decks ADD COLUMN co_owners text[] NOT NULL DEFAULT ARRAY[]::text[];
