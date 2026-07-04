-- 0072: MCP usage capture — per-user, per-client, per-tool daily aggregates
--
-- Observability substrate for the MCP surface (Claude / Le Chat / LM Studio /
-- future hosted tier). One row per (day, user, client, tool); the route layer
-- increments counters on every successful tools/call and resources/read.
-- Byte counts are raw facts; token estimates (~bytes/4) are derived at read
-- time. Future paid-tier quotas read from this table — enforcement is policy
-- on top, never mixed into capture.

CREATE TABLE IF NOT EXISTS mcp_usage_daily (
  usage_date date NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client text NOT NULL DEFAULT 'unknown',
  tool text NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  request_bytes integer NOT NULL DEFAULT 0,
  response_bytes integer NOT NULL DEFAULT 0,
  PRIMARY KEY (usage_date, user_id, client, tool)
);

CREATE INDEX IF NOT EXISTS idx_mcp_usage_daily_user ON mcp_usage_daily (user_id, usage_date);
