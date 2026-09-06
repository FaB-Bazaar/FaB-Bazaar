#!/usr/bin/env python3
"""
fab-cube ships every double-faced BACK printing with
`double_sided_card_info[0].other_face_unique_id` equal to the back's OWN
unique_id (107/107 back faces in the 2026-09 feed), while the FRONT links
correctly to the back. Copying that verbatim gave `printings` 322 self-linked
back rows, and the search enrichment rendered e.g. Nitro Mechanoid as its own
flip target. The transformer owns other_face_printing_id (005 upserts it
nightly), so the reverse resolution has to live here: a back face whose link
is missing or self-referential takes the front that points at it.

Run:
  python3 pipeline/scripts/test_dfc_back_link.py
"""

import importlib.util
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


def make_card(card_uid, name, printing_uid, dfc):
    return {
        "unique_id": card_uid,
        "name": name,
        "types": ["Mechanologist", "Action"],
        "pitch": "2",
        "printings": [
            {
                "unique_id": printing_uid,
                "id": "GEM119",
                "set_id": "GEM",
                "edition": "N",
                "foiling": "S",
                "rarity": "M",
                "double_sided_card_info": dfc,
            }
        ],
    }


FRONT = make_card("card-front", "Construct Nitro Mechanoid", "p-front",
                  [{"other_face_unique_id": "p-back", "is_front": True, "is_DFC": True}])
# The feed's corrupt shape: the back points at ITSELF.
BACK_SELF = make_card("card-back", "Nitro Mechanoid", "p-back",
                      [{"other_face_unique_id": "p-back", "is_front": False, "is_DFC": True}])
BACK_NONE = make_card("card-back", "Nitro Mechanoid", "p-back",
                      [{"other_face_unique_id": None, "is_front": False, "is_DFC": True}])


def make_pair(dfc_front, dfc_back, set_id="AMX", cid="AMX022", foiling="S"):
    """A transform pair as the feed ships it: two cards, one printing each,
    sharing (set, collector, edition, foiling); the back's image ends in
    _BACK.webp. dfc_* is the double_sided_card_info list (or None)."""
    def printing(uid, dfc, back):
        p = {
            "unique_id": uid, "id": cid, "set_id": set_id, "edition": "N",
            "foiling": foiling, "rarity": "M",
            "image_url": f"https://s3/large/{cid}{'_BACK' if back else ''}.webp",
        }
        if dfc is not None:
            p["double_sided_card_info"] = dfc
        return p
    front = {"unique_id": "card-cbb", "name": "Construct Bank Breaker",
             "types": ["Mechanologist", "Action"], "pitch": "3",
             "printings": [printing("p-cbb", dfc_front, False)]}
    back = {"unique_id": "card-bb", "name": "Bank Breaker",
            "types": ["Mechanologist", "Weapon"], "pitch": "",
            "printings": [printing("p-bb", dfc_back, True)]}
    return front, back


# AMX022 as shipped: linkage present but is_DFC FALSE on both faces.
AMX_FRONT, AMX_BACK = make_pair(
    [{"other_face_unique_id": "p-bb", "is_front": True, "is_DFC": False}],
    [{"other_face_unique_id": "p-bb", "is_front": False, "is_DFC": False}],
)
# JDG052 as shipped: no double_sided_card_info at all on either face.
JDG_FRONT, JDG_BACK = make_pair(None, None, set_id="JDG", cid="JDG052", foiling="C")


class UnflaggedTransformPairTests(unittest.TestCase):
    """Bank Breaker: fab-cube never flags the pair is_DFC, so the deck view
    could not show the back. Pair by natural key + the _BACK image instead."""

    def setUp(self):
        self.t = transformer_module.CardsToPrintingsTransformer()

    def _doc(self, card):
        docs = self.t.transform_card_to_printings(card)
        self.assertEqual(len(docs), 1)
        return docs[0]

    def test_is_dfc_false_pair_is_still_linked_both_ways(self):
        self.t.index_face_links([AMX_FRONT, AMX_BACK])
        f, b = self._doc(AMX_FRONT), self._doc(AMX_BACK)
        self.assertTrue(f["is_front_face"]);  self.assertEqual(f["other_face_printing_id"], "p-bb")
        self.assertFalse(b["is_front_face"]); self.assertEqual(b["other_face_printing_id"], "p-cbb")

    def test_no_dfc_info_pair_is_linked_via_back_image(self):
        self.t.index_face_links([JDG_FRONT, JDG_BACK])
        f, b = self._doc(JDG_FRONT), self._doc(JDG_BACK)
        self.assertTrue(f["is_front_face"]);  self.assertEqual(f["other_face_printing_id"], "p-bb")
        self.assertFalse(b["is_front_face"]); self.assertEqual(b["other_face_printing_id"], "p-cbb")

    def test_two_unrelated_cards_sharing_a_number_are_not_paired(self):
        # Might // Vigor share a collector number in one set but neither image
        # is a _BACK: they are two single-faced cards, not a pair.
        a, b = make_pair(None, None, cid="ZZZ001")
        b["printings"][0]["image_url"] = "https://s3/large/ZZZ001-alt.webp"
        self.t.index_face_links([a, b])
        self.assertIsNone(self._doc(a)["other_face_printing_id"])
        self.assertIsNone(self._doc(b)["other_face_printing_id"])
        self.assertTrue(self._doc(b)["is_front_face"])


class DfcBackLinkTests(unittest.TestCase):
    def setUp(self):
        self.t = transformer_module.CardsToPrintingsTransformer()

    def _doc(self, card):
        docs = self.t.transform_card_to_printings(card)
        self.assertEqual(len(docs), 1)
        return docs[0]

    def test_front_link_is_copied_as_is(self):
        self.t.index_face_links([FRONT, BACK_SELF])
        doc = self._doc(FRONT)
        self.assertTrue(doc["is_front_face"])
        self.assertEqual(doc["other_face_printing_id"], "p-back")

    def test_self_linked_back_resolves_to_the_front_pointing_at_it(self):
        self.t.index_face_links([FRONT, BACK_SELF])
        doc = self._doc(BACK_SELF)
        self.assertFalse(doc["is_front_face"])
        self.assertEqual(doc["other_face_printing_id"], "p-front")

    def test_unlinked_back_resolves_to_the_front_pointing_at_it(self):
        self.t.index_face_links([FRONT, BACK_NONE])
        doc = self._doc(BACK_NONE)
        self.assertEqual(doc["other_face_printing_id"], "p-front")

    def test_self_link_is_never_emitted_even_without_a_front(self):
        # No front in the feed points at this back: better NULL than a
        # self-reference the app has to special-case.
        self.t.index_face_links([BACK_SELF])
        doc = self._doc(BACK_SELF)
        self.assertIsNone(doc["other_face_printing_id"])
        self.assertFalse(doc["is_front_face"])

    def test_without_indexing_a_self_link_is_still_dropped(self):
        doc = self._doc(BACK_SELF)
        self.assertIsNone(doc["other_face_printing_id"])


if __name__ == "__main__":
    unittest.main()
