-- Add featured flag for "Decks to Beat" section
ALTER TABLE decks ADD COLUMN featured BOOLEAN NOT NULL DEFAULT false;

-- Partial index for fast queries on featured public decks
CREATE INDEX idx_decks_featured ON decks (featured) WHERE featured = true AND visibility = 'public';
