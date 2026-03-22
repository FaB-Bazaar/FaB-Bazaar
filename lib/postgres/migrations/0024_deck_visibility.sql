-- Migration 0024: Replace decks.is_public boolean with visibility enum
-- Also change available_on_talishar default to true

-- Add visibility column using existing visibility_level enum
ALTER TABLE decks ADD COLUMN visibility visibility_level NOT NULL DEFAULT 'unlisted';

-- Backfill from is_public: true → 'public', false → 'unlisted' (shareable via link)
UPDATE decks SET visibility = CASE
  WHEN is_public = true THEN 'public'::visibility_level
  ELSE 'unlisted'::visibility_level
END;

-- Drop old is_public column and its index
DROP INDEX IF EXISTS idx_decks_public;
ALTER TABLE decks DROP COLUMN is_public;

-- Create new index for public deck listing
CREATE INDEX idx_decks_visibility_public ON decks (visibility) WHERE visibility = 'public';

-- Change available_on_talishar default to true
ALTER TABLE decks ALTER COLUMN available_on_talishar SET DEFAULT true;

-- Set existing decks to available on talishar
UPDATE decks SET available_on_talishar = true WHERE available_on_talishar = false;
