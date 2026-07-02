#!/usr/bin/env python3
"""
Tests for the tcg_market sanity guard in 010_compute_movers.

Why this test exists:
  The gainers/decliners/breakouts/steady-risers signals key off `tcg_low`
  (the single cheapest active TCGPlayer listing). A placeholder / fat-finger
  listing (e.g. a $189k Briar, a $30k rare equipment) becomes the "low" and
  dominates the day-over-day diff, producing absurd Discord posts. The guard
  rejects any snapshot row whose tcg_low is an implausible multiple of that
  row's tcg_market (default 500%). These tests pin that contract.

Run:
  python3 pipeline/scripts/test_market_sanity.py
"""

import importlib.util
import os
import unittest
from pathlib import Path

import duckdb

SCRIPTS_DIR = Path(__file__).parent

# 010 reads POSTGRES_URL at import time (only used later, in main()). Provide a
# dummy so importing the module for its SQL constants doesn't raise.
os.environ.setdefault("POSTGRES_URL", "postgresql://test:test@localhost:5432/test")


def _load_module(filename: str, name: str):
    """importlib loader because module filenames start with digits."""
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


movers = _load_module("010_compute_movers.py", "movers")


def make_con(rows):
    """In-memory DuckDB seeded with price_snapshots rows.

    rows: list of dicts with keys printing_id, snapshot_date, tcg_low,
          tcg_market, display_name, set, edition, rarity, foiling.
    """
    con = duckdb.connect(":memory:")
    con.execute(
        """
        CREATE TABLE price_snapshots (
            printing_id   TEXT,
            display_name  TEXT,
            "set"         TEXT,
            edition       TEXT,
            rarity        TEXT,
            foiling       TEXT,
            snapshot_date DATE,
            tcg_low       DOUBLE,
            tcg_market    DOUBLE,
            has_price     BOOLEAN
        )
        """
    )
    for r in rows:
        con.execute(
            """INSERT INTO price_snapshots VALUES (?,?,?,?,?,?,?::DATE,?,?,TRUE)""",
            [
                r["printing_id"], r.get("display_name", "Card"), r.get("set", "xxx"),
                r.get("edition", "N"), r.get("rarity", "R"), r.get("foiling", "S"),
                r["snapshot_date"], r["tcg_low"], r.get("tcg_market"),
            ],
        )
    return con


def ids(records):
    return {r["printing_id"] for r in records}


YESTERDAY = "2026-06-29"
TODAY = "2026-07-01"


class GainersSanityTests(unittest.TestCase):
    def test_junk_high_low_excluded_from_gainers(self):
        """A tcg_low that is >5x tcg_market is a bad listing, not a real gain."""
        con = make_con([
            # Junk: low jumps $5k -> $30k while market stays ~$5. Ratio ~6000x.
            {"printing_id": "junk", "snapshot_date": YESTERDAY, "tcg_low": 5047, "tcg_market": 5},
            {"printing_id": "junk", "snapshot_date": TODAY,     "tcg_low": 30082, "tcg_market": 5},
            # Real: $10 -> $13, market tracks. A legitimate +30% gainer.
            {"printing_id": "real", "snapshot_date": YESTERDAY, "tcg_low": 10, "tcg_market": 10},
            {"printing_id": "real", "snapshot_date": TODAY,     "tcg_low": 13, "tcg_market": 12},
        ])
        rows = movers.fetch_signal(con, movers.GAINERS_SQL, [YESTERDAY, TODAY])
        got = ids(rows)
        self.assertIn("real", got)
        self.assertNotIn("junk", got)

    def test_real_gainer_survives(self):
        con = make_con([
            {"printing_id": "real", "snapshot_date": YESTERDAY, "tcg_low": 10, "tcg_market": 10},
            {"printing_id": "real", "snapshot_date": TODAY,     "tcg_low": 13, "tcg_market": 12},
        ])
        rows = movers.fetch_signal(con, movers.GAINERS_SQL, [YESTERDAY, TODAY])
        self.assertEqual(ids(rows), {"real"})


class DeclinersSanityTests(unittest.TestCase):
    def test_junk_high_old_price_excluded_from_decliners(self):
        """The $189k Briar case: a bad OLD low fakes a -99.9% crash."""
        con = make_con([
            # Junk old price $189,323 vs market $187 -> filtered, no fake drop.
            {"printing_id": "briar", "snapshot_date": YESTERDAY, "tcg_low": 189323, "tcg_market": 187},
            {"printing_id": "briar", "snapshot_date": TODAY,     "tcg_low": 187, "tcg_market": 187},
            # Real decliner: $20 -> $16 (-20%), market tracks.
            {"printing_id": "real", "snapshot_date": YESTERDAY, "tcg_low": 20, "tcg_market": 20},
            {"printing_id": "real", "snapshot_date": TODAY,     "tcg_low": 16, "tcg_market": 17},
        ])
        rows = movers.fetch_signal(con, movers.DECLINERS_SQL, [YESTERDAY, TODAY])
        got = ids(rows)
        self.assertIn("real", got)
        self.assertNotIn("briar", got)


class BreakoutsSanityTests(unittest.TestCase):
    def test_junk_day_not_used_as_prior_high(self):
        con = make_con([
            {"printing_id": "c", "snapshot_date": "2026-06-10", "tcg_low": 10, "tcg_market": 10},
            # A single junk spike day inside the window must not become prior_high.
            {"printing_id": "c", "snapshot_date": "2026-06-15", "tcg_low": 900, "tcg_market": 10},
            {"printing_id": "c", "snapshot_date": TODAY,        "tcg_low": 12, "tcg_market": 12},
        ])
        # window_30d start, today
        rows = movers.fetch_signal(con, movers.BREAKOUTS_SQL, ["2026-06-01", TODAY])
        # p_now $12 vs a sane prior_high $10 is a real +20% breakout; the $900
        # junk day should have been filtered so it doesn't suppress the signal.
        got = ids(rows)
        self.assertIn("c", got)


if __name__ == "__main__":
    unittest.main(verbosity=2)
