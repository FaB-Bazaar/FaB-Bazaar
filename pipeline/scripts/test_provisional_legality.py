#!/usr/bin/env python3
"""
Legality flags (cc_legal / blitz_legal / …) are admin-owned: 005 never
overwrites them, so a spoiler-season (CardVault-ingested, provisional) set
stays illegal in every constructed format after release until someone
intervenes — IAR sat at 21/263 CC-legal cards on prod. Migration 0112 adds
`apply_provisional_legality()` (derives flags for provisional, never-flagged
cards once COALESCE(sets.legal_from, sets.release_date) <= today) and 005
calls it after the upserts every night so future sets flip on their own.

Run:
  python3 pipeline/scripts/test_provisional_legality.py
"""

import importlib.util
import inspect
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent


def _load_module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


MOD = _load_module("005_weekly_printings_updater.py", "provisional_legality_mod")


class _Cursor:
    def __init__(self, rows):
        self.rows = rows
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        self.executed.append(sql)

    def fetchone(self):
        return self.rows


class _Conn:
    def __init__(self, rows=(0,)):
        self.cur = _Cursor(rows)
        self.commits = 0
        self.rollbacks = 0

    def cursor(self):
        return self.cur

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def _updater(conn):
    u = object.__new__(MOD.WeeklyPrintingsUpdater)
    u.conn = conn
    u.stats = {}
    return u


class ProvisionalLegalityHookTests(unittest.TestCase):
    def test_runs_after_the_upserts_in_process_updates(self):
        flow = inspect.getsource(MOD.WeeklyPrintingsUpdater.process_updates)
        self.assertIn("_apply_provisional_legality", flow)
        self.assertGreater(flow.index("_apply_provisional_legality"), flow.index("_upsert_printings"))

    def test_calls_the_db_function_and_commits(self):
        conn = _Conn(rows=(42,))
        _updater(conn)._apply_provisional_legality(dry_run=False)
        self.assertTrue(any("apply_provisional_legality()" in s for s in conn.cur.executed))
        self.assertEqual(conn.commits, 1)

    def test_dry_run_does_not_call_the_function(self):
        conn = _Conn()
        _updater(conn)._apply_provisional_legality(dry_run=True)
        self.assertEqual(conn.cur.executed, [])
        self.assertEqual(conn.commits, 0)

    def test_missing_function_is_a_warning_not_a_step_failure(self):
        # Prod's pipeline image can be rebuilt before migration 0112 applies.
        class _Boom(_Cursor):
            def execute(self, sql, params=None):
                raise RuntimeError('function apply_provisional_legality() does not exist')
        conn = _Conn()
        conn.cur = _Boom((0,))
        _updater(conn)._apply_provisional_legality(dry_run=False)  # must not raise
        self.assertEqual(conn.rollbacks, 1)


if __name__ == "__main__":
    unittest.main()
