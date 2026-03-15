-- Slim metafy_communities (drop unused columns)
ALTER TABLE metafy_communities DROP COLUMN IF EXISTS url;
ALTER TABLE metafy_communities DROP COLUMN IF EXISTS logo_url;

-- Add IV columns for encrypted Metafy tokens
ALTER TABLE users ADD COLUMN IF NOT EXISTS metafy_access_token_iv text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS metafy_refresh_token_iv text;

-- Ensure app role has full access to metafy_communities
GRANT ALL ON TABLE metafy_communities TO fabbazaar_app;
