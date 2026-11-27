-- 0136: which OAuth apps may connect at all (managed at /admin/oauth-apps)
--
-- Client registration (/oauth/register) stays open, but an app can only get
-- a player's approval, refresh its tokens or use the partner API when it is
-- on this list. Before this, any registered app could ask a player for full
-- account access.
--
-- kind 'redirect_host': every app whose return addresses are ALL on this host
--   (exact host name, any port) — AI assistants register a fresh client per
--   connection, so their ids can't be listed, but their return host is fixed
--   and can't be faked (the approval code only goes there).
-- kind 'client_id': one registered app (partners such as Cintari).
-- access: 'full' = full-account grants, 'partner' = partner API scopes, 'all'.
--
-- Seeded with the assistants already in use, so nothing connected today
-- breaks on deploy. Talishar is not here: it uses its own API key, not OAuth.
-- Idempotent.

CREATE TABLE IF NOT EXISTS oauth_allowlist (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kind       TEXT NOT NULL CHECK (kind IN ('redirect_host', 'client_id')),
  value      TEXT NOT NULL,
  label      TEXT NOT NULL,
  access     TEXT NOT NULL CHECK (access IN ('full', 'partner', 'all')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (kind, value)
);

INSERT INTO oauth_allowlist (kind, value, label, access) VALUES
  ('redirect_host', 'claude.ai',           'Claude',                                   'full'),
  ('redirect_host', 'chatgpt.com',         'ChatGPT',                                  'full'),
  ('redirect_host', 'agent.meta.ai',       'Meta AI',                                  'full'),
  ('redirect_host', 'callback.mistral.ai', 'Mistral',                                  'full'),
  ('redirect_host', 'localhost',           'Desktop apps (Claude Desktop, Claude Code)', 'full'),
  ('redirect_host', '127.0.0.1',           'Desktop apps (Claude Desktop, Claude Code)', 'full')
ON CONFLICT (kind, value) DO NOTHING;
