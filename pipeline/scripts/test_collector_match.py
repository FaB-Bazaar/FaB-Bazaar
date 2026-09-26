#!/usr/bin/env python3
"""
Tests for collector-number product matching in 002_tcg_price_enhancer.py.

The fab-cube feed ships new sets WITHOUT tcgplayer_product_id for weeks
(IAR: 505 printings, 0 ids on both develop and the set branch), and 002
prices only printings that carry an id — so a whole set has no prices and
no buy links even though TCGplayer lists it. tcgcsv products carry the
collector number ("Number" in extendedData), so a printing with no feed id
can be resolved inside its set's own group(s):

  product name suffix   ↔  feed printing
  (none)                ↔  base printing
  "(Marvel)"            ↔  rarity V
  "(Extended Art)"      ↔  'EA' in art_variations
  "(Alternate Art)"     ↔  'AA' in art_variations
  "(Red|Yellow|Blue)"   ↔  pitch, NOT a variant

Feed ids are never overwritten — feed_overrides own corrections.
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


enhancer_mod = _load_module("tcg_price_enhancer_002_cm", "002_tcg_price_enhancer.py")


def _product(pid, name, number, rarity="Common"):
    return {
        "productId": pid,
        "name": name,
        "url": f"https://www.tcgplayer.com/product/{pid}/flesh-and-blood-tcg",
        "extendedData": [
            {"name": "Rarity", "displayName": "Rarity", "value": rarity},
            {"name": "Number", "displayName": "Number", "value": number},
        ],
    }


def _printing(number, set_id="IAR", foiling="S", rarity="C", art=None, product_id=None):
    p = {
        "unique_id": f"uid-{number}-{foiling}-{'-'.join(art or [])}",
        "id": number,
        "set_id": set_id,
        "edition": "N",
        "foiling": foiling,
        "rarity": rarity,
        "art_variations": list(art or []),
    }
    if product_id is not None:
        p["tcgplayer_product_id"] = product_id
        p["tcgplayer_url"] = f"https://www.tcgplayer.com/product/{product_id}"
    return p


def _cards(*printings):
    return [{"name": "Test Card", "printings": list(printings)}]


IAR_PRODUCTS = [
    _product(706637, "Soul of Existence", "IAR000", "Fabled"),
    _product(706638, "Arknight Shard (Blue)", "IAR001"),
    _product(706700, "Levia", "IAR002", "Majestic"),
    _product(706701, "Levia (Marvel)", "IAR002", "Marvel"),
    _product(706800, "Appalling Bearers", "IAR056", "Majestic"),
    _product(706801, "Appalling Bearers (Extended Art)", "IAR056", "Majestic"),
]


class VariantClassTests(unittest.TestCase):
    def test_plain_name_is_base(self):
        self.assertEqual(enhancer_mod.product_variant("Soul of Existence"), "base")

    def test_pitch_suffix_is_not_a_variant(self):
        self.assertEqual(enhancer_mod.product_variant("Arknight Shard (Blue)"), "base")

    def test_marvel_suffix(self):
        self.assertEqual(enhancer_mod.product_variant("Levia (Marvel)"), "marvel")

    def test_extended_art_suffix(self):
        self.assertEqual(enhancer_mod.product_variant("Appalling Bearers (Extended Art)"), "ea")

    def test_alternate_art_suffix(self):
        self.assertEqual(enhancer_mod.product_variant("Fast and Furious (Alternate Art)"), "aa")

    def test_printing_marvel_is_rarity_v(self):
        self.assertEqual(enhancer_mod.printing_variant(_printing("IAR002", rarity="V", art=["FA"])), "marvel")

    def test_printing_extended_art(self):
        self.assertEqual(enhancer_mod.printing_variant(_printing("IAR056", art=["EA"])), "ea")

    def test_printing_base(self):
        self.assertEqual(enhancer_mod.printing_variant(_printing("IAR001")), "base")


class ResolveMissingProductIdsTests(unittest.TestCase):
    def test_base_printing_gets_the_plain_product(self):
        cards = _cards(_printing("IAR001", foiling="S"), _printing("IAR001", foiling="R"))
        stats = enhancer_mod.resolve_missing_product_ids(cards, {"iar": IAR_PRODUCTS})

        s, r = cards[0]["printings"]
        # Both foilings share the product — subtypes tell them apart at price time.
        self.assertEqual(s["tcgplayer_product_id"], "706638")
        self.assertEqual(r["tcgplayer_product_id"], "706638")
        self.assertEqual(s["tcgplayer_url"], "https://www.tcgplayer.com/product/706638/flesh-and-blood-tcg")
        self.assertEqual(stats["assigned"], 2)

    def test_marvel_and_base_split_by_suffix(self):
        cards = _cards(_printing("IAR002", rarity="M"), _printing("IAR002", rarity="V", foiling="C", art=["FA"]))
        enhancer_mod.resolve_missing_product_ids(cards, {"iar": IAR_PRODUCTS})
        base, marvel = cards[0]["printings"]
        self.assertEqual(base["tcgplayer_product_id"], "706700")
        self.assertEqual(marvel["tcgplayer_product_id"], "706701")

    def test_extended_art_split_by_suffix(self):
        cards = _cards(_printing("IAR056", rarity="M"), _printing("IAR056", rarity="M", foiling="C", art=["EA"]))
        enhancer_mod.resolve_missing_product_ids(cards, {"iar": IAR_PRODUCTS})
        base, ea = cards[0]["printings"]
        self.assertEqual(base["tcgplayer_product_id"], "706800")
        self.assertEqual(ea["tcgplayer_product_id"], "706801")

    def test_feed_id_is_never_overwritten(self):
        cards = _cards(_printing("IAR001", product_id="999"))
        stats = enhancer_mod.resolve_missing_product_ids(cards, {"iar": IAR_PRODUCTS})
        self.assertEqual(cards[0]["printings"][0]["tcgplayer_product_id"], "999")
        self.assertEqual(stats["assigned"], 0)

    def test_no_product_for_number_is_reported_not_assigned(self):
        cards = _cards(_printing("IAR999"))
        stats = enhancer_mod.resolve_missing_product_ids(cards, {"iar": IAR_PRODUCTS})
        self.assertNotIn("tcgplayer_product_id", cards[0]["printings"][0])
        self.assertEqual([u["id"] for u in stats["unmatched"]], ["IAR999"])

    def test_variant_without_its_own_product_is_not_forced_onto_base(self):
        # A Marvel printing whose number only has a plain product while the
        # feed ALSO has the base printing: guessing would price the Marvel at
        # the base card's price.
        cards = _cards(_printing("IAR001"), _printing("IAR001", rarity="V", foiling="C", art=["FA"]))
        stats = enhancer_mod.resolve_missing_product_ids(cards, {"iar": IAR_PRODUCTS})
        base, marvel = cards[0]["printings"]
        self.assertEqual(base["tcgplayer_product_id"], "706638")
        self.assertNotIn("tcgplayer_product_id", marvel)
        self.assertEqual(len(stats["unmatched"]), 1)

    def test_sole_variant_printing_matches_the_sole_product(self):
        # IAR242 Cracked Bauble: the feed's ONLY printing is the EA one and
        # tcgcsv's ONLY product is plain-named — nothing else the product
        # could be, so it is that printing.
        products = [_product(716613, "Cracked Bauble", "IAR242", "Basic")]
        cards = _cards(_printing("IAR242", rarity="B", art=["EA"]))
        stats = enhancer_mod.resolve_missing_product_ids(cards, {"iar": products})
        self.assertEqual(cards[0]["printings"][0]["tcgplayer_product_id"], "716613")
        self.assertEqual(stats["assigned"], 1)

    def test_sole_product_is_not_forced_onto_a_variant_when_a_base_printing_exists(self):
        # IAR145 Runechant of Greed: base M + Marvel V in the feed, one plain
        # product — the plain product is the base; the Marvel stays idless.
        products = [_product(706701, "Runechant of Greed", "IAR145", "Majestic")]
        cards = _cards(_printing("IAR145", rarity="M"), _printing("IAR145", rarity="V", foiling="C", art=["FA"]))
        stats = enhancer_mod.resolve_missing_product_ids(cards, {"iar": products})
        base, marvel = cards[0]["printings"]
        self.assertEqual(base["tcgplayer_product_id"], "706701")
        self.assertNotIn("tcgplayer_product_id", marvel)
        self.assertEqual([u["id"] for u in stats["unmatched"]], ["IAR145"])

    def test_sole_product_is_never_paired_across_marvel_and_base(self):
        # The real IAR feed carries ONLY the Runechant Marvel (C/V/FA) and the
        # IAR group only the plain token — sole-to-sole paired them, pointing
        # the Marvel's buy link at the regular token.
        products = [_product(706701, "Runechant of Greed", "IAR145", "Majestic")]
        cards = _cards(_printing("IAR145", rarity="V", foiling="C", art=["FA"]))
        stats = enhancer_mod.resolve_missing_product_ids(cards, {"iar": products})
        self.assertNotIn("tcgplayer_product_id", cards[0]["printings"][0])
        self.assertEqual([u["id"] for u in stats["unmatched"]], ["IAR145"])

    def test_mv_suffixed_number_matches_the_marvel_printing(self):
        # The IAR Runechant Marvels were sold in OMN packs: TCGplayer lists
        # them in the OMN group as "IAR145-MV", "... (Yellow)(Marvel)".
        products = [_product(706701, "Runechant of Greed", "IAR145", "Majestic"),
                    _product(696172, "Runechant of Greed (Yellow)(Marvel)", "IAR145-MV", "Marvel")]
        cards = _cards(_printing("IAR145", rarity="V", foiling="C", art=["FA"]))
        enhancer_mod.resolve_missing_product_ids(cards, {"iar": products})
        self.assertEqual(cards[0]["printings"][0]["tcgplayer_product_id"], "696172")

    def test_two_same_class_products_is_ambiguous(self):
        products = IAR_PRODUCTS + [_product(706999, "Arknight Shard", "IAR001")]
        cards = _cards(_printing("IAR001"))
        stats = enhancer_mod.resolve_missing_product_ids(cards, {"iar": products})
        self.assertNotIn("tcgplayer_product_id", cards[0]["printings"][0])
        self.assertEqual([a["id"] for a in stats["ambiguous"]], ["IAR001"])

    def test_set_without_products_is_left_alone(self):
        cards = _cards(_printing("XYZ001", set_id="XYZ"))
        stats = enhancer_mod.resolve_missing_product_ids(cards, {"iar": IAR_PRODUCTS})
        self.assertNotIn("tcgplayer_product_id", cards[0]["printings"][0])
        self.assertEqual(stats["assigned"], 0)
        self.assertEqual(stats["unmatched"], [])

    def test_set_lookup_is_case_insensitive(self):
        cards = _cards(_printing("IAR001", set_id="iar"))
        enhancer_mod.resolve_missing_product_ids(cards, {"IAR": IAR_PRODUCTS})
        self.assertEqual(cards[0]["printings"][0]["tcgplayer_product_id"], "706638")


class SetsMissingIdsTests(unittest.TestCase):
    def test_lists_only_sets_with_a_group_and_an_idless_printing(self):
        cards = _cards(
            _printing("IAR001"),                       # idless, has group → yes
            _printing("SEA001", set_id="SEA", product_id="1"),  # has id → no
            _printing("XYZ001", set_id="XYZ"),          # idless, no group → no
        )
        group_mappings = {"iar": [24762], "IAR": [24762], "sea": [24266], "SEA": [24266]}
        self.assertEqual(enhancer_mod.sets_missing_product_ids(cards, group_mappings), {"iar": [24762]})


if __name__ == "__main__":
    unittest.main()
