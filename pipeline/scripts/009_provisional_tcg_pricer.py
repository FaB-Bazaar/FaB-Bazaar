#!/usr/bin/env python3
"""
TCGplayer ids + prices for PROVISIONAL printings (fab_cube_printing_id IS NULL).

A new set lives almost entirely in CardVault-ingested provisional rows until
fab-cube adopts it (IAR at launch: 516 en rows, 11 in the feed), and 002 only
prices FEED printings — so the set showed no prices or buy links while
TCGplayer already listed it. This step runs after 005 (so tonight's adoptions
are excluded) and, for English provisional rows in sets that have a group in
fab_set_with_db.csv:

  1. assigns tcgplayer_product_id/url to idless rows by collector number +
     variant class inside the set's own group(s) — the product-name rules are
     002's (product_variant); ambiguous / unmatched rows are reported, never
     guessed; existing ids are never overwritten;
  2. reprices every such row that has an id, with 002's subtype matching and
     003's price flags, so these rows read exactly like feed-priced ones.

Once fab-cube adopts a row it leaves this step's scope and 002/005/006 own it.

Usage:
    python3 009_provisional_tcg_pricer.py --dry-run
    python3 009_provisional_tcg_pricer.py
    python3 009_provisional_tcg_pricer.py --production
"""

import argparse
import importlib.util
import re
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent


def _load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


enhancer = _load_module("tcg_price_enhancer_002_for_009", "002_tcg_price_enhancer.py")
transformer = _load_module("cards_transformer_003_for_009", "003_cards_to_printings_transformer.py")

PRICE_FIELDS = ('tcg_low', 'tcg_mid', 'tcg_high', 'tcg_market')


def row_variant(row):
    """DB printing row -> variant class, mirroring 002's printing_variant.
    Any other art variation (e.g. 'FA' on a non-Marvel) is its own class so it
    never takes the base product."""
    if str(row.get("rarity") or "").lower() == "v":
        return "marvel"
    art = [str(a).upper() for a in (row.get("art_variations") or [])]
    if "EA" in art:
        return "ea"
    if "AA" in art:
        return "aa"
    if art:
        return art[0].lower()
    return "base"


_LISTING_SUFFIX_RE = re.compile(r'(\s*\([^()]*\)|\s+-\s+[A-Z0-9]+)\s*$')


def _name_key(name):
    """"Lay Low (Yellow) - FAB513" -> "laylow"; punctuation-insensitive."""
    name = (name or "").strip()
    while True:
        stripped = _LISTING_SUFFIX_RE.sub("", name)
        if stripped == name:
            break
        name = stripped
    return re.sub(r'[^a-z0-9]', '', name.lower())


def product_names_card(product_name, card_name):
    """True when the product is this card — any face of a "A // B" product."""
    key = _name_key(card_name)
    return any(_name_key(face) == key for face in (product_name or "").split("//"))


def match_products(rows, products_by_set):
    """Resolve idless rows to products. Returns {'assignments': {printing_id:
    product}, 'unmatched': [...], 'ambiguous': [...], 'name_mismatch': [...]}.
    The product name must name the row's card: TCGplayer mis-numbers listings
    (GEM207/GEM208 are swapped there — CardVault is authoritative)."""
    index = {}  # (set, number) -> {variant: [products]}
    for code, products in products_by_set.items():
        for product in products:
            number = enhancer._product_number(product)
            if not number:
                continue
            slot = index.setdefault((code.lower(), number), {})
            slot.setdefault(enhancer.product_variant(product.get("name")), []).append(product)

    result = {"assignments": {}, "unmatched": [], "ambiguous": [], "name_mismatch": []}
    for row in rows:
        if row.get("tcgplayer_product_id"):
            continue
        key = (str(row.get("set") or "").lower(), str(row.get("collector_number") or "").strip().upper())
        variant = row_variant(row)
        candidates = index.get(key, {}).get(variant, [])
        detail = {"printing_id": row["printing_id"], "collector_number": row.get("collector_number"),
                  "foiling": row.get("foiling"), "variant": variant}
        if not candidates:
            result["unmatched"].append(detail)
        elif len(candidates) > 1:
            detail["product_ids"] = [c.get("productId") for c in candidates]
            result["ambiguous"].append(detail)
        elif row.get("name") and not product_names_card(candidates[0].get("name"), row["name"]):
            detail.update(card_name=row["name"], product_name=candidates[0].get("name"))
            result["name_mismatch"].append(detail)
        else:
            result["assignments"][row["printing_id"]] = candidates[0]
    return result


def build_price_updates(rows, price_data):
    """[(printing_id, payload)] for rows with a product id whose product was
    fetched. A product that is listed but has no price for the row's treatment
    clears the price (same outcome as a feed printing in 002)."""
    updates = []
    for row in rows:
        product_id = row.get("tcgplayer_product_id")
        if not product_id:
            continue
        try:
            product_prices = price_data.get(int(product_id))
        except (TypeError, ValueError):
            continue
        if product_prices is None:
            continue  # group fetch failed / product unlisted — keep yesterday's price
        expected = enhancer.TCGPriceEnhancer.get_subtype_name(None, row.get("edition"), row.get("foiling"))
        price_info, _quality = enhancer.TCGPriceEnhancer.find_best_price_match(
            None, product_prices, expected, row.get("edition"), row.get("foiling"))
        price_info = price_info or {}
        payload = {f: price_info.get(f) for f in PRICE_FIELDS}
        payload["tcgplayer_subtype_name"] = price_info.get("tcgplayer_subTypeName")
        payload.update(transformer.CardsToPrintingsTransformer.get_price_flags(
            None, payload["tcg_market"], payload["tcg_mid"], payload["tcg_low"]))
        updates.append((row["printing_id"], payload))
    return updates


