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

-- Guarded: fabbazaar_app is production-only (local/fork installs run as the
-- fabbazaar superuser) — see the same pattern in 0047.
DO $$
BEGIN
  PERFORM 1 FROM pg_roles WHERE rolname = 'fabbazaar_app';
  IF FOUND THEN
    GRANT ALL ON TABLE metafy_communities TO fabbazaar_app;
  END IF;
END $$;
