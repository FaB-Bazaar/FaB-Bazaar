#!/usr/bin/env python3
"""
Tests for parse_hero_essences in 003_cards_to_printings_transformer.

The cards.essences column is the source of truth for which essence card
pools a hero grants access to (Terra → earth, Oldhim → earth+ice, etc.).
The pipeline parses these from the hero card's "essence of X" keywords
because FAB has no other structured field for them.

Only hero rows should have essences populated — non-hero cards with
"essence of X" in keywords (e.g. fusion abilities) must not be misread
as granting essence access.

Run:
  python3 pipeline/scripts/test_hero_essences.py
"""

import importlib.util
import sys
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


def make_transformer():
    return transformer_module.CardsToPrintingsTransformer()


class ParseHeroEssencesTests(unittest.TestCase):
    def test_single_essence(self):
        t = make_transformer()
        card = {
            "name": "Terra",
            "types": ["elemental", "guardian", "hero", "young"],
            "card_keywords": ["essence of earth"],
        }
        self.assertEqual(t.parse_hero_essences(card), ["earth"])

    def test_two_essences_joined_by_and(self):
        t = make_transformer()
        card = {
            "name": "Oldhim",
            "types": ["elemental", "guardian", "hero", "young"],
            "card_keywords": ["essence of earth and ice"],
        }
        self.assertEqual(
            sorted(t.parse_hero_essences(card)), ["earth", "ice"]
        )

    def test_three_essences_comma_separated(self):
        t = make_transformer()
        card = {
            "name": "Bravo, Star of the Show",
            "types": ["elemental", "guardian", "hero", "adult"],
            "card_keywords": ["essence of earth, ice, and lightning"],
        }
        self.assertEqual(
            sorted(t.parse_hero_essences(card)),
            ["earth", "ice", "lightning"],
        )

    def test_three_essences_split_across_array_elements(self):
        # Upstream source for Bravo, Star of the Show splits the essence list
        # across multiple card_keywords entries instead of giving us a single
        # comma-joined string. The parser must merge contiguous non-"essence
        # of" continuations into the preceding essence entry.
        t = make_transformer()
        card = {
            "name": "Bravo, Star of the Show",
            "types": ["elemental", "guardian", "hero", "adult"],
            "card_keywords": ["Essence of Earth", "Ice", "and Lightning"],
        }
        self.assertEqual(
            sorted(t.parse_hero_essences(card)),
            ["earth", "ice", "lightning"],
        )

    def test_no_keywords_returns_empty(self):
        t = make_transformer()
        card = {
            "name": "Tuffnut",
            "types": ["revered", "brute", "hero", "young"],
            "card_keywords": [],
        }
        self.assertEqual(t.parse_hero_essences(card), [])

    def test_non_hero_card_returns_empty_even_with_essence_keyword(self):
        # Cards with fusion abilities (e.g. "Channel Lake Frigid") can have
        # "essence of ice" in their text/keywords. They are NOT heroes and
        # MUST NOT have essences populated — that's a hero-only concept.
        t = make_transformer()
        card = {
            "name": "Channel Lake Frigid",
            "types": ["action", "ice", "wizard"],
            "card_keywords": ["essence of ice"],
        }
        self.assertEqual(t.parse_hero_essences(card), [])

    def test_case_insensitive_and_normalized(self):
        t = make_transformer()
        card = {
            "name": "Briar",
            "types": ["elemental", "runeblade", "hero", "young"],
            "card_keywords": ["Essence of Earth and Lightning"],
        }
        self.assertEqual(
            sorted(t.parse_hero_essences(card)),
            ["earth", "lightning"],
        )


if __name__ == "__main__":
    unittest.main()
