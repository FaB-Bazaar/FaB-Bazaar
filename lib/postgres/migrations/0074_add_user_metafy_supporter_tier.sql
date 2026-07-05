-- Adds the hosted-chat supporter tier to user accounts. Derived from the user's
-- Metafy community membership (paid tier in the FaB Bazaar community) and synced
-- on account link / token refresh; a superadmin may also set it manually as a
-- comp/VIP override. Distinct from the ads-only is_metafy_supporter boolean.
-- Gates Fabby Chat access (see lib/ai/fabby-chat-access.ts) and the hosted-chat
-- quota tier (lib/ai/tiers.ts). Default 'free' — access is opt-in, never
-- granted implicitly.
ALTER TABLE users ADD COLUMN IF NOT EXISTS metafy_supporter_tier text NOT NULL DEFAULT 'free';
