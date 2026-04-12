-- Migration: Remove legacy MCP token columns from users table
-- These columns supported the legacy `mcp_` token auth system, which has been
-- replaced entirely by OAuth 2.1. 60 users had tokens set; none are in active use.

ALTER TABLE users DROP COLUMN IF EXISTS mcp_token;
ALTER TABLE users DROP COLUMN IF EXISTS mcp_token_expiry;
DROP INDEX IF EXISTS idx_users_mcp_token;
