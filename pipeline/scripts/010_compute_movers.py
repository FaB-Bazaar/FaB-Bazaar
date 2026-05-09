#!/usr/bin/env python3
"""
Step 010 — Compute daily movers from DuckDB.

Replaces the old step 11 (007_price_analysis.py). Two outputs:
  1) Postgres `daily_movers` table  (used by the Next.js app for "movers
     in my collection")
  2) market_analysis_export.json    (consumed by step 12: 008_discord_market_poster)

DuckDB is embedded — no daemon, no service. The whole analytical layer is one
file at /app/data/prices.duckdb (configurable via DUCKDB_PATH).

DuckDB SQL differences from the original ClickHouse prototype:
  - argMax(x, y)         → arg_max(x, y)
  - argMaxIf(x, y, c)    → arg_max(x, y) FILTER (WHERE c)
  - corrIf(x, y, c)      → corr(x, y) FILTER (WHERE c)
  - maxIf(x, c)          → max(x) FILTER (WHERE c)
  - {today:Date}         → ?::DATE positional placeholders
  - toUInt32(d)          → epoch(d)::INT
"""

import argparse
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import duckdb
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Try .env at project root
for env_candidate in (
    Path(__file__).resolve().parent.parent.parent / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path.cwd() / ".env",
):
    if env_candidate.exists():
        load_dotenv(env_candidate)
        break

DEFAULT_DB_PATH = os.environ.get("DUCKDB_PATH", "/app/data/prices.duckdb")
PG_URL = (
    os.environ.get("POSTGRES_URL_PROD")
    or os.environ.get("POSTGRES_URL_STAGING")
    or os.environ["POSTGRES_URL"]
)


# ─── DuckDB signal queries ────────────────────────────────────────────────────

GAINERS_SQL = """
WITH yesterday AS (
    SELECT printing_id,
           any_value(display_name) AS display_name,
           any_value(set) AS set, any_value(edition) AS edition,
           any_value(rarity) AS rarity, any_value(foiling) AS foiling,
           arg_max(tcg_low, snapshot_date) AS p_yesterday
    FROM price_snapshots
    WHERE snapshot_date = ?::DATE AND has_price
    GROUP BY printing_id
),
today AS (
    SELECT printing_id, arg_max(tcg_low, snapshot_date) AS p_today
    FROM price_snapshots
    WHERE snapshot_date = ?::DATE AND has_price
    GROUP BY printing_id
)
SELECT DISTINCT
    y.printing_id, y.display_name, y.set, y.edition, y.rarity, y.foiling,
    t.p_today                                          AS p_at_signal,
    y.p_yesterday                                      AS ref_price,
    round(t.p_today - y.p_yesterday, 2)                AS dollar_change,
    round((t.p_today - y.p_yesterday)/y.p_yesterday * 100, 2) AS pct_change
FROM yesterday y JOIN today t USING (printing_id)
WHERE y.p_yesterday >= 3
  AND t.p_today >= y.p_yesterday * 1.10
  AND (t.p_today - y.p_yesterday) >= 0.50
ORDER BY dollar_change DESC
LIMIT 25
"""

DECLINERS_SQL = """
WITH yesterday AS (
    SELECT printing_id,
           any_value(display_name) AS display_name,
           any_value(set) AS set, any_value(edition) AS edition,
           any_value(rarity) AS rarity, any_value(foiling) AS foiling,
           arg_max(tcg_low, snapshot_date) AS p_yesterday
    FROM price_snapshots
    WHERE snapshot_date = ?::DATE AND has_price
    GROUP BY printing_id
),
today AS (
    SELECT printing_id, arg_max(tcg_low, snapshot_date) AS p_today
    FROM price_snapshots
    WHERE snapshot_date = ?::DATE AND has_price
    GROUP BY printing_id
)
SELECT DISTINCT
    y.printing_id, y.display_name, y.set, y.edition, y.rarity, y.foiling,
    t.p_today                                          AS p_at_signal,
    y.p_yesterday                                      AS ref_price,
    round(t.p_today - y.p_yesterday, 2)                AS dollar_change,
    round((t.p_today - y.p_yesterday)/y.p_yesterday * 100, 2) AS pct_change
FROM yesterday y JOIN today t USING (printing_id)
WHERE y.p_yesterday >= 5
  AND t.p_today <= y.p_yesterday * 0.90
  AND (y.p_yesterday - t.p_today) >= 1.00
ORDER BY dollar_change ASC
LIMIT 25
"""

