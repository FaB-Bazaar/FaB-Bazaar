#!/usr/bin/env python3
"""
One-time backfill: load every price_snapshot_<unix_ts>.json from
scripts/price_history/ into DuckDB. Run once after first deploy so the
analytical layer (010_compute_movers.py) has full history.

DuckDB has native NDJSON support via read_json_auto(), so this loader
is one INSERT statement per file — no row-by-row Python parsing.

Usage:
    python3 load_all_history.py
    python3 load_all_history.py --truncate         # wipe table first
"""

import argparse
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import duckdb

DEFAULT_HISTORY_DIR = Path(__file__).resolve().parent / "price_history"
DEFAULT_DB_PATH = Path(os.environ.get("DUCKDB_PATH", "/app/data/prices.duckdb"))
FILENAME_RE = re.compile(r"price_snapshot_(\d+)\.json$")

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


def discover_files(d: Path):
    out = []
    for p in d.iterdir():
        m = FILENAME_RE.match(p.name)
        if m:
            out.append((int(m.group(1)), p))
    out.sort(key=lambda x: x[0])
    return out


def load_one(con, path: Path, snapshot_ts: datetime):
    snapshot_date = snapshot_ts.date()
    snapshot_ts_naive = snapshot_ts.replace(tzinfo=None)
    start = time.time()
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
        FROM read_json_auto('{path}', format='nd')
    """)
    return time.time() - start


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", type=Path, default=DEFAULT_HISTORY_DIR)
    ap.add_argument("--db", type=Path, default=DEFAULT_DB_PATH)
    ap.add_argument("--truncate", action="store_true")
    args = ap.parse_args()

    files = discover_files(args.dir)
    if not files:
        raise SystemExit(f"no price_snapshot_*.json files in {args.dir}")

    args.db.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(args.db))
    con.execute(SCHEMA_SQL)

    if args.truncate:
        print("TRUNCATE TABLE price_snapshots")
        con.execute("DELETE FROM price_snapshots")

    print(f"discovered {len(files)} files in {args.dir}")
    print(f"target db: {args.db}")
    print(f"date range: {datetime.fromtimestamp(files[0][0], tz=timezone.utc).date()}"
          f" → {datetime.fromtimestamp(files[-1][0], tz=timezone.utc).date()}")
    print()

    grand_start = time.time()
    for ts, path in files:
        snapshot_ts = datetime.fromtimestamp(ts, tz=timezone.utc).replace(tzinfo=None)
        elapsed = load_one(con, path, snapshot_ts)
        print(f"  {path.name}  ts={snapshot_ts:%Y-%m-%d %H:%M}  {elapsed:>5.2f}s")

    grand_elapsed = time.time() - grand_start

    summary = con.execute("""
        SELECT min(snapshot_date), max(snapshot_date),
               count(DISTINCT snapshot_date), count(),
               count(DISTINCT printing_id)
        FROM price_snapshots
    """).fetchone()

    print()
    print(f"loaded {len(files)} files in {grand_elapsed:.1f}s")
    print(f"final state: {summary[0]} → {summary[1]} | "
          f"{summary[2]} dates | {summary[3]:,} rows | {summary[4]:,} printings")
    print(f"db file size: {args.db.stat().st_size / (1024 * 1024):.1f} MB")

    con.close()


if __name__ == "__main__":
    main()
