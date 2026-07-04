-- 0071: Allow Mistral Le Chat as an OAuth callback for personal MCP clients
--
-- Personal OAuth clients (created via /api/user/oauth-clients) were minted with
-- redirect_uris = {claude.ai callback} only, so credentials pasted into
-- Mistral Le Chat failed /oauth/authorize with invalid_client (Invalid redirect_uri).
-- PostgresOAuthService.createClient now includes the Mistral callback for new
-- clients; this backfills existing personal clients so users don't have to
-- regenerate credentials.
--
-- Scope: only user-linked clients that already carry the Claude callback
-- (i.e. the personal-client shape). DCR-registered clients are untouched.

UPDATE oauth_clients
SET redirect_uris = array_append(
  redirect_uris,
  'https://callback.mistral.ai/v1/integrations_auth/oauth2_callback'
)
WHERE user_id IS NOT NULL
  AND 'https://claude.ai/api/mcp/auth_callback' = ANY(redirect_uris)
  AND NOT ('https://callback.mistral.ai/v1/integrations_auth/oauth2_callback' = ANY(redirect_uris));
