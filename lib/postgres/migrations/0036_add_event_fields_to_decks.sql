-- Add event metadata fields to decks table
-- event_name: name of the tournament/event (e.g. "Pro Tour Indianapolis")
-- event_date: explicit date for the event, drives the to-beat month filter (distinct from updatedAt)
-- placing: optional finishing position (1 = 1st, 2 = 2nd, etc.)

ALTER TABLE decks ADD COLUMN IF NOT EXISTS event_name text;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS event_date date;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS "placing" integer;

CREATE INDEX IF NOT EXISTS idx_decks_event_date ON decks (event_date) WHERE event_date IS NOT NULL;
