#!/usr/bin/env python3
"""
Tests for feed_overrides application in 002_tcg_price_enhancer.py.

The feed_overrides table (migration 0095) patches the fab-cube feed BEFORE
price lookup, so a wrong upstream tcgplayer_product_id (e.g. the SEA015-017
Cloud City Steamboat cycle pointing at 1st Strike products) is corrected at
the source and correct prices flow through the whole pipeline.

Pure-function tests always run; the fetch_feed_overrides test needs a real
Postgres (same skip pattern as test_anchor_reconcile.py).
"""

import importlib.util
import os
import unittest
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent


def _load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


enhancer_mod = _load_module("tcg_price_enhancer_002", "002_tcg_price_enhancer.py")


def _db_url():
    url = os.environ.get("POSTGRES_URL_STAGING") or os.environ.get("POSTGRES_URL")
    if url:
        return url
    env_local = REPO_ROOT / ".env.local"
    if env_local.exists():
        for line in env_local.read_text().splitlines():
            if line.startswith("POSTGRES_URL="):
                return line.split("=", 1)[1].strip().strip('"')
    return None


def _cards_fixture():
    """Two cards, three printings — mirrors the enhanced-cards JSON shape."""
    return [
        {
            "name": "Cloud City Steamboat",
            "printings": [
                {
                    "id": "SEA016",
                    "edition": "N",
                    "foiling": "S",
                    "tcgplayer_product_id": "632114",
                    "tcgplayer_url": "https://www.tcgplayer.com/product/632643?Language=English&Printing=Normal",
                },
                {
                    "id": "SEA016",
                    "edition": "N",
                    "foiling": "R",
                    "tcgplayer_product_id": "632114",
                    "tcgplayer_url": "https://www.tcgplayer.com/product/632643?Language=English&Printing=Rainbow+Foil",
                },
            ],
        },
        {
            "name": "Command and Conquer",
            "printings": [
                {
                    "id": "ARC159",
                    "edition": "U",
                    "foiling": "S",
                    "tcgplayer_product_id": "100001",
                    "tcgplayer_url": "https://www.tcgplayer.com/product/100001?Language=English",
                },
            ],
        },
    ]


def _override(**kw):
    row = {
        "collector_number": "SEA016",
        "edition": None,
        "foiling": None,
        "language": "en",
        "set_fields": {"tcgplayer_product_id": "632643"},
    }
    row.update(kw)
    return row


class ApplyFeedOverridesTests(unittest.TestCase):
    def test_wildcard_override_patches_all_matching_printings(self):
        cards = _cards_fixture()
        stats = enhancer_mod.apply_feed_overrides(cards, [_override()])

        sea = cards[0]["printings"]
        self.assertEqual(sea[0]["tcgplayer_product_id"], "632643")
        self.assertEqual(sea[1]["tcgplayer_product_id"], "632643")
        # untouched card keeps its id
        self.assertEqual(cards[1]["printings"][0]["tcgplayer_product_id"], "100001")
        self.assertEqual(stats["applied"], 2)
        self.assertEqual(stats["unmatched"], [])

    def test_specific_foiling_only_patches_that_printing(self):
        cards = _cards_fixture()
        stats = enhancer_mod.apply_feed_overrides(cards, [_override(foiling="R")])

        sea = cards[0]["printings"]
        self.assertEqual(sea[0]["tcgplayer_product_id"], "632114")  # S untouched
        self.assertEqual(sea[1]["tcgplayer_product_id"], "632643")  # R patched
        self.assertEqual(stats["applied"], 1)

    def test_matching_is_case_insensitive(self):
        cards = _cards_fixture()
        stats = enhancer_mod.apply_feed_overrides(
            cards, [_override(collector_number="sea016", edition="n", foiling="r")]
        )
        self.assertEqual(cards[0]["printings"][1]["tcgplayer_product_id"], "632643")
        self.assertEqual(stats["applied"], 1)

    def test_only_whitelisted_fields_are_applied(self):
        cards = _cards_fixture()
        stats = enhancer_mod.apply_feed_overrides(
            cards,
            [_override(set_fields={
                "tcgplayer_product_id": "632643",
                "tcg_low": 0.01,          # price fields are computed, never overridden
                "rarity": "L",            # not a feed-correction field
            })],
        )
        printing = cards[0]["printings"][0]
        self.assertEqual(printing["tcgplayer_product_id"], "632643")
        self.assertNotIn("tcg_low", printing)
        self.assertNotIn("rarity", printing)
        self.assertIn("tcg_low", stats["ignored_fields"])
        self.assertIn("rarity", stats["ignored_fields"])

    def test_override_matching_nothing_is_reported(self):
        cards = _cards_fixture()
        stats = enhancer_mod.apply_feed_overrides(
            cards, [_override(collector_number="ZZZ999")]
        )
        self.assertEqual(stats["applied"], 0)
        self.assertEqual(len(stats["unmatched"]), 1)
        self.assertEqual(stats["unmatched"][0]["collector_number"], "ZZZ999")

    def test_non_english_override_is_skipped(self):
        cards = _cards_fixture()
        stats = enhancer_mod.apply_feed_overrides(cards, [_override(language="ja")])
        self.assertEqual(cards[0]["printings"][0]["tcgplayer_product_id"], "632114")
        self.assertEqual(stats["applied"], 0)
        self.assertEqual(stats["skipped_non_english"], 1)


