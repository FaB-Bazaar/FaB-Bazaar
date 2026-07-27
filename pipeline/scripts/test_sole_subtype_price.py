#!/usr/bin/env python3
"""
Tests for the sole-subtype price fallback in 002_tcg_price_enhancer.py.

TCGplayer's subTypeName does not always agree with our (edition, foiling):

  * promos we store as edition='n' are often labelled "1st Edition ..."
    (TEA001 Dorinthea Ironsong -> "1st Edition Normal", LGS012 Crucible of
    Aetherweave -> "1st Edition Cold Foil"),
  * gold foils are listed by TCGplayer as Cold Foil, while get_subtype_name()
    maps foiling='g' to "Normal" for edition='n',
  * some foilings simply disagree (TNP cold vs rainbow).

Exact-match-only left 280 English printings with a valid product id and no
price at all — 639 copies across 128 binders — including FAB001 at $55,000.

When a product offers exactly ONE priced subtype there is nothing to choose
between, so that price is unambiguously the price of that product. Products
with 2+ priced subtypes still demand an exact match: guessing between
"1st Edition Rainbow Foil" and "Unlimited Edition Normal" is what produces
the misleading data the exact-match rule exists to prevent.
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


enhancer_mod = _load_module("tcg_price_enhancer_002", "002_tcg_price_enhancer.py")


def _price(low, sub, market=None):
    return {
        "tcg_low": low,
        "tcg_mid": low,
        "tcg_high": low,
        "tcg_market": market,
        "tcgplayer_subTypeName": sub,
    }


class SoleSubtypeFallbackTests(unittest.TestCase):
    def setUp(self):
        self.enh = enhancer_mod.TCGPriceEnhancer.__new__(enhancer_mod.TCGPriceEnhancer)

    def test_exact_match_still_wins(self):
        """An exact subtype match must be preferred and reported as exact."""
        prices = {
            "Unlimited Edition Rainbow Foil": _price(0.25, "Unlimited Edition Rainbow Foil"),
            "1st Edition Rainbow Foil": _price(4.76, "1st Edition Rainbow Foil"),
        }
        info, quality = self.enh.find_best_price_match(
            prices, "Unlimited Edition Rainbow Foil", "u", "r"
        )
        self.assertEqual(quality, "exact")
        self.assertEqual(info["tcg_low"], 0.25)

    def test_sole_priced_subtype_is_used_when_name_differs(self):
        """TEA001: we ask for "Normal", TCGplayer only offers "1st Edition Normal"."""
        prices = {"1st Edition Normal": _price(10.0, "1st Edition Normal")}
        info, quality = self.enh.find_best_price_match(prices, "Normal", "n", "s")
        self.assertEqual(quality, "sole_subtype")
        self.assertEqual(info["tcg_low"], 10.0)

    def test_gold_foil_listed_as_cold_foil(self):
        """FAB gold foils: TCGplayer has no "Gold Foil" subtype and lists them as Cold Foil."""
        prices = {"1st Edition Cold Foil": _price(55000.0, "1st Edition Cold Foil")}
        info, quality = self.enh.find_best_price_match(prices, "Cold Foil", "n", "g")
        self.assertEqual(quality, "sole_subtype")
        self.assertEqual(info["tcg_low"], 55000.0)

    def test_gold_foil_asks_for_cold_foil(self):
        """
        get_subtype_name mapped foiling='g' to "Normal" for edition='n', which
        contradicted its own 1st-Edition branch ('G' -> "1st Edition Cold Foil")
        and asked TCGplayer for a treatment the card doesn't have.
        """
        self.assertEqual(self.enh.get_subtype_name("n", "g"), "Cold Foil")
        self.assertEqual(self.enh.get_subtype_name("f", "g"), "1st Edition Cold Foil")


class TreatmentGuardTests(unittest.TestCase):
    """
    The sole-subtype fallback must never cross a foil treatment.

    When a foil variant's listings sell out, the product is left with only its
    non-foil subtype priced. Falling back onto that silently reprices the foil
    at the non-foil price (GEM165: Rainbow Foil $21.51 -> Normal $7.42). The
    edition prefix is safe to ignore; the treatment is not.
    """

    def setUp(self):
        self.enh = enhancer_mod.TCGPriceEnhancer.__new__(enhancer_mod.TCGPriceEnhancer)

    def test_rainbow_foil_does_not_fall_back_to_normal(self):
        """GEM165 — the regression that motivated this guard."""
        prices = {"Normal": _price(7.42, "Normal")}
        info, quality = self.enh.find_best_price_match(prices, "Rainbow Foil", "n", "r")
        self.assertIsNone(info)
        self.assertIsNone(quality)

    def test_cold_foil_does_not_fall_back_to_rainbow_foil(self):
        """TNP-style foiling disagreements stay unpriced rather than guess."""
        prices = {"Rainbow Foil": _price(94.99, "Rainbow Foil")}
        info, quality = self.enh.find_best_price_match(prices, "Cold Foil", "n", "c")
        self.assertIsNone(info)
        self.assertIsNone(quality)

    def test_normal_does_not_fall_back_to_rainbow_foil(self):
        prices = {"Rainbow Foil": _price(19.99, "Rainbow Foil")}
        info, quality = self.enh.find_best_price_match(prices, "Normal", "n", "s")
        self.assertIsNone(info)
        self.assertIsNone(quality)

    def test_edition_prefix_differences_are_still_allowed(self):
        """Same treatment, different edition label — the 172-row class."""
        for expected, offered in (
            ("Normal", "1st Edition Normal"),
            ("Cold Foil", "1st Edition Cold Foil"),
            ("Rainbow Foil", "Unlimited Edition Rainbow Foil"),
            ("1st Edition Normal", "Normal"),
        ):
            with self.subTest(expected=expected, offered=offered):
                info, quality = self.enh.find_best_price_match(
                    {offered: _price(1.23, offered)}, expected, "n", "s"
                )
                self.assertEqual(quality, "sole_subtype", f"{expected} <- {offered}")
                self.assertEqual(info["tcg_low"], 1.23)

    def test_multiple_priced_subtypes_still_require_exact_match(self):
        """Guessing between real alternatives is what produces misleading prices."""
        prices = {
            "1st Edition Normal": _price(0.30, "1st Edition Normal"),
            "Unlimited Edition Normal": _price(0.19, "Unlimited Edition Normal"),
            "1st Edition Rainbow Foil": _price(4.00, "1st Edition Rainbow Foil"),
        }
        info, quality = self.enh.find_best_price_match(prices, "Cold Foil", "n", "c")
        self.assertIsNone(info)
        self.assertIsNone(quality)

    def test_unpriced_subtypes_do_not_count_toward_the_sole_match(self):
        """A null-priced sibling must not make a real one look ambiguous."""
        prices = {
            "1st Edition Cold Foil": _price(26.24, "1st Edition Cold Foil"),
            "1st Edition Normal": _price(None, "1st Edition Normal"),
        }
        info, quality = self.enh.find_best_price_match(prices, "Cold Foil", "n", "c")
        self.assertEqual(quality, "sole_subtype")
        self.assertEqual(info["tcg_low"], 26.24)

    def test_sole_subtype_with_no_price_yields_nothing(self):
        """An unlisted product stays unpriced rather than importing a null."""
        prices = {"1st Edition Normal": _price(None, "1st Edition Normal")}
        info, quality = self.enh.find_best_price_match(prices, "Normal", "n", "s")
        self.assertIsNone(info)
        self.assertIsNone(quality)

    def test_no_prices_at_all_yields_nothing(self):
        info, quality = self.enh.find_best_price_match({}, "Normal", "n", "s")
        self.assertIsNone(info)
        self.assertIsNone(quality)


if __name__ == "__main__":
    unittest.main()
