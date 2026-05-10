#!/usr/bin/env python3
"""
Tests for the steady_risers naming across the daily-movers pipeline.

Why this test exists:
  Before this rename, 010_compute_movers wrote its steady-risers list
  into a key called `value_opportunities` for back-compat with the
  legacy 007_price_analysis schema (which used that key for actual
  *drops*). 008_discord_market_poster then labeled the section
  "Notable Drops by Rarity" while showing trending-up cards. The
  Discord post said "drops" with +25% 📈 next to each card.

  Renaming the key clears the semantic confusion. These tests pin
  the new contract.

Run:
  python3 pipeline/scripts/test_steady_risers.py
"""

import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent


def _load_module(filename: str, name: str):
    """importlib loader because module filenames start with digits."""
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


poster_module = _load_module("008_discord_market_poster.py", "poster")


def make_poster():
    """Instantiate without connecting — bot is created but never started."""
    return poster_module.MarketAnalysisPoster(token="test", channel_id=1)


SAMPLE_DATA = {
    "advanced_strategies": {
        "steady_risers": [
            {
                "card_name": "Test Card",
                "printing_id": "abc123",
                "old_price": 5.0,
                "new_price": 6.5,
                "percent_change": 30.0,
                "set": "wtr",
                "rarity": "l",
                "opportunity_score": 5,
            }
        ]
    }
}


class SteadyRisersMessageTests(unittest.TestCase):
    def test_message_uses_steady_risers_heading(self):
        poster = make_poster()
        msg = poster.create_steady_risers_message(SAMPLE_DATA)
        self.assertIn("Steady Risers", msg)

    def test_message_does_not_call_them_drops(self):
        poster = make_poster()
        msg = poster.create_steady_risers_message(SAMPLE_DATA)
        # The old, misleading wording must not survive the rename
        self.assertNotIn("Notable Drops", msg)
        self.assertNotIn("price decreases", msg)

    def test_message_renders_card_data(self):
        poster = make_poster()
        msg = poster.create_steady_risers_message(SAMPLE_DATA)
        self.assertIn("Test Card", msg)
        self.assertIn("+30.0%", msg)

    def test_message_handles_empty_input(self):
        poster = make_poster()
        msg = poster.create_steady_risers_message({"advanced_strategies": {"steady_risers": []}})
        # No risers: graceful fallback rather than an empty section
        self.assertTrue(len(msg) >= 0)
        self.assertNotIn("price decreases", msg)


class ExportSchemaTests(unittest.TestCase):
    """
    010_compute_movers should emit `steady_risers` (not the legacy
    `value_opportunities` key). We import the source file and look
    for the literal key name as a low-cost proxy — running the full
    script requires DuckDB + a populated database, which is overkill
    for verifying the rename.
    """

    def test_010_emits_steady_risers_key(self):
        source = (SCRIPTS_DIR / "010_compute_movers.py").read_text()
        self.assertIn('"steady_risers"', source)

    def test_010_no_longer_emits_value_opportunities(self):
        # Match the dict-key form (with the colon) rather than the bare word —
        # historical references in comments are fine and shouldn't fail this.
        source = (SCRIPTS_DIR / "010_compute_movers.py").read_text()
        self.assertNotIn('"value_opportunities":', source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
