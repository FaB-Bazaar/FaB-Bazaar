#!/usr/bin/env python3
"""
Tests for group_mappings.py — the set ↔ TCGplayer (tcgcsv) group mapping.

Why: the mapping lived only in fab_set_with_db.csv, baked into the pipeline
image, so pointing a new set at its tcgcsv group took a code change + deploy.
Sets registered from /admin/cardvault store their groups in the
`tcg_group_sets` table (migration 0124); 001/002/009 read CSV + DB merged.
The CSV stays the floor: a DB failure must never drop existing mappings.

Run: python3 pipeline/scripts/test_group_mappings.py
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import group_mappings as gm  # noqa: E402

CSV = """set_name,group_id,printings.set
Usurp the Shadow Throne,24762,iar
Omens of the Third Age,24640,OMN
Omens of the Third Age,24640,iar
Silver Age Chapter 1 - Bravo,24524,SBR
Silver Age Chapter 1 - Dash,24524,SDA
"""


def write_csv(text=CSV):
    f = tempfile.NamedTemporaryFile('w', suffix='.csv', delete=False)
    f.write(text)
    f.close()
    return f.name


class FakeCursor:
    def __init__(self, rows=None, error=None):
        self.rows, self.error = rows or [], error

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql, params=None):
        if self.error:
            raise self.error

    def fetchall(self):
        return self.rows


class FakeConn:
    def __init__(self, rows=None, error=None):
        self._cur = FakeCursor(rows, error)
        self.closed = False

    def cursor(self):
        return self._cur

    def close(self):
        self.closed = True


class TestCsvRows(unittest.TestCase):
    def test_reads_rows_keeping_the_csv_case(self):
        # 001 keys set names by the CSV's own spelling and looks them up by the
        # feed's uppercase set_id, so only uppercase rows (SBR…) ever match —
        # lowercasing here would change which printings get a set name.
        rows = gm.read_csv_rows(write_csv())
        self.assertIn(('Usurp the Shadow Throne', 24762, 'iar'), rows)
        self.assertIn(('Omens of the Third Age', 24640, 'OMN'), rows)
        self.assertEqual(len(rows), 5)


class TestMerge(unittest.TestCase):
    def test_db_rows_add_new_sets(self):
        merged = gm.merge_rows(gm.read_csv_rows(write_csv()), [('Brand New Set', 25000, 'bns')])
        self.assertIn(('Brand New Set', 25000, 'bns'), merged)
        self.assertEqual(len(merged), 6)

    def test_a_pair_in_both_sources_appears_once(self):
        merged = gm.merge_rows(gm.read_csv_rows(write_csv()), [('Usurp (db name)', 24762, 'IAR'), ('Omens', 24640, 'omn')])
        self.assertEqual(sum(1 for r in merged if (r[1], r[2].lower()) == (24762, 'iar')), 1)
        self.assertEqual(sum(1 for r in merged if (r[1], r[2].lower()) == (24640, 'omn')), 1)

    def test_set_to_groups_keeps_many_to_many(self):
        mapping = gm.set_to_groups(gm.read_csv_rows(write_csv()))
        self.assertEqual(mapping['iar'], [24762, 24640])
        self.assertEqual(mapping['sbr'], [24524])  # 'SBR' in the CSV
        self.assertEqual(mapping['omn'], [24640])
        self.assertEqual(mapping['sda'], [24524])


class TestLoad(unittest.TestCase):
    def test_merges_db_rows_when_the_db_answers(self):
        conn = FakeConn(rows=[('Brand New Set', 25000, 'bns')])
        rows = gm.load_group_rows(write_csv(), connect=lambda: conn)
        self.assertIn(('Brand New Set', 25000, 'bns'), rows)
        self.assertTrue(conn.closed)

    def test_falls_back_to_csv_when_the_db_fails(self):
        def boom():
            raise RuntimeError('db down')
        rows = gm.load_group_rows(write_csv(), connect=boom)
        self.assertEqual(len(rows), 5)

    def test_falls_back_to_csv_when_the_table_is_missing(self):
        conn = FakeConn(error=RuntimeError('relation "tcg_group_sets" does not exist'))
        self.assertEqual(len(gm.load_group_rows(write_csv(), connect=lambda: conn)), 5)

    def test_csv_only_without_a_connection(self):
        self.assertEqual(len(gm.load_group_rows(write_csv(), connect=None)), 5)


def load_step(filename):
    """Pipeline steps start with digits — import them by path."""
    import importlib.util
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location(filename[:-3], os.path.join(here, filename))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


DB_ONLY = [('Brand New Set', 25000, 'bns')]


class TestStepsReadTheDatabase(unittest.TestCase):
    """A set mapped only in tcg_group_sets reaches every step that prices."""

    def test_001_api_only_enhancer(self):
        e = load_step('001_api_only_enhancer.py').APIOnlyEnhancer()
        e.group_csv_file = write_csv()
        e.group_db_connect = lambda: FakeConn(rows=DB_ONLY)
        groups, _names = e.load_group_mappings()
        self.assertEqual(groups.get('bns'), [25000])
        self.assertEqual(groups.get('iar'), [24762, 24640])

    def test_002_tcg_price_enhancer(self):
        e = load_step('002_tcg_price_enhancer.py').TCGPriceEnhancer()
        e.group_csv_file = write_csv()
        e.group_db_connect = lambda: FakeConn(rows=DB_ONLY)
        self.assertEqual(e.load_group_mappings().get('bns'), [25000])

    def test_009_provisional_pricer(self):
        m = load_step('009_provisional_tcg_pricer.py')
        mapping = m.load_group_mappings(write_csv(), connect=lambda: FakeConn(rows=DB_ONLY))
        self.assertEqual(mapping.get('bns'), [25000])
        self.assertEqual(mapping.get('iar'), [24762, 24640])


if __name__ == '__main__':
    unittest.main()
