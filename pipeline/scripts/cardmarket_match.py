#!/usr/bin/env python3
"""
Map Cardmarket price-guide products to our printings.

Cardmarket publishes products_singles_16.json (idProduct, name, idExpansion)
and price_guide_16.json (idProduct -> EUR prices). Neither carries a set code
or collector number, so the bridge is: idExpansion -> our set (hand-made CSV),
then card name, then a ranking rule inside (set, card).
"""

import csv
import re
import unicodedata
from pathlib import Path
from urllib.parse import quote_plus

EXPANSIONS_CSV = Path(__file__).resolve().parent / 'cardmarket_expansions.csv'
# Cardmarket spellings that differ from ours ("Sawbones, Dockhand"), front names without pitch
NAME_ALIASES_CSV = Path(__file__).resolve().parent / 'cardmarket_name_aliases.csv'
PITCH_SUFFIX = re.compile(r'^(.*?)\s*\((red|yellow|yelllow|blue|bleu)\)$')
PITCH_TYPOS = {'yelllow': 'yellow', 'bleu': 'blue'}  # Cardmarket's spellings (Hold 'em, Feisty Locals)
FACE_SEPARATOR = re.compile(r'\s*//\s*')  # Cardmarket also writes "Invoke Azvolai// Azvolai"


def _fold(text):
    """Lowercase, strip accents ("Kāṣāya" == "Kasaya"), collapse whitespace."""
    text = unicodedata.normalize('NFKD', text.lower())
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    return ' '.join(text.split())


def load_name_aliases(path=NAME_ALIASES_CSV):
    """Folded Cardmarket name -> folded name of ours."""
    with open(path, newline='') as f:
        return {_fold(r['cardmarket_name']): _fold(r['our_name']) for r in csv.DictReader(f)}


def cm_card_key(name, multi_pitch_names, aliases=None):
    """Cardmarket product name -> (front, pitch, back), lowercased.

    Cardmarket appends "(Red)" only when a card exists in several pitches, and
    names double-faced products "Front // Back". `multi_pitch_names` is the set
    of (lowercased) card names that exist in more than one pitch on our side.
    """
    front, _, back = FACE_SEPARATOR.sub(' // ', _fold(name)).partition(' // ')
    pitch = None
    m = PITCH_SUFFIX.match(front)
    if m:
        front, pitch = m.group(1), PITCH_TYPOS.get(m.group(2), m.group(2))
    front = (aliases or {}).get(front, front)
    if front not in multi_pitch_names:
        pitch = None
    return (front, pitch, back or None)


def load_expansion_map(path=EXPANSIONS_CSV):
    """idExpansion -> [(set_code, edition or None)]. '-' = an expansion we don't track ([])."""
    emap = {}
    with open(path, newline='') as f:
        for row in csv.DictReader(f):
            codes = [] if row['set_codes'] == '-' else row['set_codes'].split()
            emap[int(row['id_expansion'])] = [(c, row['edition'] or None) for c in codes]
    return emap


def unknown_expansions(products, emap):
    """Expansions Cardmarket added that the CSV doesn't cover yet (needs a human)."""
    return sorted({p['idExpansion'] for p in products} - set(emap))


# Promo sets where our collector numbers and Cardmarket product ids both follow release order
RELEASE_ORDER_SETS = {'fab'}
# Rank pairing is a coin flip when neighbouring Cardmarket prices are closer than this
CLOSE_CALL_GAP = 0.25
FOIL_TIER = {'c': 3, 'g': 3, 'r': 2, 's': 1}


def cm_price(price_row):
    """The price we rank Cardmarket products by: trend, else the cheapest listing."""
    if not price_row:
        return None
    return price_row.get('trend') or price_row.get('low')


def _our_rank(p):
    # foil tier first: our tcg_low is often missing on the premium printing
    return (FOIL_TIER.get(p['foiling'], 0), 1 if p['art_variations'] else 0, p['tcg_low'] or 0)


def _collector_order(p):
    m = re.search(r'(\d+)$', p['collector_number'])
    return (int(m.group(1)) if m else 0, p['collector_number'])


