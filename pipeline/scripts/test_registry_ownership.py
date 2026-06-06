#!/usr/bin/env python3
"""
Tests that the nightly pipeline no longer OWNS the ban/suspend/restrict columns.

After the banned-cards taxonomy migration, banned_cards (the admin registry) is
the single source of truth for restriction state, write-through to cards.*_banned
/ *_suspended / ll_restricted. The pipeline must stop driving those columns or it
would clobber registry edits on the next run:

  - 005 weekly updater: the restriction columns become admin-owned (preserved on
    UPDATE, like the *_legal flags), so a re-sync never reverts a UI/MCP edit.
  - 003 transformer: stops force-overriding *_banned from the static
    fab_banned_cards.py lists — the registry owns bans now.

Run:
  python3 pipeline/scripts/test_registry_ownership.py
"""

import importlib.util
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent

RESTRICTION_COLS = [
    "cc_banned", "silver_age_banned", "blitz_banned", "commoner_banned", "ll_banned",
    "cc_suspended", "silver_age_suspended", "blitz_suspended", "commoner_suspended",
    "ll_restricted",
]


def _load_module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


class WeeklyUpdaterOwnershipTests(unittest.TestCase):
    def test_restriction_columns_preserved_on_update(self):
        updater = _load_module("005_weekly_printings_updater.py", "updater_test")
        sql = updater._build_card_upsert_sql()
        for col in RESTRICTION_COLS:
            self.assertNotIn(
                f'"{col}" = EXCLUDED."{col}"', sql,
                f"{col} must be admin-owned (preserved on update), not overwritten by the pipeline",
            )

    def test_normal_columns_still_update(self):
        updater = _load_module("005_weekly_printings_updater.py", "updater_test2")
        sql = updater._build_card_upsert_sql()
        # A non-owned column must still be refreshed from upstream.
        self.assertIn('"name" = EXCLUDED."name"', sql)


class TransformerBanOverrideTests(unittest.TestCase):
    def test_does_not_force_banned_from_static_lists(self):
        mod = _load_module("003_cards_to_printings_transformer.py", "transformer_ban_test")
        transformer = mod.CardsToPrintingsTransformer()
        # A unique_id that the OLD static-list override would have force-banned.
        fbc = _load_module("fab_banned_cards.py", "fbc_test")
        banned_uid = next(iter(fbc.CC_BANNED_CARD_IDS))
        card = {
            "unique_id": banned_uid,
            "name": "Test Card",
            "types": [],
            "printings": [{"unique_id": "p-test", "id": "TST001", "set_id": "tst"}],
        }
        docs = transformer.transform_card_to_printings(card)
        self.assertTrue(docs, "expected at least one printing doc")
        self.assertFalse(
            docs[0]["cc_banned"],
            "cc_banned must reflect the input JSON, not the static fab_banned_cards lists",
        )


if __name__ == "__main__":
    unittest.main()
