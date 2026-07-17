#!/usr/bin/env python3
"""
Tests for 005's anchor-aware reconciliation (Phase 2 of the dual-source ID
model, migration 0088).

Covers:
  1. SQL shape — anchors ride INSERT but are never overwritten on UPDATE;
     stale-delete ownership is `fab_cube_printing_id IS NOT NULL` (rows the
     pipeline anchored), not `language = 'en'`.
  2. Behavior (local DB, rolled back) — _reconcile_anchors:
       - adopts provisional rows (stamps fab_cube_* anchors, remaps feed docs
         to internal ids, fixes image_url which embeds the printing_id)
       - steady-state remap on later runs (no re-stamping needed)
       - refuses ambiguous natural-key buckets (reports instead of guessing)

Run:
  python3 pipeline/scripts/test_anchor_reconcile.py
"""

import importlib.util
import inspect
import os
import unittest
import uuid
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
REPO_ROOT = SCRIPTS_DIR.parent.parent


def _load_module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS_DIR / filename)
    module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


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


MOD = _load_module("005_weekly_printings_updater.py", "anchor_test_mod")


class AnchorSqlShapeTests(unittest.TestCase):
    def test_anchor_columns_in_field_lists(self):
        self.assertIn("fab_cube_printing_id", MOD.PRINTING_FIELDS)
        self.assertIn("fab_cube_card_id", MOD.CARD_FIELDS)

    def test_anchors_inserted_but_never_overwritten_on_update(self):
        psql = MOD._build_printing_upsert_sql()
        self.assertIn('"fab_cube_printing_id"', psql)
        self.assertNotIn('"fab_cube_printing_id" = EXCLUDED', psql)
        csql = MOD._build_card_upsert_sql()
        self.assertIn('"fab_cube_card_id"', csql)
        self.assertNotIn('"fab_cube_card_id" = EXCLUDED', csql)

    def test_stale_delete_ownership_is_anchor_based(self):
        src = inspect.getsource(MOD.WeeklyPrintingsUpdater._delete_stale_printings)
        self.assertIn("fab_cube_printing_id IS NOT NULL", src)
        self.assertNotIn("language = 'en'", src)

    def test_reconcile_method_exists_and_runs_before_upserts(self):
        self.assertTrue(hasattr(MOD.WeeklyPrintingsUpdater, "_reconcile_anchors"))
        flow = inspect.getsource(MOD.WeeklyPrintingsUpdater.process_updates)
        self.assertIn("_reconcile_anchors", flow)
        self.assertLess(
            flow.index("_reconcile_anchors"), flow.index("_upsert_cards"),
            "reconcile must remap feed docs BEFORE the upserts run",
        )


