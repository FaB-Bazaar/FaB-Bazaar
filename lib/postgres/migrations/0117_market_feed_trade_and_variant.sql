-- 0117: Market feed — "willing to trade for" listings and printing variants
--
-- side 'trade' = a card the poster wants in exchange (e.g. "Willing to trade
-- for: Dead Threads CF"). It carries no price, so price becomes nullable and
-- is required only on selling/buying rows. Signed-in viewers of /feed see
-- which of these cards they own.
--
-- variant = Marvel / Extended Art / Alternate Art / Full Art / … (display
-- label, validated by the service). Marvels and art variants are priced very
-- differently from the base printing, so TCG Low is looked up against the
-- matching printings (Marvel = rarity 'v', others = art_variations code).

ALTER TABLE market_feed_listings DROP CONSTRAINT IF EXISTS market_feed_listings_side_check;
ALTER TABLE market_feed_listings ADD CONSTRAINT market_feed_listings_side_check
  CHECK (side IN ('selling', 'buying', 'trade'));

ALTER TABLE market_feed_listings DROP CONSTRAINT IF EXISTS market_feed_listings_price_check;
ALTER TABLE market_feed_listings ALTER COLUMN price DROP NOT NULL;
ALTER TABLE market_feed_listings ADD CONSTRAINT market_feed_listings_price_check
  CHECK ((side = 'trade' AND (price IS NULL OR price > 0)) OR (side <> 'trade' AND price > 0));

ALTER TABLE market_feed_listings ADD COLUMN IF NOT EXISTS variant text;
