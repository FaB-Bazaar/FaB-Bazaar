-- 0131: social handles on the user profile.
--
-- users.social_links: { platformKey: handle } for the platforms in
-- lib/profile/social-links.ts (nanza, youtube, instagram, bluesky, facebook,
-- x). Handles only — profile URLs are built from per-platform templates at
-- render time, never stored. The one full address is `website` (a personal
-- or store site), validated as a plain http(s) URL on a public domain. Set on /profile/socials, shown on the public
-- profile. Empty object = nothing set.
--
-- Idempotent.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;
