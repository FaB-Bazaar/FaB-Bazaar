-- 0085_add_collectibles.sql
-- Non-card collectible catalog (playmats first) + per-user have/want marks.
--
-- Design: a GLOBAL admin-curated catalog, deliberately separate from
-- binders/inventory_items (those are card-shaped: printing FK, condition,
-- pricing). Users interact via user_collectible_marks — at most ONE mark per
-- (user, collectible), status 'have' or 'want' (you can't sensibly both have
-- and want the same item, and one row makes the toggle UI trivial: flip the
-- status, or delete the row to clear).
--
-- `kind` is an enum so other collectible types (tokens, dice, sealed) can be
-- added later with ALTER TYPE ... ADD VALUE — the catalog page filters by kind.

DO $$ BEGIN
  CREATE TYPE collectible_kind AS ENUM ('playmat');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE collectible_mark_status AS ENUM ('have', 'want');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS collectibles (
  id text PRIMARY KEY,
  kind collectible_kind NOT NULL DEFAULT 'playmat',
  name text NOT NULL,
  description text,
  image_url text,
  artist text,
  -- Where it was made available (e.g. "Calling Sydney 2024 Top 8 prize",
  -- "Armory Deck Kit", "GEM Store"). Free text — no official registry exists.
  source text,
  year integer,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collectibles_kind ON collectibles(kind);
CREATE INDEX IF NOT EXISTS idx_collectibles_year ON collectibles(year);
CREATE UNIQUE INDEX IF NOT EXISTS unique_collectibles_kind_name_year
  ON collectibles(kind, name, year);

CREATE TABLE IF NOT EXISTS user_collectible_marks (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collectible_id text NOT NULL REFERENCES collectibles(id) ON DELETE CASCADE,
  status collectible_mark_status NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_collectible_mark
  ON user_collectible_marks(user_id, collectible_id);
CREATE INDEX IF NOT EXISTS idx_collectible_marks_collectible
  ON user_collectible_marks(collectible_id);
CREATE INDEX IF NOT EXISTS idx_collectible_marks_user
  ON user_collectible_marks(user_id);
