-- 0095_add_feed_overrides.sql
-- Manual corrections to the fab-cube upstream feed, applied by pipeline step 002
-- (002_tcg_price_enhancer.py) to the feed data BEFORE price lookup.
--
-- Why: the fab-cube feed occasionally ships a wrong tcgplayer_product_id (e.g.
-- the SEA015-017 Cloud City Steamboat cycle pointed at the 1st Strike products,
-- so a bulk rare displayed a $128.70 single-listing ask). Upstream PRs are slow
-- to land, and any direct fix to `printings` is clobbered by the nightly upsert
-- (005) — worse, prices are computed from the feed's product id in JSON-land
-- (002) before Postgres is ever touched, so a DB-only fix never repriced.
-- Overrides therefore patch the FEED at the start of each run: corrected ids
-- flow through pricing, snapshots, and the 005 upsert with no special-casing.
--
-- Matching: collector_number is the feed printing id (e.g. 'SEA016').
-- edition / foiling NULL = match any. Comparison is case-insensitive (the feed
-- uses uppercase codes, `printings` stores lowercase). language defaults 'en'
-- (the fab-cube feed is English-only today).
--
-- set_fields: jsonb object of feed fields to overwrite. The service layer and
-- pipeline both whitelist keys (tcgplayer_product_id, tcgplayer_url,
-- tcgplayer_subtype_name) — unknown keys are rejected/ignored, never applied.

CREATE TABLE IF NOT EXISTS feed_overrides (
  id text PRIMARY KEY,
  collector_number text NOT NULL,
  edition text,
  foiling text,
  language text NOT NULL DEFAULT 'en',
  set_fields jsonb NOT NULL,
  reason text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- One override per exact match key (wildcards normalized via coalesce('')).
CREATE UNIQUE INDEX IF NOT EXISTS unique_feed_override_match
  ON feed_overrides(upper(collector_number), upper(coalesce(edition, '')), upper(coalesce(foiling, '')), language);
CREATE INDEX IF NOT EXISTS idx_feed_overrides_active ON feed_overrides(active);
