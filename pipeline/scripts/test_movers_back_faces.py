#!/usr/bin/env python3
"""
A double-faced card's back face (Blasmophet, Levia Consumed) shares its
front's TCGplayer product (Levia, Redeemed), so both rows get the same price
every night and 010 listed the same move twice. dedupe_double_sided keys on
display_name, which only catches faces that share a name (Puffin Hightail).
010 now drops back faces whose front has the same tcgplayer_product_id.

Run:
  python3 pipeline/scripts/test_movers_back_faces.py
"""

import importlib.util
import sys
import types
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent

# duckdb/psycopg2/dotenv live in the pipeline container; the code under test
# never touches them, so stub whatever this machine lacks.
for mod in ("duckdb", "psycopg2", "psycopg2.extras", "dotenv"):
    try:
        __import__(mod)
    except ImportError:
        stub = types.ModuleType(mod)
        if mod == "dotenv":
            stub.load_dotenv = lambda *a, **k: None
        sys.modules[mod] = stub
if not hasattr(sys.modules["psycopg2"], "extras"):
    sys.modules["psycopg2"].extras = sys.modules["psycopg2.extras"]

spec = importlib.util.spec_from_file_location("compute_movers", SCRIPTS_DIR / "010_compute_movers.py")
movers = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
spec.loader.exec_module(movers)  # type: ignore[union-attr]


def rec(printing_id, name):
    return {"printing_id": printing_id, "display_name": name, "set": "dtd",
            "edition": "N", "foiling": "S", "rarity": "L"}


class DropDuplicateBackFaces(unittest.TestCase):
    def test_drops_back_faces_that_share_their_fronts_product(self):
        records = [rec("front", "Levia, Redeemed"), rec("back", "Blasmophet, Levia Consumed"), rec("other", "Snatch")]
        kept = movers.drop_duplicate_back_faces(records, {"back"})
        self.assertEqual([r["printing_id"] for r in kept], ["front", "other"])

    def test_drops_a_lone_back_face_too(self):
        # Only the back qualified today (the front missed the threshold): the
        # SQL only lists backs whose front shares the product, and the back is
        # still the same physical card, so it is dropped too — no front row
        # means no entry, rather than a mover under the back face's name.
        kept = movers.drop_duplicate_back_faces([rec("back", "Blasmophet, Levia Consumed")], {"back"})
        self.assertEqual(kept, [])

    def test_no_back_faces_is_a_no_op(self):
        records = [rec("a", "A"), rec("b", "B")]
        self.assertEqual(movers.drop_duplicate_back_faces(records, set()), records)

    def test_query_joins_back_to_front_on_the_same_product(self):
        sql = " ".join(movers.DUPLICATE_BACK_FACES_SQL.split()).lower()
        self.assertIn("is_front_face = false", sql)
        self.assertIn("other_face_printing_id", sql)
        self.assertIn("tcgplayer_product_id = front.tcgplayer_product_id", sql)


if __name__ == "__main__":
    unittest.main()