@unittest.skipUnless(_db_url(), "no POSTGRES_URL available for behavior tests")
class AnchorReconcileBehaviorTests(unittest.TestCase):
    """Real-DB behavior, every test inside a rolled-back transaction."""

    class _NoCommit:
        """Delegating proxy that swallows commit() so every test stays inside
        one transaction and tearDown's rollback undoes all fixture writes."""
        def __init__(self, conn): self._conn = conn
        def __getattr__(self, name): return getattr(self._conn, name)
        def commit(self): pass

    def setUp(self):
        import psycopg2
        self.conn = psycopg2.connect(_db_url())
        self.conn.autocommit = False
        self.updater = object.__new__(MOD.WeeklyPrintingsUpdater)
        self.updater.conn = self._NoCommit(self.conn)
        self.updater.stats = {}
        self.uid = uuid.uuid4().hex[:12]
        self.card_internal = f"zzt-card-{self.uid}"
        self.print_internal = f"zzt-print-{self.uid}"
        self.tal = f"zzt_hero_{self.uid}"
        cur = self.conn.cursor()
        cur.execute(
            """INSERT INTO cards (card_unique_id, name, display_name, talishar_card_id)
               VALUES (%s, %s, %s, %s)""",
            (self.card_internal, f"Zzt Hero {self.uid}", f"Zzt Hero {self.uid}", self.tal),
        )
        cur.execute(
            """INSERT INTO printings (printing_id, card_unique_id, set, collector_number,
                                      edition, foiling, rarity, language, image_url)
               VALUES (%s, %s, 'zzt', 'ZZT001', 'n', 's', 'm', 'en', %s)""",
            (self.print_internal, self.card_internal,
             f"https://imagedelivery.net/x/{self.print_internal}/public"),
        )

    def tearDown(self):
        self.conn.rollback()
        self.conn.close()

    def _feed_docs(self, card_feed_id: str, print_feed_id: str):
        card_doc = {"card_unique_id": card_feed_id, "name": f"Zzt Hero {self.uid}",
                    "display_name": f"Zzt Hero {self.uid}", "talishar_card_id": self.tal}
        print_doc = {"printing_id": print_feed_id, "card_unique_id": card_feed_id,
                     "set": "zzt", "collector_number": "ZZT001", "edition": "n",
                     "foiling": "s", "rarity": "m", "language": "en",
                     "art_variations": ["FA"],
                     "image_url": f"https://imagedelivery.net/x/{print_feed_id}/public"}
        return {card_feed_id: card_doc}, {print_feed_id: print_doc}

    def test_adopts_provisional_rows_and_remaps_docs(self):
        cards_map, printings_map = self._feed_docs(f"fc-card-{self.uid}", f"fc-print-{self.uid}")
        cards_map, printings_map = self.updater._reconcile_anchors(cards_map, printings_map, dry_run=False)

        # docs rekeyed + rewritten to internal ids, anchors carry the feed ids
        self.assertIn(self.print_internal, printings_map)
        doc = printings_map[self.print_internal]
        self.assertEqual(doc["printing_id"], self.print_internal)
        self.assertEqual(doc["fab_cube_printing_id"], f"fc-print-{self.uid}")
        self.assertEqual(doc["card_unique_id"], self.card_internal)
        self.assertIn(self.print_internal, doc["image_url"], "image_url must be rewritten to the internal id")
        self.assertIn(self.card_internal, cards_map)
        self.assertEqual(cards_map[self.card_internal]["fab_cube_card_id"], f"fc-card-{self.uid}")

        # provisional rows stamped in the DB
        cur = self.conn.cursor()
        cur.execute("SELECT fab_cube_printing_id FROM printings WHERE printing_id = %s", (self.print_internal,))
        self.assertEqual(cur.fetchone()[0], f"fc-print-{self.uid}")
        cur.execute("SELECT fab_cube_card_id FROM cards WHERE card_unique_id = %s", (self.card_internal,))
        self.assertEqual(cur.fetchone()[0], f"fc-card-{self.uid}")

    def test_steady_state_remap_after_adoption(self):
        cur = self.conn.cursor()
        cur.execute("UPDATE cards SET fab_cube_card_id = %s WHERE card_unique_id = %s",
                    (f"fc-card-{self.uid}", self.card_internal))
        cur.execute("UPDATE printings SET fab_cube_printing_id = %s WHERE printing_id = %s",
                    (f"fc-print-{self.uid}", self.print_internal))
        cards_map, printings_map = self._feed_docs(f"fc-card-{self.uid}", f"fc-print-{self.uid}")
        cards_map, printings_map = self.updater._reconcile_anchors(cards_map, printings_map, dry_run=False)
        self.assertIn(self.print_internal, printings_map)
        self.assertEqual(printings_map[self.print_internal]["card_unique_id"], self.card_internal)
        self.assertEqual(self.updater.stats.get("printings_adopted", 0), 0)

    def test_ambiguous_bucket_is_reported_not_guessed(self):
        cur = self.conn.cursor()
        # second provisional row with the SAME natural key (face-pair shape)
        cur.execute(
            """INSERT INTO printings (printing_id, card_unique_id, set, collector_number,
                                      edition, foiling, rarity, language)
               VALUES (%s, %s, 'zzt', 'ZZT001', 'n', 's', 'm', 'en')""",
            (f"{self.print_internal}-b", self.card_internal),
        )
        cards_map, printings_map = self._feed_docs(f"fc-card-{self.uid}", f"fc-print-{self.uid}")
        cards_map, printings_map = self.updater._reconcile_anchors(cards_map, printings_map, dry_run=False)
        # no adoption, doc keeps its feed id (will insert as a new anchored row)
        self.assertIn(f"fc-print-{self.uid}", printings_map)
        self.assertGreaterEqual(self.updater.stats.get("printings_adoption_ambiguous", 0), 1)
        cur.execute("SELECT COUNT(*) FROM printings WHERE fab_cube_printing_id = %s", (f"fc-print-{self.uid}",))
        self.assertEqual(cur.fetchone()[0], 0)

    def test_dry_run_never_writes_stamps(self):
        cards_map, printings_map = self._feed_docs(f"fc-card-{self.uid}", f"fc-print-{self.uid}")
        self.updater._reconcile_anchors(cards_map, printings_map, dry_run=True)
        cur = self.conn.cursor()
        cur.execute("SELECT fab_cube_printing_id FROM printings WHERE printing_id = %s", (self.print_internal,))
        self.assertIsNone(cur.fetchone()[0])


if __name__ == "__main__":
    unittest.main()
