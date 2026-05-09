#!/usr/bin/env python3
"""
Step 04b — load today's price snapshot into DuckDB.

Runs immediately after step 04 (which produced price_snapshot.json). Inserts
the same NDJSON into prices.duckdb so the analytical step (010_compute_movers.py)
can run SQL against the full price history.

DuckDB reads NDJSON natively via read_json_auto(), so this is one INSERT
statement — no batching loop, no row-by-row parsing.

Usage:
    python3 004b_load_snapshot_to_duckdb.py price_snapshot.json
    python3 004b_load_snapshot_to_duckdb.py price_snapshot.json --as-of 2026-05-08
"""

import argparse
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import duckdb

DEFAULT_DB_PATH = os.environ.get("DUCKDB_PATH", "/app/data/prices.duckdb")


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS price_snapshots (
    snapshot_date    DATE      NOT NULL,
    snapshot_ts      TIMESTAMP NOT NULL,
    printing_id      VARCHAR   NOT NULL,
    card_unique_id   VARCHAR,
    name             VARCHAR,
    display_name     VARCHAR,
    set              VARCHAR,
    foiling          VARCHAR,
    edition          VARCHAR,
    rarity           VARCHAR,
    collector_number VARCHAR,
    has_price        BOOLEAN,
    tcg_low          DOUBLE,
    tcg_mid          DOUBLE,
    tcg_high         DOUBLE,
    tcg_market       DOUBLE,
    price_updated_at TIMESTAMP,
    inserted_at      TIMESTAMP DEFAULT current_timestamp,
    PRIMARY KEY (printing_id, snapshot_date)
);
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", type=Path, help="snapshot NDJSON (output of step 04)")
    ap.add_argument("--as-of", help="snapshot date YYYY-MM-DD (defaults to today UTC)")
    ap.add_argument("--db", type=Path, default=Path(DEFAULT_DB_PATH))
    args = ap.parse_args()

    if not args.file.exists():
        raise SystemExit(f"snapshot file not found: {args.file}")

    if args.as_of:
        d = date.fromisoformat(args.as_of)
        snapshot_ts = datetime(d.year, d.month, d.day, 23, 2, tzinfo=timezone.utc)
    else:
        snapshot_ts = datetime.now(tz=timezone.utc)

    snapshot_date = snapshot_ts.date()
    snapshot_ts_naive = snapshot_ts.replace(tzinfo=None)

    args.db.parent.mkdir(parents=True, exist_ok=True)
    print(f"[04b] loading {args.file} → {args.db}")
    print(f"[04b] snapshot_date={snapshot_date}, snapshot_ts={snapshot_ts.isoformat()}")

    con = duckdb.connect(str(args.db))
    con.execute(SCHEMA_SQL)

    con.execute(f"""
        INSERT OR REPLACE INTO price_snapshots
        SELECT
            DATE '{snapshot_date.isoformat()}'                          AS snapshot_date,
            TIMESTAMP '{snapshot_ts_naive.isoformat(' ')[:19]}'         AS snapshot_ts,
            printing_id,
            card_unique_id,
            name,
            COALESCE(display_name, name)                                AS display_name,
            "set",
            foiling,
            edition,
            rarity,
            collector_number,
            CASE WHEN has_price THEN TRUE ELSE FALSE END                AS has_price,
            tcg_low,
            tcg_mid,
            tcg_high,
            tcg_market,
            CAST(price_updated_at AS TIMESTAMP),
            current_timestamp
        FROM read_json_auto('{args.file}', format='nd')
    """)

    n = con.execute(
        "SELECT count() FROM price_snapshots WHERE snapshot_date = ?",
        [snapshot_date],
    ).fetchone()[0]
    size_mb = args.db.stat().st_size / (1024 * 1024)

    print(f"[04b] {n:,} rows for {snapshot_date} now in DB")
    print(f"[04b] db file size: {size_mb:.1f} MB")
    con.close()


if __name__ == "__main__":
    main()
