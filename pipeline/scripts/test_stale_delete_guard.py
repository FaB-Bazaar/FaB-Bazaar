#!/usr/bin/env python3
"""
Tests that 005's stale-printing DELETE protects every table that references
printing_id — not just the three originally guarded ones.

curated_list_cards has NO FK to printings, so a printing held only by a
curated list would be silently pruned, dangling the list entry. Same for
other_face_printing_id (DFC partner links, no FK): deleting one face strands
its partner's pointer. The guard must cover:

  inventory_items, wants_items, deck_cards, curated_list_cards,
  and printings.other_face_printing_id.

Run:
  python3 pipeline/scripts/test_stale_delete_guard.py
"""

import importlib.util
import inspect
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent

GUARDED_REFS = [
    "inventory_items",
    "wants_items",
    "deck_cards",
    "curated_list_cards",
    "other_face_printing_id",
]


def _load_module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


class StaleDeleteGuardTests(unittest.TestCase):
    def test_guard_sql_covers_every_referencing_table(self):
        mod = _load_module("005_weekly_printings_updater.py", "guard_test")
        self.assertTrue(
            hasattr(mod, "_stale_printing_guard_sql"),
            "005 must expose _stale_printing_guard_sql() so the guard is testable",
        )
        sql = mod._stale_printing_guard_sql()
        for ref in GUARDED_REFS:
            self.assertIn(ref, sql, f"stale-delete guard must protect {ref}")

    def test_delete_method_uses_the_shared_guard(self):
        mod = _load_module("005_weekly_printings_updater.py", "guard_test2")
        src = inspect.getsource(mod.WeeklyPrintingsUpdater._delete_stale_printings)
        self.assertIn(
            "_stale_printing_guard_sql", src,
            "the method must build its predicate from the shared guard",
        )
        self.assertGreaterEqual(
            src.count("{guard}"),
            3,
            "count, dry-run, and delete queries must all interpolate the shared guard",
        )
        # The old hand-rolled three-table predicate must be gone so the paths
        # can never drift apart again.
        self.assertNotIn("printing_id IN (SELECT printing_id FROM inventory_items)", src)


if __name__ == "__main__":
    unittest.main()
