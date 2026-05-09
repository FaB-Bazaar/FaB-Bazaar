-- daily_movers: analytical results computed in ClickHouse and pushed back
-- to Postgres so the Next.js app can JOIN against inventory_items at request
-- time. Populated nightly by pipeline step 010_compute_movers.py.
--
-- Sized for ~150 rows/day × 365 days = ~55k rows steady state. With
-- single-table retention (DELETE WHERE as_of_date < now - 1 year, applied
-- inside compute_movers.py) we don't need partitioning at this volume.

CREATE TABLE IF NOT EXISTS daily_movers (
    as_of_date     date          NOT NULL,
    printing_id    text          NOT NULL,
    signal_type    text          NOT NULL,
    p_at_signal    numeric(10,2) NOT NULL,
    ref_price      numeric(10,2),
    dollar_change  numeric(10,2),
    pct_change     numeric(7,2),
    rank_in_signal smallint,
    extra          jsonb,
    computed_at    timestamptz   DEFAULT now(),
    PRIMARY KEY (as_of_date, signal_type, printing_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_movers_printing
    ON daily_movers (printing_id, as_of_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_movers_recent
    ON daily_movers (as_of_date DESC, signal_type);
