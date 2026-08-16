#!/usr/bin/env python3
"""
Pirate is a CLASS in Flesh and Blood (official LSS classification — dual-class
heroes like Puffin "Pirate Mechanologist", Marlynn "Pirate Ranger"). The
fab-cube feed lists it in `types` like any other class/talent word, and the
transformer used to file it under `talents`. Migration 0065 moved it to
`classes` once, but 005 upserts `classes`/`talents` from this transformer every
night, so the reclassification was silently reverted — and the /opt Class
filter (`cards.classes && ARRAY['pirate']`) matched zero cards on prod.

The transformer is the durable owner of these columns, so the classification
must live here.

Run:
  python3 pipeline/scripts/test_pirate_class.py
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


def make_card(types, name="Conqueror of the High Seas"):
    return {
        "unique_id": "test-card-uid",
        "name": name,
        "types": types,
        "pitch": "1",
        "printings": [
            {
                "unique_id": "test-printing-uid",
                "id": "SEA130",
                "set_id": "SEA",
                "edition": "N",
                "foiling": "S",
                "rarity": "M",
            }
        ],
    }


class PirateClassTests(unittest.TestCase):
    def setUp(self):
        self.t = transformer_module.CardsToPrintingsTransformer()

    def _doc(self, types):
        docs = self.t.transform_card_to_printings(make_card(types))
        self.assertEqual(len(docs), 1)
        return docs[0]

    def test_pirate_only_card_is_a_pirate_class_card(self):
        # Conqueror of the High Seas: "Pirate Action - Attack"
        doc = self._doc(["Pirate", "Action", "Attack"])
        self.assertEqual(doc["classes"], ["pirate"])
        self.assertEqual(doc["talents"], [])

    def test_pirate_only_card_is_not_generic(self):
        doc = self._doc(["Pirate", "Action", "Attack"])
        self.assertNotIn("generic", doc["classes"])
        self.assertFalse(doc["is_generic_only"])
        self.assertTrue(doc["has_class_only"])
        self.assertFalse(doc["has_talent_only"])

    def test_has_pirate_flag_still_set(self):
        # `cards.has_pirate` is a real column read by the hasPirate search
        # filter — it must keep tracking pirate cards after the move.
        doc = self._doc(["Pirate", "Action", "Attack"])
        self.assertTrue(doc["has_pirate"])
        self.assertFalse(self._doc(["Ninja", "Action", "Attack"])["has_pirate"])

    def test_dual_class_pirate_card(self):
        # Chart the High Seas: "Pirate Necromancer Action"
        doc = self._doc(["Pirate", "Necromancer", "Action"])
        self.assertEqual(sorted(doc["classes"]), ["necromancer", "pirate"])
        self.assertEqual(doc["talents"], [])
        self.assertTrue(doc["has_class_only"])
        self.assertFalse(doc["has_class_and_talent"])

    def test_pirate_hero_card(self):
        # Puffin: "Pirate Mechanologist Hero - Young"
        doc = self._doc(["Pirate", "Mechanologist", "Hero", "Young"])
        self.assertEqual(sorted(doc["classes"]), ["mechanologist", "pirate"])
        self.assertEqual(doc["talents"], [])
        self.assertTrue(doc["is_mechanologist"])

    def test_no_is_pirate_key_leaks_into_doc(self):
        # There is no cards.is_pirate column; 005 would drop the key silently,
        # but keep the doc honest so a future column-list sync doesn't trip.
        doc = self._doc(["Pirate", "Action", "Attack"])
        self.assertNotIn("is_pirate", doc)


if __name__ == "__main__":
    unittest.main()
