-- Manual Fabby Chat access grant, toggled by a superadmin on /admin/user-access.
-- An alternative to the Metafy-derived supporter tier for people who can't get
-- Metafy status (non-Metafy users, comps, VIPs). OR'd into canUseFabbyChat
-- alongside superadmin + metafy_supporter_tier='paid'. Independent of the Metafy
-- sync, so a grant here is never clobbered when memberships are re-checked.
-- Default false — access is opt-in.
ALTER TABLE users ADD COLUMN IF NOT EXISTS fabby_chat_access boolean NOT NULL DEFAULT false;
