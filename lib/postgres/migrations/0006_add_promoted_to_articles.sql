-- Add promoted flag to articles table
-- Allows admins to promote user-generated articles to appear alongside curated content

ALTER TABLE articles ADD COLUMN IF NOT EXISTS promoted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_articles_promoted ON articles (promoted);
