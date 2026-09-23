-- 0114: Allow Meta Muse as an OAuth callback for personal MCP clients
--
-- Same shape as 0071 (Mistral). Personal OAuth clients carry a fixed list of
-- chat-client callbacks and /oauth/authorize exact-matches redirect_uri against
-- it, so credentials pasted into Meta Muse failed with invalid_client
-- (Invalid redirect_uri). Muse's hosted setup only takes pre-made credentials
-- (it does not register itself). PostgresOAuthService.createClient now includes
-- the Meta callback for new clients; this backfills existing personal clients
-- so users don't have to regenerate credentials.
--
-- Scope: only user-linked clients that already carry the Claude callback
-- (i.e. the personal-client shape). DCR-registered clients are untouched.

UPDATE oauth_clients
SET redirect_uris = array_append(
  redirect_uris,
  'https://agent.meta.ai/api/hatch/oauth/callback'
)
WHERE user_id IS NOT NULL
  AND 'https://claude.ai/api/mcp/auth_callback' = ANY(redirect_uris)
  AND NOT ('https://agent.meta.ai/api/hatch/oauth/callback' = ANY(redirect_uris));