BREAKOUTS_SQL = """
WITH per_card AS (
    SELECT printing_id,
           any_value(display_name) AS display_name,
           any_value(set) AS set, any_value(edition) AS edition,
           any_value(rarity) AS rarity, any_value(foiling) AS foiling,
           arg_max(tcg_low, snapshot_date) AS p_now,
           max(tcg_low) FILTER (
               WHERE snapshot_date >= ?::DATE
                 AND snapshot_date <  ?::DATE
           ) AS prior_high
    FROM price_snapshots
    WHERE has_price AND tcg_low IS NOT NULL
    GROUP BY printing_id
)
SELECT DISTINCT
    printing_id, display_name, set, edition, rarity, foiling,
    p_now                                              AS p_at_signal,
    prior_high                                         AS ref_price,
    round(p_now - prior_high, 2)                       AS dollar_change,
    round((p_now - prior_high)/prior_high * 100, 2)    AS pct_change
FROM per_card
WHERE prior_high >= 5
  AND p_now >= prior_high * 1.10
ORDER BY pct_change DESC
LIMIT 25
"""

STEADY_RISERS_SQL = """
WITH per_card AS (
    SELECT printing_id,
           any_value(display_name) AS display_name,
           any_value(set) AS set, any_value(edition) AS edition,
           any_value(rarity) AS rarity, any_value(foiling) AS foiling,
           arg_max(tcg_low, snapshot_date) AS p_now,
           arg_min(tcg_low, snapshot_date) FILTER (WHERE snapshot_date >= ?::DATE) AS p_30d_ago,
           corr(epoch(snapshot_date)::INT, tcg_low) FILTER (WHERE snapshot_date >= ?::DATE) AS smoothness
    FROM price_snapshots
    WHERE has_price AND tcg_low IS NOT NULL
    GROUP BY printing_id
)
SELECT DISTINCT
    printing_id, display_name, set, edition, rarity, foiling,
    p_now                                              AS p_at_signal,
    p_30d_ago                                          AS ref_price,
    round(p_now - p_30d_ago, 2)                        AS dollar_change,
    round((p_now - p_30d_ago)/p_30d_ago * 100, 2)      AS pct_change
FROM per_card
WHERE p_30d_ago >= 5
  AND (p_now - p_30d_ago)/p_30d_ago BETWEEN 0.10 AND 0.50
  AND smoothness >= 0.85
ORDER BY smoothness DESC
LIMIT 25
"""


# ─── Helpers ──────────────────────────────────────────────────────────────────

def fetch_signal(con, sql, params):
    rel = con.execute(sql, params)
    cols = [d[0] for d in rel.description]
    return [dict(zip(cols, row)) for row in rel.fetchall()]


def dedupe_double_sided(records):
    """Collapse double-sided card printings (e.g. Puffin Hightail's two faces)
    into one row by natural key."""
    seen = {}
    for rec in records:
        key = (rec.get("display_name"), rec.get("set"), rec.get("edition"),
               rec.get("foiling"), rec.get("rarity"))
        if key not in seen:
            seen[key] = rec
    return list(seen.values())


def to_json_card(rec):
    return {
        "card_name": rec["display_name"],
        "printing_id": rec["printing_id"],
        "set": rec["set"],
        "edition": rec["edition"],
        "rarity": rec["rarity"],
        "foiling": rec["foiling"],
        "old_price": float(rec["ref_price"]) if rec["ref_price"] is not None else 0.0,
        "new_price": float(rec["p_at_signal"]) if rec["p_at_signal"] is not None else 0.0,
        "percent_change": float(rec["pct_change"]) if rec["pct_change"] is not None else 0.0,
    }


