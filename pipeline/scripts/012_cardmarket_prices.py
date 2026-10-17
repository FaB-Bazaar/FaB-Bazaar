#!/usr/bin/env python3
"""
Step 012: Cardmarket (EUR) prices -> printings.cardmarket_* (migration 0126).

Cardmarket publishes a daily FaB price guide and product list on public S3
(no Cloudflare, no auth). Neither carries a set code or collector number;
cardmarket_match.py maps products to our printings. The files are fetched
with their ETag and the last good copy is kept, so a failed download prices
from yesterday's file instead of failing the run.
"""

import json
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cardmarket_match import (  # noqa: E402
    EXPANSIONS_CSV, cardmarket_url, load_expansion_map, load_name_aliases, load_printings, match, unknown_expansions)

PRICE_GUIDE_URL = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_16.json'
PRODUCTS_URL = 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_16.json'
DEFAULT_CACHE_DIR = '/app/data/cardmarket'
HEADERS = {'User-Agent': 'FaBBazaar-Pipeline/1.0 (+https://fabbazaar.app)'}


def _etag_path(cache_path):
    return Path(f'{cache_path}.etag')


def cached_etag(cache_path):
    p = _etag_path(cache_path)
    return p.read_text() if p.exists() else None


def save_etag(cache_path, etag):
    if etag:
        _etag_path(cache_path).write_text(etag)


def http_get(url, etag):
    headers = dict(HEADERS, **({'If-None-Match': etag} if etag else {}))
    resp = requests.get(url, headers=headers, timeout=60)
    if resp.status_code not in (200, 304):
        raise OSError(f'{url} returned HTTP {resp.status_code}')
    resp.body, resp.etag, resp.status = resp.content, resp.headers.get('ETag'), resp.status_code
    return resp


def fetch_catalog(url, cache_path, get=http_get):
    """Parsed JSON for `url`; downloads only when the ETag changed, falls back to the cached copy on failure."""
    cache_path = Path(cache_path)
    try:
        resp = get(url, cached_etag(cache_path) if cache_path.exists() else None)
        if resp.status == 200:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_bytes(resp.body)
            save_etag(cache_path, resp.etag)
    except (OSError, requests.RequestException) as e:
        if not cache_path.exists():
            raise
        print(f'⚠️  {url} download failed ({e}); using the last good copy')
    return json.loads(cache_path.read_bytes())


def build_rows(results, products, prices, printings, expansion_names):
    """One row per printing that has a Cardmarket product, ready for write_rows.

    A product already stored on the printing wins over tonight's match: pairings
    are stored once and only fixed by hand, never re-derived.
    """
    by_id = {p['printing_id']: p for p in printings}
    rows = []
    for r in results:
        p = by_id[r['printing_id']]
        product_id, status = r['product_id'], r['status']
        if p.get('cardmarket_product_id'):
            product_id, status = p['cardmarket_product_id'], p.get('cardmarket_match_status') or 'matched'
        if not product_id:
            continue
        prod = products.get(product_id)
        price = prices.get(product_id) or {}
        url = (cardmarket_url(prod['name'], expansion_names[prod['idExpansion']], prod['idExpansion'], p)
               if prod else None)
        rows.append({'printing_id': p['printing_id'], 'product_id': product_id, 'trend': price.get('trend'),
                     'low': price.get('low'), 'avg7': price.get('avg7'), 'avg30': price.get('avg30'),
                     'url': url, 'status': status})
    return rows


WRITE_SQL = """
    UPDATE printings p SET
        cardmarket_product_id = v.product_id,
        cardmarket_trend = v.trend,
        cardmarket_low = v.low,
        cardmarket_avg7 = v.avg7,
        cardmarket_avg30 = v.avg30,
        cardmarket_url = v.url,
        cardmarket_match_status = v.status,
        cardmarket_price_updated_at = %(created_at)s::timestamptz
    FROM (VALUES %%s) AS v(printing_id, product_id, trend, low, avg7, avg30, url, status)
    WHERE p.printing_id = v.printing_id
"""
VALUES_TEMPLATE = '(%s, %s::int, %s::numeric, %s::numeric, %s::numeric, %s::numeric, %s, %s)'


