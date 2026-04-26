-- Add pinned_in_nav flag to binders and decks.
-- Lets users choose which binders/decks appear in their navbar dropdown.
-- Default false: existing rows are unaffected. The navbar falls back to
-- most-recently-updated when a user has nothing pinned.

ALTER TABLE binders ADD COLUMN pinned_in_nav boolean NOT NULL DEFAULT false;
ALTER TABLE decks   ADD COLUMN pinned_in_nav boolean NOT NULL DEFAULT false;

-- Partial indexes keep the navbar's "pinned-only" query fast as users grow,
-- while taking ~zero space for users who never pin anything.
CREATE INDEX idx_binders_pinned_nav ON binders (user_id) WHERE pinned_in_nav = true;
CREATE INDEX idx_decks_pinned_nav   ON decks   (user_id) WHERE pinned_in_nav = true;
