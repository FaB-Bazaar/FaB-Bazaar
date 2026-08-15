-- 0103: add a user-defined `folder` string to decks.
--
-- Why: the /decks page had no way to group decks by anything but format /
-- visibility. `folder` is a free-form, owner-chosen label ("Physical decks",
-- "Brewing", "Retired") that behaves like a single-level folder system: the
-- decks page filters on it and shows it as a chip; the settings dialog edits it.
-- Deliberately just a nullable text (not a FK / enum) so users can invent any
-- taxonomy. Trimmed + capped at 60 chars in the service layer; NULL = unfiled.
--
-- Idempotent.

ALTER TABLE decks ADD COLUMN IF NOT EXISTS folder text;