def _art_variant_cards():
    """One collector key, two printings differing only in art_variations —
    the ELE146 Channel Lake Frigid shape that motivated migration 0096."""
    return [
        {
            "name": "Channel Lake Frigid",
            "printings": [
                {
                    "id": "ELE146",
                    "edition": "F",
                    "foiling": "R",
                    "art_variations": [],
                    "tcgplayer_product_id": "247879",
                },
                {
                    "id": "ELE146",
                    "edition": "F",
                    "foiling": "R",
                    "art_variations": ["AA"],
                    "tcgplayer_product_id": "247879",
                },
            ],
        },
    ]


class ArtVariationMatchingTests(unittest.TestCase):
    """art_variations discriminator (migration 0096): None = any (legacy),
    [] = only printings with no variant, ['AA'] = exact set match."""

    def test_aa_override_patches_only_the_alt_art_printing(self):
        cards = _art_variant_cards()
        stats = enhancer_mod.apply_feed_overrides(
            cards,
            [_override(collector_number="ELE146", edition="F", foiling="R",
                       art_variations=["AA"],
                       set_fields={"tcgplayer_product_id": "248564"})],
        )

        regular, alt = cards[0]["printings"]
        self.assertEqual(regular["tcgplayer_product_id"], "247879")
        self.assertEqual(alt["tcgplayer_product_id"], "248564")
        self.assertEqual(stats["applied"], 1)

    def test_empty_art_variations_patches_only_the_regular_printing(self):
        cards = _art_variant_cards()
        stats = enhancer_mod.apply_feed_overrides(
            cards,
            [_override(collector_number="ELE146", art_variations=[],
                       set_fields={"tcgplayer_product_id": "999999"})],
        )

        regular, alt = cards[0]["printings"]
        self.assertEqual(regular["tcgplayer_product_id"], "999999")
        self.assertEqual(alt["tcgplayer_product_id"], "247879")
        self.assertEqual(stats["applied"], 1)

    def test_missing_art_variations_stays_a_wildcard(self):
        cards = _art_variant_cards()
        stats = enhancer_mod.apply_feed_overrides(
            cards,
            [_override(collector_number="ELE146",
                       set_fields={"tcgplayer_product_id": "111111"})],
        )

        regular, alt = cards[0]["printings"]
        self.assertEqual(regular["tcgplayer_product_id"], "111111")
        self.assertEqual(alt["tcgplayer_product_id"], "111111")
        self.assertEqual(stats["applied"], 2)

    def test_art_variation_match_is_case_and_order_insensitive(self):
        cards = _art_variant_cards()
        cards[0]["printings"][1]["art_variations"] = ["DS", "aa"]
        stats = enhancer_mod.apply_feed_overrides(
            cards,
            [_override(collector_number="ELE146", art_variations=["AA", "ds"],
                       set_fields={"tcgplayer_product_id": "248564"})],
        )

        self.assertEqual(cards[0]["printings"][1]["tcgplayer_product_id"], "248564")
        self.assertEqual(stats["applied"], 1)

    def test_unmatched_art_variation_is_reported(self):
        cards = _art_variant_cards()
        stats = enhancer_mod.apply_feed_overrides(
            cards,
            [_override(collector_number="ELE146", art_variations=["XYZ"],
                       set_fields={"tcgplayer_product_id": "248564"})],
        )

        self.assertEqual(stats["applied"], 0)
        self.assertEqual(len(stats["unmatched"]), 1)