def write_postgres(pg_conn, as_of, all_rows):
    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM daily_movers WHERE as_of_date = %s", (as_of,))
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO daily_movers
                (as_of_date, printing_id, signal_type, p_at_signal, ref_price,
                 dollar_change, pct_change, rank_in_signal)
            VALUES %s
            ON CONFLICT (as_of_date, signal_type, printing_id) DO NOTHING
            """,
            all_rows,
        )
        cur.execute(
            "DELETE FROM daily_movers WHERE as_of_date < %s",
            (as_of - timedelta(days=365),),
        )
    pg_conn.commit()


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of", help="anchor date YYYY-MM-DD (default: latest snapshot_date)")
    ap.add_argument("--db", type=Path, default=Path(DEFAULT_DB_PATH))
    ap.add_argument("--export-json", default="market_analysis_export.json")
    args = ap.parse_args()

    if not args.db.exists():
        raise SystemExit(f"DuckDB file not found: {args.db}. Run load_all_history.py for backfill first.")

    con = duckdb.connect(str(args.db), read_only=True)
    pg = psycopg2.connect(PG_URL)

    if args.as_of:
        today_d = date.fromisoformat(args.as_of)
    else:
        today_d = con.execute("SELECT max(snapshot_date) FROM price_snapshots").fetchone()[0]

    yesterday_d = today_d - timedelta(days=1)
    window_30d = today_d - timedelta(days=30)

    print(f"[010] anchor today={today_d}, yesterday={yesterday_d}, 30d_start={window_30d}")
    print(f"[010] db file: {args.db} ({args.db.stat().st_size / 1024 / 1024:.1f} MB)")

    print("[010] querying DuckDB…")
    gainers       = dedupe_double_sided(fetch_signal(con, GAINERS_SQL,       [yesterday_d, today_d]))
    decliners     = dedupe_double_sided(fetch_signal(con, DECLINERS_SQL,     [yesterday_d, today_d]))
    breakouts     = dedupe_double_sided(fetch_signal(con, BREAKOUTS_SQL,     [window_30d, today_d]))
    steady_risers = dedupe_double_sided(fetch_signal(con, STEADY_RISERS_SQL, [window_30d, window_30d]))

    print(f"[010]   top_gainers:    {len(gainers):>3}")
    print(f"[010]   top_decliners:  {len(decliners):>3}")
    print(f"[010]   breakouts:      {len(breakouts):>3}")
    print(f"[010]   steady_risers:  {len(steady_risers):>3}")

    rows = []
    for sig_name, recs in [
        ("top_gainer", gainers),
        ("top_decliner", decliners),
        ("breakout", breakouts),
        ("steady_riser", steady_risers),
    ]:
        for rank, rec in enumerate(recs, start=1):
            rows.append((
                today_d,
                rec["printing_id"],
                sig_name,
                float(rec["p_at_signal"]) if rec["p_at_signal"] is not None else 0.0,
                float(rec["ref_price"]) if rec["ref_price"] is not None else None,
                float(rec["dollar_change"]) if rec["dollar_change"] is not None else None,
                float(rec["pct_change"]) if rec["pct_change"] is not None else None,
                rank,
            ))

    print(f"[010] writing {len(rows)} rows to Postgres daily_movers…")
    write_postgres(pg, today_d, rows)

    export = {
        "analysis_date": today_d.isoformat(),
        "market_stats": {
            "total_comparisons": len(gainers) + len(decliners) + len(breakouts) + len(steady_risers),
            "top_gainers_count": len(gainers),
            "top_decliners_count": len(decliners),
        },
        "selling_opportunities": {"hot_movers": [to_json_card(r) for r in gainers]},
        "buying_opportunities": {"major_drops": [to_json_card(r) for r in decliners]},
        "advanced_strategies": {
            "high_volatility": [to_json_card(r) for r in breakouts],
            "value_opportunities": [to_json_card(r) for r in steady_risers],
        },
    }

    out_path = Path(args.export_json)
    out_path.write_text(json.dumps(export, indent=2, default=str))
    print(f"[010] wrote JSON export to {out_path} ({out_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
