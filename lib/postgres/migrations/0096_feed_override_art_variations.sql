-- 0096_feed_override_art_variations.sql
-- Add an art-variation discriminator to feed_overrides.
--
-- Why: override matching was (collector_number, edition, foiling, language),
-- but the fab-cube feed legitimately ships MULTIPLE printings under that key —
-- art variants differ only by art_variations/image (see the dual-source gotcha,
-- migration 0088). First real case: ELE146 Channel Lake Frigid has a regular
-- and an Alternate Art printing, both 1st-edition rainbow foil, and the feed
-- points BOTH at the regular-art TCGplayer product (247879). An override to
-- repoint the AA printing at its real product (248564) would, without this
-- column, also repoint the regular printing — swapping a ~$7 card's price for
-- a ~$40 one.
--
-- Matching semantics (mirrored in 002_tcg_price_enhancer.py):
--   NULL  = match any art variation (wildcard; the pre-0096 behaviour, so all
--           existing override rows keep their meaning)
--   '{}'  = match only printings with NO art variations
--   '{AA}' = exact set match, case- and order-insensitive
--
-- The unique match key must include the new dimension, otherwise the AA and
-- regular overrides for the same collector/edition/foiling collide. NULL is
-- normalized to a sentinel array that cannot be a real variation list.
-- (array_to_string is only STABLE, so the array is indexed directly — btree
-- handles text[] natively. Case/order normalization of the stored tokens is
-- the service layer's job: it uppercases and sorts before writing.)

ALTER TABLE feed_overrides ADD COLUMN IF NOT EXISTS art_variations text[];

DROP INDEX IF EXISTS unique_feed_override_match;
CREATE UNIQUE INDEX IF NOT EXISTS unique_feed_override_match
  ON feed_overrides(
    upper(collector_number),
    upper(coalesce(edition, '')),
    upper(coalesce(foiling, '')),
    language,
    (coalesce(art_variations, '{<any>}'::text[]))
  );