def _is_close_call(cm_prices):
    """True when ranked prices can't separate the products (a missing price or a gap < CLOSE_CALL_GAP)."""
    if len(cm_prices) < 2:
        return False
    if any(p is None for p in cm_prices):
        return True
    ordered = sorted(cm_prices)
    return any(hi == 0 or (hi - lo) / hi < CLOSE_CALL_GAP for lo, hi in zip(ordered, ordered[1:]))


def _our_front(name):
    """Our cards.name can carry both faces too ("Burn Up // Shock"); match on the front."""
    return FACE_SEPARATOR.split(_fold(name))[0]


def _many_to_one(rows, cms, prices):
    """All products belong to one printing of ours; show the cheapest priced one."""
    priced = [c for c in cms if cm_price(prices.get(c['idProduct'])) is not None]
    cheapest = min(priced or cms, key=lambda c: (cm_price(prices.get(c['idProduct'])) or 0, c['idProduct']))
    all_ids = sorted(c['idProduct'] for c in cms)
    return [{'printing_id': row['printing_id'], 'product_id': cheapest['idProduct'], 'status': 'matched',
             'all_product_ids': all_ids} for row in rows]


def _multi_pitch_names(printings):
    pitches = {}
    for p in printings:
        pitches.setdefault(_our_front(p['name']), set()).add(p['pitch'])
    return {n for n, s in pitches.items() if len(s) > 1}


def _cm_targets(emap):
    return {t for targets in emap.values() for t in targets}


def match(products, prices, printings, emap, aliases=None):
    """Pair Cardmarket products with our printings.

    Returns one dict per printing: {printing_id, product_id, status}.
    """
    multi = _multi_pitch_names(printings)
    targets = _cm_targets(emap)

    cm_groups = {}
    cm_by_back = {}
    for prod in products:
        front, pitch, back = cm_card_key(prod['name'], multi, aliases)
        for target in emap.get(prod['idExpansion'], []):
            cm_groups.setdefault((target, front, pitch), []).append(prod)
            if back:
                cm_by_back.setdefault((target, back), []).append(prod)

    results = []
    our_groups = {}
    for p in printings:
        if not p['is_front_face']:
            results.append({'printing_id': p['printing_id'], 'product_id': None, 'status': 'back_face'})
            continue
        name = _our_front(p['name'])
        target = (p['set'], p['edition']) if (p['set'], p['edition']) in targets else (p['set'], None)
        pitch = p['pitch'] if name in multi else None
        our_groups.setdefault((target, name, pitch), []).append(p)

    pitches_in_target = {}
    for target, name, pitch in our_groups:
        pitches_in_target.setdefault((target, name), set()).add(pitch)

    for key, rows in our_groups.items():
        cms = cm_groups.get(key, [])
        target, name, pitch = key
        if not cms and pitch and len(pitches_in_target[(target, name)]) == 1:
            # Cardmarket sometimes drops "(Red)" when the product is the only pitch in its expansion
            cms = cm_groups.get((target, name, None), [])
        # rows of ours that are one physical product share its Cardmarket product
        folded = {}
        for p in rows:
            fold_key = ((p['tcgplayer_product_id'], p['foiling'], p['collector_number']) if p['tcgplayer_product_id']
                        else (p['collector_number'], p['edition'], p['foiling'], p['art_variations']))
            folded.setdefault(fold_key, []).append(p)
        ours = [same[0] for same in folded.values()]
        twins = {same[0]['printing_id']: same[1:] for same in folded.values()}
        backs = {cm_card_key(c['name'], multi, aliases)[2] for c in cms}
        random_back = len(ours) == 1 and not ours[0]['back_name'] and len(cms) > 1 and None not in backs \
            and len(backs) == len(cms)
        sold_as_back = not cms and len(ours) == 1 and (target, name) in cm_by_back
        if random_back or sold_as_back:
            # early double-sided printing: Cardmarket sells one product per pairing of faces, we hold one
            # printing (random backs, or our card on the back of several fronts)
            results.extend(_many_to_one(rows, cms or cm_by_back[(target, name)], prices))
            continue
        if cms and len(ours) == len(cms):
            status = 'matched'
            if key[0][0] in RELEASE_ORDER_SETS:
                ranked_ours = sorted(ours, key=_collector_order)
                ranked_cms = sorted(cms, key=lambda c: c['idProduct'])
            else:
                ranked_ours = sorted(ours, key=_our_rank, reverse=True)
                ranked_cms = sorted(cms, key=lambda c: cm_price(prices.get(c['idProduct'])) or 0, reverse=True)
                if _is_close_call([cm_price(prices.get(c['idProduct'])) for c in cms]):
                    status = 'review'
            for p, c in zip(ranked_ours, ranked_cms):
                for row in [p] + twins[p['printing_id']]:
                    results.append({'printing_id': row['printing_id'], 'product_id': c['idProduct'],
                                    'status': status})
            continue
        if cms:
            candidates = sorted(c['idProduct'] for c in cms)
            for p in rows:
                results.append({'printing_id': p['printing_id'], 'product_id': None, 'status': 'count_mismatch',
                                'candidate_product_ids': candidates})
            continue
        for p in rows:
            results.append({'printing_id': p['printing_id'], 'product_id': None, 'status': 'no_cm_product'})
    return results