def write_rows(conn, rows, created_at):
    """Write rows to printings.cardmarket_* only (the caller commits)."""
    import psycopg2.extras

    with conn.cursor() as cur:
        sql = cur.mogrify(WRITE_SQL, {'created_at': created_at}).decode()
        psycopg2.extras.execute_values(
            cur, sql,
            [(r['printing_id'], r['product_id'], r['trend'], r['low'], r['avg7'], r['avg30'], r['url'], r['status'])
             for r in rows],
            template=VALUES_TEMPLATE, page_size=1000)


def is_new_guide(created_at, last_loaded_at):
    """True unless this price guide (its createdAt) is the one already loaded."""
    from datetime import datetime

    created = datetime.strptime(created_at, '%Y-%m-%dT%H:%M:%S%z')
    return last_loaded_at is None or created > last_loaded_at


def run(conn, cache_dir, dry_run=False, get=http_get):
    """Fetch, match and write tonight's Cardmarket prices on `conn` (the caller commits)."""
    import csv
    from collections import Counter

    cache_dir = Path(cache_dir)
    guide = fetch_catalog(PRICE_GUIDE_URL, cache_dir / 'price_guide_16.json', get)
    catalog = fetch_catalog(PRODUCTS_URL, cache_dir / 'products_singles_16.json', get)

    with conn.cursor() as cur:
        cur.execute('SELECT max(cardmarket_price_updated_at) FROM printings')
        last_loaded = cur.fetchone()[0]
    if not is_new_guide(guide['createdAt'], last_loaded):
        print(f"⏭️  Cardmarket price guide {guide['createdAt']} already loaded")
        return {'skipped': True, 'written': 0}

    products = catalog['products']
    emap = load_expansion_map()
    unknown = unknown_expansions(products, emap)
    if unknown:
        print(f'⚠️  Cardmarket expansions missing from {EXPANSIONS_CSV.name} (add them by hand): {unknown}')
    with open(EXPANSIONS_CSV, newline='') as f:
        expansion_names = {int(r['id_expansion']): r['cardmarket_name'] for r in csv.DictReader(f)}

    printings = load_printings(conn)
    prices = {g['idProduct']: g for g in guide['priceGuides']}
    results = match(products, prices, printings, emap, load_name_aliases())
    rows = build_rows(results, {p['idProduct']: p for p in products}, prices, printings, expansion_names)

    statuses = Counter(r['status'] for r in results)
    print(f"Cardmarket price guide {guide['createdAt']}: {len(products)} products, {len(printings)} printings")
    for status, n in statuses.most_common():
        print(f'   {status:15s} {n:6d}')
    if dry_run:
        print(f'🔍 DRY RUN: would write {len(rows)} printings')
        return {'skipped': False, 'written': 0, 'would_write': len(rows)}
    write_rows(conn, rows, guide['createdAt'])
    print(f'✅ wrote Cardmarket prices for {len(rows)} printings')
    return {'skipped': False, 'written': len(rows)}


def resolve_db_url(use_production):
    """Same env selection as 005/006/009 (POSTGRES_URL_PROD / POSTGRES_URL_STAGING), POSTGRES_URL for local runs."""
    import os

    from dotenv import load_dotenv
    load_dotenv()
    if use_production:
        return os.getenv('POSTGRES_URL_PROD')
    return os.getenv('POSTGRES_URL_STAGING') or os.getenv('POSTGRES_URL')


def main():
    import argparse
    import os

    import psycopg2

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--production', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--cache-dir', default=os.environ.get('CARDMARKET_CACHE_DIR', DEFAULT_CACHE_DIR),
                        help='where the last good Cardmarket files are kept (default %(default)s)')
    args = parser.parse_args()

    db_url = resolve_db_url(args.production)
    if not db_url:
        print('❌ No database URL (POSTGRES_URL_PROD / POSTGRES_URL_STAGING / POSTGRES_URL)')
        return 1
    conn = psycopg2.connect(db_url)
    try:
        run(conn, args.cache_dir, dry_run=args.dry_run)
        conn.commit()
    finally:
        conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
