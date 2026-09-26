#!/usr/bin/env python3
"""
Tests for 009_provisional_tcg_pricer.py — TCGplayer ids + prices for
provisional (CardVault-ingested, fab_cube_printing_id IS NULL) printings.

Why: a new set lives almost entirely in provisional rows until fab-cube adopts
it (IAR at launch: 516 en rows, 11 in the feed), and 002 prices FEED
printings only — so the whole set showed no prices while TCGplayer already
listed it. 009 matches provisional rows to their set's tcgcsv products by
collector number + variant class (same product-name rules as 002) and
reprices them nightly.

  product name suffix   ↔  DB row
  (none)                ↔  base printing
  "(Marvel)"            ↔  rarity 'v'
  "(Extended Art)"      ↔  'EA' in art_variations
  "(Alternate Art)"     ↔  'AA' in art_variations
  "(Red|Yellow|Blue)"   ↔  pitch, NOT a variant

Foiling never selects the product (one product carries every treatment as
a price subtype), so both faces of a double-faced print share one product.
"""

import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def _load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


pricer = _load_module("provisional_tcg_pricer_009", "009_provisional_tcg_pricer.py")


def _product(pid, name, number):
    return {
        "productId": pid,
        "name": name,
        "url": f"https://www.tcgplayer.com/product/{pid}/flesh-and-blood-tcg",
        "extendedData": [{"name": "Number", "displayName": "Number", "value": number}],
    }


def _row(printing_id, number, foiling="s", rarity="c", art=None, set_code="iar",
         edition="n", product_id=None, name=None):
    return {
        "printing_id": printing_id,
        "name": name,
        "set": set_code,
        "collector_number": number,
        "edition": edition,
        "foiling": foiling,
        "rarity": rarity,
        "art_variations": list(art or []),
        "tcgplayer_product_id": product_id,
    }


def _price(low, mid=None, high=None, market=None, subtype="Normal"):
    return {"tcg_low": low, "tcg_mid": mid, "tcg_high": high, "tcg_market": market,
            "tcgplayer_subTypeName": subtype}


class MatchProductsTest(unittest.TestCase):
    def test_base_row_gets_its_base_product(self):
        rows = [_row("p1", "IAR010")]
        result = pricer.match_products(rows, {"iar": [_product(700, "Some Card", "IAR010")]})
        self.assertEqual(result["assignments"]["p1"]["productId"], 700)

    def test_both_faces_and_every_foiling_share_one_product(self):
        rows = [_row("front", "IAR106"), _row("back", "IAR106"), _row("rf", "IAR106", foiling="r")]
        result = pricer.match_products(rows, {"iar": [_product(701, "Viserai // Viserai", "IAR106")]})
        self.assertEqual({k: v["productId"] for k, v in result["assignments"].items()},
                         {"front": 701, "back": 701, "rf": 701})

    def test_marvel_row_matches_the_marvel_product_not_the_base(self):
        rows = [_row("base", "IAR002"), _row("marvel", "IAR002", foiling="c", rarity="v", art=["FA"])]
        products = [_product(710, "Levia", "IAR002"), _product(711, "Levia (Marvel)", "IAR002")]
        result = pricer.match_products(rows, {"iar": products})
        self.assertEqual(result["assignments"]["base"]["productId"], 710)
        self.assertEqual(result["assignments"]["marvel"]["productId"], 711)

    def test_marvel_without_its_own_product_stays_unmatched(self):
        # IAR Runechant Marvels: TCGplayer lists only the regular token.
        rows = [_row("marvel", "IAR145", foiling="c", rarity="v", art=["FA"])]
        result = pricer.match_products(rows, {"iar": [_product(720, "Runechant of Greed", "IAR145")]})
        self.assertNotIn("marvel", result["assignments"])
        self.assertEqual([u["printing_id"] for u in result["unmatched"]], ["marvel"])

    def test_pitch_suffix_is_not_a_variant(self):
        rows = [_row("p1", "IAR001", rarity="f")]
        result = pricer.match_products(rows, {"iar": [_product(730, "Arknight Shard (Blue)", "IAR001")]})
        self.assertEqual(result["assignments"]["p1"]["productId"], 730)

    def test_extended_art_row_matches_extended_art_product(self):
        rows = [_row("ea", "IAR242", art=["EA"])]
        products = [_product(740, "Cracked Bauble", "IAR242"),
                    _product(741, "Cracked Bauble (Extended Art)", "IAR242")]
        result = pricer.match_products(rows, {"iar": products})
        self.assertEqual(result["assignments"]["ea"]["productId"], 741)

    def test_row_that_already_has_an_id_is_left_alone(self):
        rows = [_row("p1", "IAR010", product_id="999")]
        result = pricer.match_products(rows, {"iar": [_product(700, "Some Card", "IAR010")]})
        self.assertEqual(result["assignments"], {})

    def test_two_products_of_the_same_class_are_ambiguous_not_guessed(self):
        rows = [_row("p1", "IAR010")]
        products = [_product(700, "Some Card", "IAR010"), _product(701, "Other Card", "IAR010")]
        result = pricer.match_products(rows, {"iar": products})
        self.assertEqual(result["assignments"], {})
        self.assertEqual(result["ambiguous"][0]["product_ids"], [700, 701])

    def test_product_with_another_cards_name_is_rejected(self):
        # TCGplayer lists GEM207/GEM208 swapped (CardVault: GEM207 = Walker).
        rows = [_row("walker", "GEM207", set_code="gem", name="Shadowrealm Walker")]
        result = pricer.match_products(rows, {"gem": [_product(750, "Shadowrealm Ripper", "GEM207")]})
        self.assertEqual(result["assignments"], {})
        self.assertEqual(result["name_mismatch"][0]["product_name"], "Shadowrealm Ripper")

    def test_name_check_accepts_back_faces_and_listing_suffixes(self):
        rows = [_row("back", "IAR107", name="Viserai, Usurper"),
                _row("lay", "FAB513", set_code="fab", name="Lay Low")]
        result = pricer.match_products(rows, {
            "iar": [_product(760, "Viserai, Between Worlds // Viserai Usurper", "IAR107")],
            "fab": [_product(761, "Lay Low (Yellow) - FAB513", "FAB513")],
        })
        self.assertEqual(set(result["assignments"]), {"back", "lay"})

    def test_products_only_match_rows_of_their_own_set(self):
        rows = [_row("p1", "IAR010", set_code="xyz")]
        result = pricer.match_products(rows, {"iar": [_product(700, "Some Card", "IAR010")]})
        self.assertEqual(result["assignments"], {})


