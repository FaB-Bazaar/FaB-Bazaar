#!/usr/bin/env python3
"""
Tests for the arcane damage stat mapping (fab-cube `arcane` field →
cards.arcane / cards.arcane_text).

The feed carries arcane as a string: '' (no arcane damage), a number
('3'), or 'X' (variable). Numeric values land in `arcane` (int); the raw
token is preserved in `arcane_text` like power/power_text. 'X' must stay
NULL in `arcane` so range filters (arcaneMin) never match it.

Run:
  python3 pipeline/scripts/test_arcane_stat.py
"""

import importlib.util
import os
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent


def _load_module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


transformer_module = _load_module(
    "003_cards_to_printings_transformer.py", "transformer"
)


def make_card(arcane, name="Aether Testbolt"):
    return {
        "unique_id": "test-card-uid",
        "name": name,
        "types": ["wizard", "action"],
        "pitch": "1",
        "arcane": arcane,
        "printings": [
            {
                "unique_id": "test-printing-uid",
                "id": "TST001",
                "set_id": "TST",
                "edition": "N",
                "foiling": "S",
                "rarity": "C",
            }
        ],
    }


class ArcaneStatMappingTests(unittest.TestCase):
    def setUp(self):
        self.t = transformer_module.CardsToPrintingsTransformer()

    def _doc(self, arcane):
        docs = self.t.transform_card_to_printings(make_card(arcane))
        self.assertEqual(len(docs), 1)
        return docs[0]

    def test_numeric_arcane_maps_to_int(self):
        doc = self._doc("3")
        self.assertEqual(doc["arcane"], 3)
        self.assertEqual(doc["arcane_text"], "3")

    def test_empty_arcane_is_none(self):
        doc = self._doc("")
        self.assertIsNone(doc["arcane"])
        self.assertEqual(doc["arcane_text"], "")

    def test_variable_x_arcane_stays_none_but_keeps_token(self):
        doc = self._doc("X")
        self.assertIsNone(doc["arcane"])
        self.assertEqual(doc["arcane_text"], "X")


class CardFieldsUpsertTests(unittest.TestCase):
    def test_005_upserts_arcane_columns(self):
        # 010-style import guard: 005 reads POSTGRES_URL at import time.
        os.environ.setdefault("POSTGRES_URL", "postgresql://dummy/dummy")
        updater = _load_module("005_weekly_printings_updater.py", "updater")
        self.assertIn("arcane", updater.CARD_FIELDS)
        self.assertIn("arcane_text", updater.CARD_FIELDS)


if __name__ == "__main__":
    unittest.main()
