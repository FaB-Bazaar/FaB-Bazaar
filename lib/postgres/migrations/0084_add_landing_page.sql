-- Migration 0084: users.landing_page — logged-in landing page preference.
-- Values: 'volzar' | 'collection' | 'decks'; NULL = default (/volzar).
-- Read by app/page.tsx and /auth/post-login via resolveLandingPath
-- (lib/landing-page.ts); edited on /profile/edit.

ALTER TABLE users ADD COLUMN IF NOT EXISTS landing_page TEXT;
