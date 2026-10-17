-- 0126: Cardmarket (EUR) prices for European users.
--
-- Cardmarket publishes a daily FaB price guide + product list (public S3,
-- productCatalog/priceGuide/price_guide_16.json). Neither file carries a set
-- code or collector number, so pipeline step 012 (cardmarket_prices.py,
-- matcher in cardmarket_match.py) maps each product to our printings via
-- cardmarket_expansions.csv + card name + a foil/price ranking.
--
-- printings.cardmarket_*: pipeline-owned, written nightly by 012 only. 005's
-- upsert never lists them, so the printings upsert can't clobber them.
--   cardmarket_product_id       Cardmarket idProduct, stored once and kept
--   cardmarket_trend/low/avg7/avg30   EUR, from the price guide
--   cardmarket_url              product page (or name search) on cardmarket.com
--   cardmarket_match_status     'matched' | 'review' (rank pairing on close prices)
--   cardmarket_price_updated_at the price guide's own createdAt
-- All nullable: ~3% of printings have no Cardmarket product (Outsiders Blitz
-- decks, WIN prize cards, unlisted promos).
--
-- users.cardmarket_prices: the viewer sees Cardmarket € instead of TCGplayer $
-- everywhere (one source per screen, never mixed). Default off.
--
-- Idempotent.

ALTER TABLE printings
  ADD COLUMN IF NOT EXISTS cardmarket_product_id integer,
  ADD COLUMN IF NOT EXISTS cardmarket_trend numeric(10, 2),
  ADD COLUMN IF NOT EXISTS cardmarket_low numeric(10, 2),
  ADD COLUMN IF NOT EXISTS cardmarket_avg7 numeric(10, 2),
  ADD COLUMN IF NOT EXISTS cardmarket_avg30 numeric(10, 2),
  ADD COLUMN IF NOT EXISTS cardmarket_url text,
  ADD COLUMN IF NOT EXISTS cardmarket_match_status text,
  ADD COLUMN IF NOT EXISTS cardmarket_price_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'printings'::regclass AND conname = 'printings_cardmarket_match_status_check'
  ) THEN
    ALTER TABLE printings ADD CONSTRAINT printings_cardmarket_match_status_check
      CHECK (cardmarket_match_status IN ('matched', 'review'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS printings_cardmarket_product_id_idx
  ON printings (cardmarket_product_id) WHERE cardmarket_product_id IS NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cardmarket_prices boolean NOT NULL DEFAULT false;
