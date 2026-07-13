-- Fresh-install repair: decks.public_id / slug / hero_name / tags / metadata
-- and deck_cards.added_at were added to prod via one-off scripts
-- (scripts/migrate-decks-table.ts, scripts/migrate-deck-cards-table.ts)
-- instead of SQL migrations. A from-zero migration run (fork bootstrap,
-- scratch DB) therefore produced tables that diverge from
-- lib/postgres/schema.ts — breaking deck features and the seed import.
-- Everything here is idempotent: a no-op on databases that already have them.

ALTER TABLE decks ADD COLUMN IF NOT EXISTS public_id text;
UPDATE decks SET public_id = id WHERE public_id IS NULL; -- id is already a unique nanoid
ALTER TABLE decks ALTER COLUMN public_id SET NOT NULL;

ALTER TABLE decks ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS hero_name text;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE decks ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Mirrors prod's constraint-backed unique index + lookup indexes.
CREATE UNIQUE INDEX IF NOT EXISTS decks_public_id_key ON decks (public_id);
CREATE INDEX IF NOT EXISTS idx_decks_public_id ON decks (public_id);
CREATE INDEX IF NOT EXISTS idx_decks_user_slug ON decks (user_id, slug);

ALTER TABLE deck_cards ADD COLUMN IF NOT EXISTS added_at timestamp DEFAULT now() NOT NULL;