CARDMARKET_SINGLES = 'https://www.cardmarket.com/en/FleshAndBlood/Products/Singles/'
CARDMARKET_SEARCH = 'https://www.cardmarket.com/en/FleshAndBlood/Products/Search?searchString='
# Alpha/1st + Unlimited expansions label products "<collector #>[-RF|-CF]", "U-" prefix for Unlimited
COLLECTOR_LABEL_EXPANSIONS = {4477, 4479, 4480, 4481, 4482, 4483, 4484, 4485, 4487, 4488}
# FAB Promos number products by collector number, but not always like us (their 2nd FAB001 is our FAB002)
SEARCH_ONLY_EXPANSIONS = {4503}
FINISH_WORD = {'s': 'Regular', 'r': 'Rainbow-Foil', 'c': 'Cold-Foil', 'g': 'Gold-Foil'}
FOIL_CODE = {'s': '', 'r': 'RF', 'c': 'CF', 'g': 'GF'}


def _slug(text):
    """Cardmarket URL slug: accents, apostrophes and slashes dropped ("Dash I/O" -> "Dash-IO"),
    every other non-alphanumeric run -> '-'."""
    text = unicodedata.normalize('NFKD', text)
    text = re.sub(r"['\u2019/]", '', ''.join(ch for ch in text if not unicodedata.combining(ch)))
    return re.sub(r'[^A-Za-z0-9]+', '-', text).strip('-')


def _version_label(id_expansion, p):
    if id_expansion in COLLECTOR_LABEL_EXPANSIONS:
        parts = ['U' if p['edition'] == 'u' else '', p['collector_number'], FOIL_CODE.get(p['foiling'], '')]
        return '-'.join(part for part in parts if part)
    arts = set((p['art_variations'] or '').split(','))
    if p.get('rarity') in ('v', 'V') or 'FA' in arts:
        return 'Marvel'
    if id_expansion == 5041:  # History Pack 1 (its Black Label twin says "Regular")
        return 'Normal'
    word = FINISH_WORD.get(p['foiling'], 'Regular')
    return f'Extended-Art-{word}' if 'EA' in arts else word


def cardmarket_url(cm_name, expansion_name, id_expansion, printing):
    """Link to the Cardmarket product page, built from the naming scheme verified by hand on
    cardmarket.com (the JSON has no URLs and the site blocks automated checks). Expansions whose
    scheme we haven't verified get a name search instead, which always resolves."""
    if id_expansion in SEARCH_ONLY_EXPANSIONS:
        return CARDMARKET_SEARCH + quote_plus(cm_name)
    return f'{CARDMARKET_SINGLES}{_slug(expansion_name)}/{_slug(cm_name)}-{_version_label(id_expansion, printing)}'


