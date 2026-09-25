-- 0116: Link each market feed listing to its Facebook post
--
-- The feed stays free of poster names; the group name was already stored.
-- post_url is validated by the service (https Facebook hosts only) and has
-- tracking parameters stripped before it is stored. NULL = no link given.

ALTER TABLE market_feed_listings ADD COLUMN IF NOT EXISTS post_url text;
