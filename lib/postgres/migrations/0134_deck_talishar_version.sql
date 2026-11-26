-- 0134: which list Talishar gets for a deck
--
-- Talishar always imported a deck's live cards. With saved versions (0133) a
-- player can keep brewing in the deck while Talishar keeps playing the list
-- they registered: `decks.talishar_version` names the saved version the
-- Talishar export serves. NULL (the default, and every existing deck) = the
-- deck as it is now, exactly as before. A number with no matching version
-- (none can be deleted today) also falls back to the live deck. Idempotent.

ALTER TABLE decks ADD COLUMN IF NOT EXISTS talishar_version INTEGER;