PRINTINGS_SQL = """
    SELECT p.printing_id, c.name, lower(c.color) AS pitch, p.set, p.edition, p.foiling, p.collector_number,
           array_to_string(p.art_variations, ',') AS art_variations, round(p.tcg_low::numeric, 2)::float AS tcg_low,
           p.tcgplayer_product_id::text AS tcgplayer_product_id, p.is_front_face,
           lower(bc.name) AS back_name, p.card_unique_id, p.rarity,
           p.cardmarket_product_id, p.cardmarket_match_status
    FROM printings p
    JOIN cards c ON c.card_unique_id = p.card_unique_id
    LEFT JOIN printings b ON b.printing_id = p.other_face_printing_id AND b.printing_id <> p.printing_id
    LEFT JOIN cards bc ON bc.card_unique_id = b.card_unique_id
    WHERE p.language = 'en'
"""


def load_printings(conn):
    """Our English printings in the shape match() expects (read-only)."""
    import psycopg2.extras

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(PRINTINGS_SQL)
        printings = [dict(r) for r in cur.fetchall()]
    for p in printings:
        if p['pitch'] not in ('red', 'yellow', 'blue'):
            p['pitch'] = None
    return printings


def main():
    """Dry run: match local Cardmarket files against the DB (read-only) and write a review CSV."""
    import argparse
    import json
    import os
    from collections import Counter

    import psycopg2
    import psycopg2.extras

    parser = argparse.ArgumentParser(description=main.__doc__)
    parser.add_argument('--products', required=True, help='products_singles_16.json')
    parser.add_argument('--prices', required=True, help='price_guide_16.json')
    parser.add_argument('--out', required=True, help='review CSV to write')
    parser.add_argument('--card-ids', help='file of card_unique_ids to report on (default: all)')
    args = parser.parse_args()

    products = json.load(open(args.products))['products']
    prices = {g['idProduct']: g for g in json.load(open(args.prices))['priceGuides']}
    conn = psycopg2.connect(os.environ['POSTGRES_URL'])
    try:
        printings = load_printings(conn)
    finally:
        conn.close()

    emap = load_expansion_map()
    unknown = unknown_expansions(products, emap)
    if unknown:
        print(f'⚠️  Cardmarket expansions missing from {EXPANSIONS_CSV.name}: {unknown}')

    results = match(products, prices, printings, emap, load_name_aliases())
    by_id = {p['printing_id']: p for p in printings}
    product_by_id = {prod['idProduct']: prod for prod in products}
    with open(EXPANSIONS_CSV, newline='') as f:
        expansion_names = {int(r['id_expansion']): r['cardmarket_name'] for r in csv.DictReader(f)}
    if args.card_ids:
        wanted = {line.strip() for line in open(args.card_ids) if line.strip()}
        results = [r for r in results if by_id[r['printing_id']]['card_unique_id'] in wanted]

    with open(args.out, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['status', 'printing_id', 'collector_number', 'name', 'pitch', 'set', 'edition', 'foiling',
                    'art', 'tcg_low_usd', 'cm_product', 'cm_trend_eur', 'cm_low_eur', 'other_products', 'cm_url'])
        for r in results:
            p = by_id[r['printing_id']]
            g = prices.get(r['product_id']) or {}
            others = r.get('all_product_ids') or r.get('candidate_product_ids') or []
            prod = product_by_id.get(r['product_id'])
            url = cardmarket_url(prod['name'], expansion_names[prod['idExpansion']], prod['idExpansion'], p) if prod else ''
            w.writerow([r['status'], p['printing_id'], p['collector_number'], p['name'], p['pitch'] or '', p['set'],
                        p['edition'], p['foiling'], p['art_variations'], p['tcg_low'] or '', r['product_id'] or '',
                        g.get('trend') or '', g.get('low') or '', ' '.join(map(str, others)), url])

    counts = Counter(r['status'] for r in results)
    total = len(results)
    print(f'{total} printings')
    for status, n in counts.most_common():
        print(f'  {status:15s} {n:6d}  {n / total:.0%}')
    print(f'review CSV: {args.out}')


if __name__ == '__main__':
    main()
