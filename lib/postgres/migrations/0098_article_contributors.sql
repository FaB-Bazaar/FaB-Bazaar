-- Co-author credits on articles (deck creator, strategy inventor, guest writer).
-- JSONB array of { role?, name, link? } objects; NULL = no contributors.
-- Validated at the service layer by lib/articles/contributors.ts.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS contributors jsonb;
