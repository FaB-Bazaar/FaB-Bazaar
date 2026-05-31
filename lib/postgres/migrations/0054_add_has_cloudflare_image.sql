-- Add `has_cloudflare_image` to printings: a cached flag recording whether the
-- printing's Cloudflare image (imagedelivery.net/<hash>/<printing_id>/public)
-- has actually been uploaded.
--
-- Why: step 05 bakes a deterministic Cloudflare URL into every printing, but
-- step 03b only uploads images for printings NOT already in the DB. When
-- fab-cube publishes a card's art AFTER ingest, the row keeps a URL that points
-- at a Cloudflare ID that was never uploaded — a silent 404. There was no cheap
-- way to find these (the only signals were the billable delivery path).
--
-- This column is the persisted output of `audit_cloudflare_images.py`, which
-- diffs all printing_ids against the Cloudflare Images LIST API (no delivery
-- charge). It is a CACHE of Cloudflare state, refreshed by that audit — not an
-- authoritative source. Queryable via `WHERE has_cloudflare_image = false` to
-- find printings still needing art (uploaded by hand via /admin/image-uploads).
--
-- Backfill: every existing row becomes false via the column DEFAULT; the first
-- audit run flips the present ones to true. No separate UPDATE needed here.

ALTER TABLE printings
  ADD COLUMN IF NOT EXISTS has_cloudflare_image boolean NOT NULL DEFAULT false;

-- Partial index: callers only ever ask for the missing set, which is small.
CREATE INDEX IF NOT EXISTS idx_printings_missing_image
  ON printings (has_cloudflare_image)
  WHERE has_cloudflare_image = false;
