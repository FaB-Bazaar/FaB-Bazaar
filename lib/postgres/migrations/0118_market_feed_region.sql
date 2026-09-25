-- 0118: Market feed regions (North America / Europe / APAC)
--
-- Each Facebook buy/sell group belongs to one region, and /feed shows the
-- viewer's region by default (explicit choice → profile country → Cloudflare
-- connection country → na). A submission replaces one (feed_date, region),
-- so the NA, EU and APAC passes don't overwrite each other.
-- Every row before this migration came from the North American group.

ALTER TABLE market_feed_listings ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'na';
ALTER TABLE market_feed_listings DROP CONSTRAINT IF EXISTS market_feed_listings_region_check;
ALTER TABLE market_feed_listings ADD CONSTRAINT market_feed_listings_region_check
  CHECK (region IN ('na', 'eu', 'apac'));

DROP INDEX IF EXISTS idx_market_feed_listings_feed_date;
CREATE INDEX IF NOT EXISTS idx_market_feed_listings_region_date
  ON market_feed_listings (region, feed_date);
