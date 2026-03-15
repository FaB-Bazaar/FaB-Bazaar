-- Add Metafy communities table to store which communities a user belongs to
CREATE TABLE IF NOT EXISTS metafy_communities (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id text NOT NULL,
  title text NOT NULL,
  url text,
  logo_url text,
  tiers jsonb,
  synced_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, community_id)
);

CREATE INDEX IF NOT EXISTS idx_metafy_communities_user_id ON metafy_communities(user_id);
