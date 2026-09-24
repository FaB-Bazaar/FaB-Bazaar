-- 0115: Daily market feed — anonymous buy/sell prices seen in Facebook groups
--
-- A superadmin MCP client (Meta Muse) scans FaB buy/sell groups and submits
-- the day's curated listings via the submit_market_feed tool. One call carries
-- a whole day: re-submitting a feed_date replaces that day's rows, other days
-- are untouched. Shown on the public /feed page as an extra price reference.
--
-- Deliberately anonymous: no poster name, no post URL (a link identifies the
-- poster). card_name keeps what the post said; card_unique_id is the service's
-- best match (NULL = unmatched or ambiguous).

CREATE TABLE IF NOT EXISTS market_feed_listings (
  id              text PRIMARY KEY,
  feed_date       date NOT NULL,
  side            text NOT NULL CHECK (side IN ('selling', 'buying')),
  card_name       text NOT NULL,
  card_unique_id  text REFERENCES cards(card_unique_id) ON DELETE SET NULL,
  pitch           integer,
  collector_number text,
  foiling         text,
  condition       text,
  price           numeric(10, 2) NOT NULL CHECK (price > 0),
  currency        text NOT NULL DEFAULT 'USD',
  group_name      text,
  created_by      text REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_feed_listings_feed_date
  ON market_feed_listings (feed_date);
