-- 0073: Hosted-LLM usage capture — per-user, per-model daily aggregates
--
-- Metering substrate for the hosted Fabby chat (app/api/admin/fabby-chat),
-- mirroring mcp_usage_daily (0072). One row per (day, user, model); the route
-- increments counters once per chat turn from the agent loop's done-event
-- usage. Token counts here are provider-reported facts (OpenRouter usage
-- accounting), not estimates. Tier quotas (lib/ai/tiers.ts) read today's
-- request count from this table — enforcement is policy on top, never mixed
-- into capture.

CREATE TABLE IF NOT EXISTS llm_usage_daily (
  usage_date date NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model text NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  prompt_tokens bigint NOT NULL DEFAULT 0,
  completion_tokens bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (usage_date, user_id, model)
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_daily_user ON llm_usage_daily (user_id, usage_date);
