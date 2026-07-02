-- Adds a state/region code to user profiles, pairing with the existing
-- country_code, so users can set their own location on /profile/edit.
-- Used to default store-discovery filters; deliberately coarse (no city,
-- no coordinates) — user privacy stays intact.
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_code text;