class PriceGroupsTest(unittest.TestCase):
    def test_prices_come_from_every_mapped_group_not_just_the_rows_set(self):
        # An admin-set id can point into another set's group (IAR159 rainbow
        # Baalghor lives in the price-only pre-release group 24776).
        mappings = {"iar": [24762, 24640], "iar-prerelease": [24776], "omn": [24640]}
        self.assertEqual(pricer.price_group_ids(mappings), [24640, 24762, 24776])


class BuildPriceUpdatesTest(unittest.TestCase):
    def test_row_is_priced_from_its_treatments_subtype(self):
        rows = [_row("rf", "IAR010", foiling="r", product_id="700")]
        prices = {700: {"Normal": _price(0.1, subtype="Normal"),
                        "Rainbow Foil": _price(2.5, 3.0, 9.0, 2.75, subtype="Rainbow Foil")}}
        updates = dict(pricer.build_price_updates(rows, prices))
        payload = updates["rf"]
        self.assertEqual((payload["tcg_low"], payload["tcg_mid"], payload["tcg_high"], payload["tcg_market"]),
                         (2.5, 3.0, 9.0, 2.75))
        self.assertEqual(payload["tcgplayer_subtype_name"], "Rainbow Foil")
        self.assertTrue(payload["has_price"])
        self.assertTrue(payload["is_under_5"])
        self.assertFalse(payload["is_budget"])

    def test_foil_row_is_never_priced_off_the_non_foil_subtype(self):
        rows = [_row("cf", "IAR161", foiling="c", product_id="715")]
        updates = dict(pricer.build_price_updates(rows, {715: {"Normal": _price(0.15)}}))
        payload = updates["cf"]
        self.assertIsNone(payload["tcg_low"])
        self.assertIsNone(payload["tcgplayer_subtype_name"])
        self.assertFalse(payload["has_price"])

    def test_row_whose_product_was_not_fetched_is_not_touched(self):
        # A failed group fetch must not wipe yesterday's prices.
        rows = [_row("p1", "IAR010", product_id="700")]
        self.assertEqual(pricer.build_price_updates(rows, {}), [])

    def test_row_without_a_product_id_is_skipped(self):
        rows = [_row("p1", "IAR010")]
        self.assertEqual(pricer.build_price_updates(rows, {700: {"Normal": _price(1.0)}}), [])


if __name__ == "__main__":
    unittest.main()
