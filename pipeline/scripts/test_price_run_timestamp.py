#!/usr/bin/env python3
"""
Tests for the price-sync run timestamp recorded by 006_daily_price_updater.

Why this test exists:
  The binder page's "Prices updated X" label reads
  site_settings.prices_last_run_at (fallback: MAX(printings.price_updated_at),
  which only moves when a price CHANGES — one repriced card made every binder
  read "today" while unchanged-but-checked prices read stale). Step 006 must
  upsert that key on every successful run — including runs where zero prices
  changed — and never let a failure of this cosmetic write kill the run.

Run:
  python3 pipeline/scripts/test_price_run_timestamp.py
"""

import importlib.util
import os
import unittest
from pathlib import Path
from unittest.mock import MagicMock

SCRIPTS_DIR = Path(__file__).parent

os.environ.setdefault("POSTGRES_URL", "postgresql://test:test@localhost:5432/test")


def _load_module(filename: str, name: str):
    """importlib loader because module filenames start with digits."""
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


updater_mod = _load_module("006_daily_price_updater.py", "daily_price_updater")


def _make_updater(dry_run: bool):
    """Instantiate without __init__ (which opens a real DB connection)."""
    upd = object.__new__(updater_mod.DailyPriceUpdater)
    upd.dry_run = dry_run
    upd.conn = MagicMock()
    upd.conn.closed = False
    return upd


class TestRunTimestampContract(unittest.TestCase):
    def test_key_matches_app_side(self):
        # PostgresBinderService reads this exact site_settings key.
        self.assertEqual(updater_mod.PRICES_LAST_RUN_KEY, "prices_last_run_at")

    def test_sql_is_an_idempotent_site_settings_upsert(self):
        sql = updater_mod.RECORD_RUN_SQL
        self.assertIn("INSERT INTO site_settings", sql)
        self.assertIn("ON CONFLICT (key) DO UPDATE", sql)
        # to_jsonb(NOW()) stores an ISO string with timezone — parseable by
        # `new Date(value)` on the app side.
        self.assertIn("to_jsonb(NOW())", sql)


class TestRecordRunTimestamp(unittest.TestCase):
    def test_writes_and_commits_on_a_wet_run(self):
        upd = _make_updater(dry_run=False)
        cursor = upd.conn.cursor.return_value.__enter__.return_value

        upd._record_run_timestamp()

        cursor.execute.assert_called_once_with(
            updater_mod.RECORD_RUN_SQL,
            {"key": updater_mod.PRICES_LAST_RUN_KEY},
        )
        upd.conn.commit.assert_called_once()

    def test_skips_entirely_on_dry_run(self):
        upd = _make_updater(dry_run=True)

        upd._record_run_timestamp()

        upd.conn.cursor.assert_not_called()
        upd.conn.commit.assert_not_called()

    def test_failure_rolls_back_and_does_not_raise(self):
        upd = _make_updater(dry_run=False)
        cursor = upd.conn.cursor.return_value.__enter__.return_value
        cursor.execute.side_effect = RuntimeError("db down")

        upd._record_run_timestamp()  # must not raise

        upd.conn.rollback.assert_called_once()
        upd.conn.commit.assert_not_called()


if __name__ == "__main__":
    unittest.main()
