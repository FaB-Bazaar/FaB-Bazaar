-- 0120: A user's "streaming deck" for the profile-level stream overlay
--
-- /overlay/u/<username>/deck renders whichever deck the user picked here, so a
-- streamer's OBS browser source never needs a new URL when they switch decks.
-- NULL = no streaming deck. Deleting the deck clears the choice.
-- Declared as a plain column in schema.ts (users <-> decks would be a circular
-- Drizzle reference); the FK lives here.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS streaming_deck_id text REFERENCES decks(id) ON DELETE SET NULL;
