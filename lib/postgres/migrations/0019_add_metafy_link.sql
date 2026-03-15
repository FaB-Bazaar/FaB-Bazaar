-- Add Metafy account linking fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS metafy_id text UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metafy_username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metafy_access_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metafy_refresh_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metafy_token_expiry timestamp;

CREATE INDEX IF NOT EXISTS idx_users_metafy_id ON users(metafy_id) WHERE metafy_id IS NOT NULL;