class ProductUrlMismatchTests(unittest.TestCase):
    def test_flags_printings_whose_product_id_disagrees_with_url(self):
        cards = _cards_fixture()
        mismatches = enhancer_mod.collect_product_url_mismatches(cards)

        flagged = {(m["printing_id"], m["foiling"]) for m in mismatches}
        self.assertEqual(flagged, {("SEA016", "S"), ("SEA016", "R")})
        self.assertEqual(mismatches[0]["product_id"], "632114")
        self.assertEqual(mismatches[0]["url_product_id"], "632643")

    def test_clean_after_override_applied(self):
        cards = _cards_fixture()
        enhancer_mod.apply_feed_overrides(cards, [_override()])
        self.assertEqual(enhancer_mod.collect_product_url_mismatches(cards), [])

    def test_printings_without_url_or_id_are_ignored(self):
        cards = [{"name": "X", "printings": [
            {"id": "AAA001", "edition": "N", "foiling": "S"},
            {"id": "AAA002", "edition": "N", "foiling": "S",
             "tcgplayer_product_id": "5", "tcgplayer_url": "https://example.com/no-product-segment"},
        ]}]
        self.assertEqual(enhancer_mod.collect_product_url_mismatches(cards), [])


@unittest.skipUnless(_db_url(), "no POSTGRES_URL available for fetch test")
class FetchFeedOverridesTests(unittest.TestCase):
    def setUp(self):
        import psycopg2
        self.conn = psycopg2.connect(_db_url())
        self.ids = []

    def tearDown(self):
        with self.conn.cursor() as cur:
            cur.execute("DELETE FROM feed_overrides WHERE id = ANY(%s)", (self.ids,))
        self.conn.commit()
        self.conn.close()

    def _insert(self, collector, active=True, art_variations=None):
        row_id = f"test-{uuid.uuid4()}"
        self.ids.append(row_id)
        with self.conn.cursor() as cur:
            cur.execute(
                """INSERT INTO feed_overrides
                   (id, collector_number, foiling, art_variations, set_fields, reason, active)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (row_id, collector, "R", art_variations,
                 '{"tcgplayer_product_id": "632643"}', "test row", active),
            )
        self.conn.commit()
        return row_id

    def test_fetch_returns_only_active_overrides(self):
        active_collector = f"ZT{uuid.uuid4().hex[:6].upper()}"
        inactive_collector = f"ZT{uuid.uuid4().hex[:6].upper()}"
        self._insert(active_collector, active=True)
        self._insert(inactive_collector, active=False)

        rows = enhancer_mod.fetch_feed_overrides(_db_url())

        collectors = {r["collector_number"] for r in rows}
        self.assertIn(active_collector, collectors)
        self.assertNotIn(inactive_collector, collectors)
        row = next(r for r in rows if r["collector_number"] == active_collector)
        self.assertEqual(row["foiling"], "R")
        self.assertEqual(row["set_fields"], {"tcgplayer_product_id": "632643"})
        self.assertEqual(row["language"], "en")
        # Wildcard rows carry art_variations = None (migration 0096).
        self.assertIsNone(row["art_variations"])

    def test_fetch_returns_art_variations(self):
        collector = f"ZT{uuid.uuid4().hex[:6].upper()}"
        self._insert(collector, active=True, art_variations=["AA"])

        rows = enhancer_mod.fetch_feed_overrides(_db_url())

        row = next(r for r in rows if r["collector_number"] == collector)
        self.assertEqual(row["art_variations"], ["AA"])


if __name__ == "__main__":
    unittest.main(verbosity=1)
