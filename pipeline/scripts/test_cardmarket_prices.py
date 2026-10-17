#!/usr/bin/env python3
"""
Tests for 012_cardmarket_prices.py — the nightly Cardmarket step: download the
price guide + product list, match products to printings (cardmarket_match.py),
write printings.cardmarket_* (migration 0126).

Pure tests always run; the write test needs a real Postgres (same skip
pattern as test_anchor_reconcile.py) and runs inside a rolled-back transaction.
"""

import importlib.util
import json
import os
import tempfile
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


MOD = _load_module('cardmarket_prices', '012_cardmarket_prices.py')


def _db_url():
    url = os.environ.get('POSTGRES_URL')
    if url:
        return url
    env = REPO_ROOT / '.env.local'
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith('POSTGRES_URL='):
                return line.split('=', 1)[1].strip().strip('"')
    return None


class FakeResponse:
    def __init__(self, status, body=b'', etag=None):
        self.status, self.body, self.etag = status, body, etag


class FetchCatalogTests(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.cache = self.dir / 'price_guide_16.json'

    def test_new_file_is_parsed_and_cached_with_its_etag(self):
        body = json.dumps({'createdAt': '2026-10-16T02:43:03+0200', 'priceGuides': []}).encode()
        data = MOD.fetch_catalog('https://x/price_guide_16.json', self.cache,
                                 lambda url, etag: FakeResponse(200, body, '"abc"'))
        self.assertEqual(data['createdAt'], '2026-10-16T02:43:03+0200')
        self.assertEqual(self.cache.read_bytes(), body)
        self.assertEqual(MOD.cached_etag(self.cache), '"abc"')

    def test_not_modified_returns_the_cached_copy_and_sends_the_etag(self):
        self.cache.write_text(json.dumps({'createdAt': 'cached'}))
        MOD.save_etag(self.cache, '"abc"')
        sent = []
        data = MOD.fetch_catalog('https://x/p.json', self.cache,
                                 lambda url, etag: sent.append(etag) or FakeResponse(304))
        self.assertEqual(data, {'createdAt': 'cached'})
        self.assertEqual(sent, ['"abc"'])

    def test_download_failure_falls_back_to_the_last_good_copy(self):
        self.cache.write_text(json.dumps({'createdAt': 'yesterday'}))

        def boom(url, etag):
            raise OSError('S3 unreachable')

        self.assertEqual(MOD.fetch_catalog('https://x/p.json', self.cache, boom), {'createdAt': 'yesterday'})

    def test_download_failure_without_a_cached_copy_raises(self):
        def boom(url, etag):
            raise OSError('S3 unreachable')

        with self.assertRaises(OSError):
            MOD.fetch_catalog('https://x/p.json', self.cache, boom)


def _printing(pid, existing=None, status=None, **kw):
    row = {'printing_id': pid, 'name': 'Zipper Hit', 'pitch': 'red', 'set': 'sda', 'edition': 'n', 'foiling': 's',
           'collector_number': 'SDA021', 'art_variations': '', 'tcg_low': 0.05, 'tcgplayer_product_id': None,
           'is_front_face': True, 'back_name': None, 'rarity': 'c',
           'cardmarket_product_id': existing, 'cardmarket_match_status': status}
    row.update(kw)
    return row


class BuildRowsTests(unittest.TestCase):
    products = {878461: {'idProduct': 878461, 'name': 'Zipper Hit (Red)', 'idExpansion': 6464},
                999999: {'idProduct': 999999, 'name': 'Zipper Hit (Red)', 'idExpansion': 6464}}
    prices = {878461: {'idProduct': 878461, 'trend': 0.49, 'low': 0.02, 'avg7': 0.3, 'avg30': 0.35},
              999999: {'idProduct': 999999, 'trend': 1.0, 'low': 0.5, 'avg7': 1.0, 'avg30': 1.0}}
    names = {6464: 'Silver Age Deck - Dash'}

    def build(self, results, printings):
        return {r['printing_id']: r for r in MOD.build_rows(results, self.products, self.prices, printings, self.names)}

    def test_matched_printing_gets_prices_url_and_status(self):
        rows = self.build([{'printing_id': 'p1', 'product_id': 878461, 'status': 'matched'}], [_printing('p1')])
        self.assertEqual(rows['p1'], {
            'printing_id': 'p1', 'product_id': 878461, 'trend': 0.49, 'low': 0.02, 'avg7': 0.3, 'avg30': 0.35,
            'url': 'https://www.cardmarket.com/en/FleshAndBlood/Products/Singles/Silver-Age-Deck-Dash/Zipper-Hit-Red-Regular',
            'status': 'matched'})

    def test_stored_product_is_kept_over_tonights_match(self):
        # pairings are stored once; a hand fix (or yesterday's pick) is never re-derived
        rows = self.build([{'printing_id': 'p1', 'product_id': 878461, 'status': 'review'}],
                          [_printing('p1', existing=999999, status='matched')])
        self.assertEqual((rows['p1']['product_id'], rows['p1']['trend'], rows['p1']['status']), (999999, 1.0, 'matched'))

    def test_printing_without_a_product_gets_no_row(self):
        self.assertEqual(self.build([{'printing_id': 'p1', 'product_id': None, 'status': 'no_cm_product'}],
                                    [_printing('p1')]), {})

    def test_product_missing_from_tonights_price_guide_keeps_the_pairing_without_prices(self):
        rows = MOD.build_rows([{'printing_id': 'p1', 'product_id': 878461, 'status': 'matched'}], self.products, {},
                              [_printing('p1')], self.names)
        self.assertEqual((rows[0]['product_id'], rows[0]['trend'], rows[0]['low']), (878461, None, None))


class NewGuideTests(unittest.TestCase):
    def test_first_load_is_new(self):
        self.assertTrue(MOD.is_new_guide('2026-10-16T02:43:03+0200', None))

    def test_same_guide_as_last_load_is_not_new(self):
        from datetime import datetime, timezone
        loaded = datetime(2026, 10, 16, 0, 43, 3, tzinfo=timezone.utc)  # same instant, stored in UTC
        self.assertFalse(MOD.is_new_guide('2026-10-16T02:43:03+0200', loaded))

    def test_later_guide_is_new(self):
        from datetime import datetime, timezone
        self.assertTrue(MOD.is_new_guide('2026-10-17T02:41:00+0200', datetime(2026, 10, 16, 0, 43, 3, tzinfo=timezone.utc)))


@unittest.skipUnless(_db_url(), 'no POSTGRES_URL available for behavior tests')
class WriteRowsTests(unittest.TestCase):
    """Real-DB behavior inside a rolled-back transaction."""

    def setUp(self):
        import psycopg2
        self.conn = psycopg2.connect(_db_url())
        self.conn.autocommit = False
        uid = uuid.uuid4().hex[:12]
        self.card, self.printing = f'zzt-card-{uid}', f'zzt-print-{uid}'
        cur = self.conn.cursor()
        cur.execute("INSERT INTO cards (card_unique_id, name, display_name, talishar_card_id) VALUES (%s, %s, %s, %s)",
                    (self.card, f'Zzt {uid}', f'Zzt {uid}', f'zzt_{uid}'))
        cur.execute("""INSERT INTO printings (printing_id, card_unique_id, set, collector_number, edition, foiling,
                                              rarity, language, tcg_low)
                       VALUES (%s, %s, 'zzt', 'ZZT001', 'n', 's', 'c', 'en', 0.05)""", (self.printing, self.card))

    def tearDown(self):
        self.conn.rollback()
        self.conn.close()

    def test_rows_land_in_the_cardmarket_columns_only(self):
        MOD.write_rows(self.conn, [{'printing_id': self.printing, 'product_id': 878461, 'trend': 0.49, 'low': 0.02,
                                    'avg7': 0.3, 'avg30': None, 'url': 'https://cm/x', 'status': 'review'}],
                       '2026-10-16T02:43:03+0200')
        cur = self.conn.cursor()
        cur.execute("""SELECT cardmarket_product_id, cardmarket_trend::float, cardmarket_low::float,
                              cardmarket_avg7::float, cardmarket_avg30, cardmarket_url, cardmarket_match_status,
                              cardmarket_price_updated_at AT TIME ZONE 'UTC', tcg_low::numeric(10,2)::float
                       FROM printings WHERE printing_id = %s""", (self.printing,))
        row = cur.fetchone()
        self.assertEqual(row[:7], (878461, 0.49, 0.02, 0.3, None, 'https://cm/x', 'review'))
        self.assertEqual(str(row[7]), '2026-10-16 00:43:03')
        self.assertEqual(row[8], 0.05)


@unittest.skipUnless(_db_url(), 'no POSTGRES_URL available for behavior tests')
class RunTests(unittest.TestCase):
    """run() end to end on the real DB: fake downloads, a fixture printing filed under SDA, rolled back."""

    def setUp(self):
        import psycopg2
        self.conn = psycopg2.connect(_db_url())
        self.conn.autocommit = False
        uid = uuid.uuid4().hex[:12]
        self.name = f'Zzt Probe {uid}'
        self.card, self.printing = f'zzt-card-{uid}', f'zzt-print-{uid}'
        cur = self.conn.cursor()
        cur.execute("INSERT INTO cards (card_unique_id, name, display_name, talishar_card_id) VALUES (%s, %s, %s, %s)",
                    (self.card, self.name, self.name, f'zzt_{uid}'))
        cur.execute("""INSERT INTO printings (printing_id, card_unique_id, set, collector_number, edition, foiling,
                                              rarity, language, is_front_face)
                       VALUES (%s, %s, 'sda', 'SDA999', 'n', 's', 'c', 'en', true)""", (self.printing, self.card))
        self.cache = Path(tempfile.mkdtemp())
        guide = {'createdAt': '2099-01-01T02:00:00+0200',
                 'priceGuides': [{'idProduct': 990001, 'trend': 1.23, 'low': 0.5, 'avg7': 1.1, 'avg30': 1.0}]}
        products = {'createdAt': '2099-01-01T12:00:00+0200',
                    'products': [{'idProduct': 990001, 'name': self.name, 'idExpansion': 6464}]}
        self.get = lambda url, etag: FakeResponse(200, json.dumps(guide if 'priceGuide' in url else products).encode())

    def tearDown(self):
        self.conn.rollback()
        self.conn.close()

    def stored(self):
        cur = self.conn.cursor()
        cur.execute("SELECT cardmarket_product_id, cardmarket_trend::float FROM printings WHERE printing_id = %s",
                    (self.printing,))
        return cur.fetchone()

    def test_run_writes_the_matched_price(self):
        stats = MOD.run(self.conn, self.cache, dry_run=False, get=self.get)
        self.assertEqual(self.stored(), (990001, 1.23))
        self.assertGreaterEqual(stats['written'], 1)

    def test_dry_run_writes_nothing(self):
        MOD.run(self.conn, self.cache, dry_run=True, get=self.get)
        self.assertEqual(self.stored(), (None, None))


if __name__ == '__main__':
    unittest.main()