# ─── I/O ──────────────────────────────────────────────────────────────────────

def load_group_mappings(csv_path=HERE / "fab_set_with_db.csv"):
    """{set_code(lower): [group_ids]} from the same CSV 002 uses."""
    import csv
    mappings = {}
    with open(csv_path) as f:
        for row in csv.DictReader(f):
            mappings.setdefault(row['printings.set'].strip().lower(), []).append(int(row['group_id']))
    return mappings


def price_group_ids(mappings):
    """Every mapped group: an admin-set id may point into another set's group
    (or a price-only code like iar-prerelease), and prices key on product id."""
    return sorted({g for groups in mappings.values() for g in groups})


def fetch_prices_for_groups(group_ids):
    """{productId: {subTypeName: price_info}} in 002's shape. A failed group is
    skipped, so its rows keep their current prices."""
    price_data = {}
    for group_id in sorted(set(group_ids)):
        try:
            resp = requests.get(f"https://tcgcsv.com/tcgplayer/62/{group_id}/prices",
                                timeout=30, headers=enhancer.TCGCSV_HEADERS)
            resp.raise_for_status()
            for entry in resp.json().get("results", []):
                pid, sub = entry.get("productId"), entry.get("subTypeName")
                if pid and sub:
                    price_data.setdefault(pid, {})[sub] = {
                        'tcg_low': entry.get('lowPrice'),
                        'tcg_mid': entry.get('midPrice'),
                        'tcg_high': entry.get('highPrice'),
                        'tcg_market': entry.get('marketPrice'),
                        'tcgplayer_subTypeName': sub,
                    }
            time.sleep(0.5)
        except Exception as e:
            print(f"   ❌ prices fetch failed for group {group_id}: {e}")
    return price_data


ROWS_SQL = """
    SELECT p.printing_id, p.set, p.collector_number, p.edition, p.foiling, p.rarity,
           p.art_variations, p.tcgplayer_product_id, c.name
    FROM printings p
    JOIN cards c ON c.card_unique_id = p.card_unique_id
    WHERE p.fab_cube_printing_id IS NULL
      AND p.language = 'en'
      AND lower(p.set) = ANY(%s)
"""


def run(use_production, dry_run):
    import psycopg2
    import psycopg2.extras

    mappings = load_group_mappings()
    db_url = enhancer.resolve_overrides_db_url(use_production)
    if not db_url:
        print("❌ No database URL (POSTGRES_URL_PROD / POSTGRES_URL_STAGING / POSTGRES_URL)")
        return 1

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(ROWS_SQL, (list(mappings),))
            rows = [dict(r) for r in cur.fetchall()]
        sets = sorted({r["set"].lower() for r in rows})
        print(f"🔎 {len(rows)} provisional en printings in mapped sets: {', '.join(sets) or 'none'}")
        if not rows:
            return 0

        idless_sets = sorted({r["set"].lower() for r in rows if not r["tcgplayer_product_id"]})
        products_by_set = {code: enhancer.fetch_products_for_groups(mappings[code]) for code in idless_sets}
        match = match_products(rows, products_by_set)
        by_id = {r["printing_id"]: r for r in rows}
        id_updates = []
        for printing_id, product in match["assignments"].items():
            url = product.get("url") or f"https://www.tcgplayer.com/product/{product.get('productId')}"
            by_id[printing_id]["tcgplayer_product_id"] = str(product.get("productId"))
            id_updates.append({"printing_id": printing_id,
                               "tcgplayer_product_id": str(product.get("productId")),
                               "tcgplayer_url": url})
        print(f"🔗 ids assigned: {len(id_updates)}, unmatched: {len(match['unmatched'])}, "
              f"ambiguous: {len(match['ambiguous'])}, name mismatch: {len(match['name_mismatch'])}")
        for d in match["unmatched"]:
            print(f"   – unmatched {d['collector_number']} {d['foiling']} ({d['variant']})")
        for d in match["ambiguous"]:
            print(f"   ⚠️ ambiguous {d['collector_number']} {d['foiling']} ({d['variant']}): {d['product_ids']}")

        for d in match["name_mismatch"]:
            print(f"   ⚠️ name mismatch {d['collector_number']}: ours {d['card_name']!r}, TCGplayer {d['product_name']!r}")

        price_data = fetch_prices_for_groups(price_group_ids(mappings))
        price_updates = build_price_updates(list(by_id.values()), price_data)
        priced = sum(1 for _, p in price_updates if p["tcg_low"] is not None)
        print(f"💰 price rows: {len(price_updates)} ({priced} with a low price)")

        if dry_run:
            print("🧪 DRY RUN — no writes")
            return 0

        with conn.cursor() as cur:
            psycopg2.extras.execute_batch(cur, """
                UPDATE printings SET tcgplayer_product_id = %(tcgplayer_product_id)s,
                       tcgplayer_url = %(tcgplayer_url)s, updated_at = NOW()
                WHERE printing_id = %(printing_id)s AND tcgplayer_product_id IS NULL
                  AND fab_cube_printing_id IS NULL""", id_updates)
            fields = list(price_updates[0][1]) if price_updates else []
            set_clause = ", ".join(f'"{f}" = %({f})s' for f in fields)
            psycopg2.extras.execute_batch(cur, f"""
                UPDATE printings SET {set_clause}, price_updated_at = NOW(), updated_at = NOW()
                WHERE printing_id = %(printing_id)s AND fab_cube_printing_id IS NULL""",
                [{"printing_id": pid, **payload} for pid, payload in price_updates])
        conn.commit()
        print(f"✅ wrote {len(id_updates)} ids and {len(price_updates)} price rows")
        return 0
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--production", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    sys.exit(run(args.production, args.dry_run))


if __name__ == "__main__":
    main()
