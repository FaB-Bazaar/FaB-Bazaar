#!/usr/bin/env python3
"""
🎯 TCG Price Enhancer for FAB Cards (Fixed for Multiple Groups per Set)
Adds price data to enhanced cards JSON from tcgcsv API.

FIXED: Now handles sets like GEM that have multiple group IDs (GEM Pack 1 & GEM Pack 2)
"""

import json
import csv
import os
import re
import requests
from datetime import datetime
import time

# tcgcsv.com's owner (CptSpaceToaster) 401s requests with the default `python-requests`
# UA and asks apps to identify themselves per their stated convention:
#   "Please identify your application by setting 'User-Agent': 'Your-Application-Name/X.Y.Z'"
# The +URL lets them reach out if our volume ever looks abusive.
TCGCSV_HEADERS = {
    "User-Agent": "FaBBazaar-Pipeline/1.0 (+https://fabbazaar.app)",
    "Accept": "application/json",
}

# ─── feed_overrides: manual corrections to the fab-cube feed (migration 0095) ──
#
# The upstream feed occasionally ships a wrong tcgplayer_product_id (e.g. the
# SEA015-017 Cloud City Steamboat cycle pointed at 1st Strike products, so a
# bulk rare displayed a $128.70 single-listing ask). Overrides patch the feed
# HERE, before price lookup, so corrected ids flow through pricing, snapshots,
# and the 005 upsert with no downstream special-casing.

# Only feed-identity fields may be overridden. Prices are computed from the
# (corrected) product id — never overridden directly.
ALLOWED_OVERRIDE_FIELDS = (
    'tcgplayer_product_id',
    'tcgplayer_url',
    'tcgplayer_subtype_name',
)

_PRODUCT_URL_RE = re.compile(r'/product/(\d+)')

# TCGplayer subtype names are "<edition> <treatment>" or bare "<treatment>".
# The edition label is the part that disagrees with our data most often, so
# strip it to compare the treatment — which must always match exactly.
_EDITION_PREFIXES = ("1st Edition ", "Unlimited Edition ")


def _base_treatment(sub_type_name):
    """"1st Edition Cold Foil" -> "Cold Foil"; "Normal" -> "Normal"."""
    name = (sub_type_name or "").strip()
    for prefix in _EDITION_PREFIXES:
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


def _extract_cards(cards_data):
    """Return the list of card dicts from any of the JSON shapes 002 accepts."""
    if isinstance(cards_data, list):
        return cards_data
    if isinstance(cards_data, dict):
        if 'cards' in cards_data:
            return cards_data['cards']
        if 'data' in cards_data:
            return cards_data['data']
        return list(cards_data.values())
    return None


def resolve_overrides_db_url(use_production):
    """Same env selection as 005/006 (POSTGRES_URL_PROD / POSTGRES_URL_STAGING),
    with a POSTGRES_URL fallback for ad-hoc local runs."""
    from dotenv import load_dotenv
    load_dotenv()
    if use_production:
        return os.getenv('POSTGRES_URL_PROD')
    return os.getenv('POSTGRES_URL_STAGING') or os.getenv('POSTGRES_URL')


def fetch_feed_overrides(db_url):
    """Fetch active feed_overrides rows. Raises on connection/query failure —
    callers decide whether that's fatal (the pipeline warns and continues)."""
    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT collector_number, edition, foiling, language, set_fields "
                "FROM feed_overrides WHERE active = true"
            )
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def apply_feed_overrides(cards, overrides):
    """Patch feed printings in place from override rows.

    Matching: collector_number vs printing['id'], case-insensitive;
    edition/foiling None = match any. The feed is English-only, so non-'en'
    overrides are skipped. Only ALLOWED_OVERRIDE_FIELDS keys are applied.
    """
    stats = {
        'applied': 0,
        'applied_details': [],
        'unmatched': [],
        'skipped_non_english': 0,
        'ignored_fields': [],
    }
    for override in overrides:
        if (override.get('language') or 'en').lower() != 'en':
            stats['skipped_non_english'] += 1
            continue

        collector = str(override.get('collector_number') or '').upper()
        edition = override.get('edition')
        foiling = override.get('foiling')
        requested = override.get('set_fields') or {}
        fields = {k: v for k, v in requested.items() if k in ALLOWED_OVERRIDE_FIELDS}
        for key in requested:
            if key not in ALLOWED_OVERRIDE_FIELDS and key not in stats['ignored_fields']:
                stats['ignored_fields'].append(key)

        matched = False
        for card in cards:
            for printing in card.get('printings', []):
                if str(printing.get('id') or '').upper() != collector:
                    continue
                if edition is not None and str(printing.get('edition') or '').upper() != edition.upper():
                    continue
                if foiling is not None and str(printing.get('foiling') or '').upper() != foiling.upper():
                    continue
                printing.update(fields)
                matched = True
                stats['applied'] += 1
                stats['applied_details'].append({
                    'card_name': card.get('name'),
                    'printing_id': printing.get('id'),
                    'edition': printing.get('edition'),
                    'foiling': printing.get('foiling'),
                    'fields': fields,
                })
        if not matched:
            stats['unmatched'].append({
                'collector_number': override.get('collector_number'),
                'edition': edition,
                'foiling': foiling,
            })
    return stats


def collect_product_url_mismatches(cards):
    """Flag printings whose tcgplayer_product_id disagrees with the product id
    embedded in their own tcgplayer_url — the signature of the upstream feed
    bug that mispriced SEA015-017. Report-only: a human decides which side is
    right and records a feed_overrides row."""
    mismatches = []
    for card in cards:
        for printing in card.get('printings', []):
            product_id = printing.get('tcgplayer_product_id')
            url = printing.get('tcgplayer_url') or ''
            if not product_id:
                continue
            match = _PRODUCT_URL_RE.search(url)
            if not match:
                continue
            if str(product_id) != match.group(1):
                mismatches.append({
                    'card_name': card.get('name'),
                    'printing_id': printing.get('id'),
                    'edition': printing.get('edition'),
                    'foiling': printing.get('foiling'),
                    'product_id': str(product_id),
                    'url_product_id': match.group(1),
                })
    return mismatches


class TCGPriceEnhancer:
    def __init__(self, use_production=False, apply_overrides=True):
        self.group_csv_file = "fab_set_with_db.csv"
        self.use_production = use_production
        self.apply_overrides = apply_overrides
        self.override_stats = None
        self.product_url_mismatches = []
        
        # Statistics tracking
        self.stats = {
            'total_printings': 0,
            'printings_with_product_id': 0,
            'price_data_added': 0,
            'price_data_not_found': 0,
            'api_calls_made': 0,
            'unique_groups_processed': 0
        }
        
        # Change tracking
        self.changes_made = []
        self.missing_items = []
    
    def load_group_mappings(self):
        """Load set code -> group ID mappings from CSV, handling multiple groups per set"""
        print("📋 Loading group ID mappings...")
        
        try:
            group_mappings = {}  # set_code -> list of group_ids
            duplicate_sets = {}  # Track sets with multiple groups
            
            with open(self.group_csv_file, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    set_code = row['printings.set'].strip()
                    group_id = int(row['group_id'])
                    set_name = row['set_name'].strip()
                    
                    # Handle multiple groups per set code
                    if set_code not in group_mappings:
                        group_mappings[set_code] = []
                    else:
                        # Track duplicate sets for debugging
                        if set_code not in duplicate_sets:
                            duplicate_sets[set_code] = []
                        duplicate_sets[set_code].append(set_name)
                    
                    group_mappings[set_code].append(group_id)
                    
                    # Also add uppercase version for case-insensitive lookup
                    set_code_upper = set_code.upper()
                    if set_code_upper not in group_mappings:
                        group_mappings[set_code_upper] = []
                    group_mappings[set_code_upper].append(group_id)
            
            # Debug output for sets with multiple groups
            print(f"✅ Loaded mappings for {len(set(k.lower() for k in group_mappings.keys()))} unique sets")
            if duplicate_sets:
                print("📦 Sets with multiple groups:")
                for set_code, set_names in duplicate_sets.items():
                    group_ids = group_mappings[set_code]
                    print(f"   - {set_code.upper()}: groups {group_ids} ({', '.join(set_names)})")
            
            return group_mappings
            
        except FileNotFoundError:
            print(f"❌ Group mappings file not found: {self.group_csv_file}")
            return {}
        except Exception as e:
            print(f"❌ Error loading group mappings: {e}")
            return {}
    
    def load_enhanced_cards(self, input_file):
        """Load the enhanced cards JSON file"""
        print(f"📄 Loading enhanced cards from {input_file}...")
        
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                cards_data = json.load(f)
            
            print(f"✅ Loaded enhanced cards successfully")
            return cards_data
            
        except FileNotFoundError:
            print(f"❌ Enhanced cards file not found: {input_file}")
            return None
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON: {e}")
            return None
        except Exception as e:
            print(f"❌ Error loading enhanced cards: {e}")
            return None
    
    def get_subtype_name(self, edition, foiling):
        """Convert edition/foiling codes to subTypeName format"""
        edition_upper = str(edition).upper()
        foiling_upper = str(foiling).upper()
        
        # Determine subTypeName based on edition and foiling
        if edition_upper in ['F', 'A']:  # 1st Edition
            if foiling_upper == 'S':
                return "1st Edition Normal"
            elif foiling_upper == 'R':
                return "1st Edition Rainbow Foil"
            elif foiling_upper == 'C':
                return "1st Edition Cold Foil"
            elif foiling_upper == 'G':
                return "1st Edition Cold Foil"
            else:
                return "1st Edition Normal"
        elif edition_upper == 'U':  # Unlimited Edition
            if foiling_upper == 'S':
                return "Unlimited Edition Normal"
            elif foiling_upper == 'R':
                return "Unlimited Edition Rainbow Foil"
            else:
                return "Unlimited Edition Normal"
        else:  # Everything else (N or unknown)
            if foiling_upper == 'S':
                return "Normal"
            elif foiling_upper == 'R':
                return "Rainbow Foil"
            elif foiling_upper == 'C':
                return "Cold Foil"
            elif foiling_upper == 'G':
                # TCGplayer has no "Gold Foil" subtype anywhere in category 62 —
                # golden promos are listed as Cold Foil ("Fyendal's Spring Tunic
                # (Golden) - FAB001"). Mapping them to "Normal" asked for a
                # treatment the card doesn't have, and contradicted the
                # 1st-Edition branch above, which already maps 'G' -> Cold Foil.
                return "Cold Foil"
            else:
                return "Normal"
    
    def find_best_price_match(self, product_prices, expected_subtype, edition, foiling):
        """
        Exact subtype match, with one unambiguous fallback.

        TCGplayer's subTypeName does not always agree with our (edition,
        foiling): promos stored as edition='n' are frequently labelled
        "1st Edition ..." (TEA001 -> "1st Edition Normal"), gold foils are
        listed as Cold Foil while get_subtype_name() maps 'g' -> "Normal",
        and some foilings simply disagree. Exact-match-only therefore left
        280 printings with a valid product id and no price at all.

        When the product offers exactly ONE priced subtype there is nothing to
        choose between, so that price is unambiguously this product's price.
        Products with 2+ priced subtypes still require an exact match —
        guessing between "1st Edition Rainbow Foil" and "Unlimited Edition
        Normal" is precisely the misleading data this rule exists to prevent.

        Returns (price_info, match_quality) or (None, None).
        """

        # Exact match always wins.
        if expected_subtype in product_prices:
            return product_prices[expected_subtype], "exact"

        # Sole priced subtype — no alternative to be wrong about. Unlisted
        # variants carry a null tcg_low and must not count toward the total,
        # nor be imported as a price.
        priced = [p for p in product_prices.values() if p.get('tcg_low') is not None]
        if len(priced) == 1:
            sole = priced[0]
            # ...but never across a foil treatment. When a foil variant's
            # listings sell out, the product is left with only its non-foil
            # subtype priced, and falling back onto that silently reprices the
            # foil at the non-foil price (GEM165: Rainbow Foil $21.51 ->
            # Normal $7.42). Ignoring the edition label is safe; ignoring the
            # treatment is not.
            if _base_treatment(sole.get('tcgplayer_subTypeName', '')) == _base_treatment(expected_subtype):
                return sole, "sole_subtype"

        # Genuinely ambiguous, treatment mismatch, or nothing listed.
        return None, None
    
    def fetch_price_data_for_groups(self, group_mappings):
        """Fetch price data for all groups, handling multiple groups per set"""
        print("💰 Fetching price data from TCG API...")
        
        price_data = {}  # productId -> {subTypeName -> price_info}
        
        # Flatten all group IDs from all sets (handle both list and single values)
        all_group_ids = set()
        for group_list in group_mappings.values():
            if isinstance(group_list, list):
                all_group_ids.update(group_list)
            else:
                all_group_ids.add(group_list)  # Handle legacy single-value case
        
        self.stats['unique_groups_processed'] = len(all_group_ids)
        print(f"📊 Will fetch price data for {len(all_group_ids)} unique groups")
        
        for group_id in sorted(all_group_ids):
            # Find which sets use this group
            sets_for_group = []
            for set_code, group_list in group_mappings.items():
                if isinstance(group_list, list):
                    if group_id in group_list:
                        sets_for_group.append(set_code)
                else:
                    if group_id == group_list:
                        sets_for_group.append(set_code)
            
            # Remove duplicates and show only lowercase versions
            unique_sets = list(set(s.lower() for s in sets_for_group))
            print(f"   💰 Fetching prices for group {group_id} ({', '.join(unique_sets)})...")
            
            try:
                url = f"https://tcgcsv.com/tcgplayer/62/{group_id}/prices"
                response = requests.get(url, timeout=30, headers=TCGCSV_HEADERS)
                response.raise_for_status()
                
                response_data = response.json()
                self.stats['api_calls_made'] += 1
                
                # Extract price data from API response
                prices = response_data.get('results', [])
                if not isinstance(prices, list):
                    print(f"      ❌ Invalid response structure")
                    continue
                
                prices_found = 0
                for price_entry in prices:
                    if not isinstance(price_entry, dict):
                        continue
                    
                    product_id = price_entry.get('productId')
                    sub_type_name = price_entry.get('subTypeName')
                    
                    if product_id and sub_type_name:
                        if product_id not in price_data:
                            price_data[product_id] = {}
                        
                        price_data[product_id][sub_type_name] = {
                            'tcg_low': price_entry.get('lowPrice'),
                            'tcg_mid': price_entry.get('midPrice'),
                            'tcg_high': price_entry.get('highPrice'),
                            'tcg_market': price_entry.get('marketPrice'),
                            'tcgplayer_subTypeName': sub_type_name
                        }
                        prices_found += 1
                
                print(f"      ✅ Found {prices_found} price entries")
                time.sleep(0.5)  # Be nice to the API
                
            except requests.exceptions.RequestException as e:
                print(f"      ❌ API error: {e}")
                continue
            except Exception as e:
                print(f"      ❌ Processing error: {e}")
                continue
        
        total_products = len(price_data)
        total_variants = sum(len(variants) for variants in price_data.values())
        print(f"✅ Price fetch complete: {total_products} products with {total_variants} price variants")
        return price_data
    
    def enhance_with_prices(self, cards_data, price_data):
        """Add price data to printings that have tcgplayer_product_id"""
        print("💰 Enhancing cards with price data...")
        
        cards = _extract_cards(cards_data)
        if cards is None:
            print(f"❌ Unexpected JSON structure")
            return False
        
        print(f"📊 Processing {len(cards)} cards...")
        
        for card in cards:
            for printing in card.get('printings', []):
                self.stats['total_printings'] += 1
                
                product_id = printing.get('tcgplayer_product_id')
                
                if product_id:
                    self.stats['printings_with_product_id'] += 1
                    
                    # Convert product_id to int for lookup
                    try:
                        product_id_int = int(product_id)
                    except (ValueError, TypeError):
                        continue
                    
                    # Look for price data
                    if product_id_int in price_data:
                        product_prices = price_data[product_id_int]
                        
                        # Determine the expected subTypeName
                        expected_subtype = self.get_subtype_name(
                            printing.get('edition'),
                            printing.get('foiling')
                        )
                        
                        # Find best price match
                        price_info, match_quality = self.find_best_price_match(
                            product_prices, 
                            expected_subtype,
                            printing.get('edition'),
                            printing.get('foiling')
                        )
                        
                        if price_info and match_quality:
                            # Add price fields to printing
                            printing['tcg_low'] = price_info['tcg_low']
                            printing['tcg_mid'] = price_info['tcg_mid']
                            printing['tcg_high'] = price_info['tcg_high']
                            printing['tcg_market'] = price_info['tcg_market']
                            printing['tcgplayer_subTypeName'] = price_info['tcgplayer_subTypeName']
                            printing['tcg_price_match_quality'] = match_quality
                            
                            self.stats['price_data_added'] += 1
                            
                            self.changes_made.append({
                                'card_name': card.get('name', 'Unknown'),
                                'card_number': printing.get('id'),
                                'product_id': product_id,
                                'expected_subtype': expected_subtype,
                                'actual_subtype': price_info['tcgplayer_subTypeName'],
                                'match_quality': match_quality,
                                'price_data': {
                                    'low': price_info['tcg_low'],
                                    'mid': price_info['tcg_mid'],
                                    'high': price_info['tcg_high'],
                                    'market': price_info['tcg_market']
                                }
                            })
                        else:
                            # No exact price match found - set fields to null
                            printing['tcg_low'] = None
                            printing['tcg_mid'] = None
                            printing['tcg_high'] = None
                            printing['tcg_market'] = None
                            printing['tcgplayer_subTypeName'] = None
                            printing['tcg_price_match_quality'] = 'no_exact_match'
                            
                            self.stats['price_data_not_found'] += 1
                            self.missing_items.append({
                                'card_name': card.get('name', 'Unknown'),
                                'card_number': printing.get('id'),
                                'product_id': product_id,
                                'expected_subtype': expected_subtype,
                                'available_subtypes': list(product_prices.keys()) if product_prices else [],
                                'reason': 'no_exact_subtype_match'
                            })
                    else:
                        # Product ID not found in price data - set fields to null
                        expected_subtype = self.get_subtype_name(
                            printing.get('edition'),
                            printing.get('foiling')
                        )
                        
                        printing['tcg_low'] = None
                        printing['tcg_mid'] = None
                        printing['tcg_high'] = None
                        printing['tcg_market'] = None
                        printing['tcgplayer_subTypeName'] = None
                        printing['tcg_price_match_quality'] = 'product_not_found'
                        
                        self.stats['price_data_not_found'] += 1
                        self.missing_items.append({
                            'card_name': card.get('name', 'Unknown'),
                            'card_number': printing.get('id'),
                            'product_id': product_id,
                            'expected_subtype': expected_subtype,
                            'reason': 'product_id_not_in_price_data'
                        })
        
        print("✅ Price enhancement completed")
        return True
    
    def save_enhanced_json(self, cards_data, output_file):
        """Save the price-enhanced cards data"""
        print(f"💾 Saving price-enhanced data to {output_file}...")
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(cards_data, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Saved price-enhanced data to {output_file}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to save file: {e}")
            return False
    
    def save_reports(self, output_file):
        """Save price enhancement reports"""
        base_name = output_file.replace('.json', '')
        
        # Main report
        report = {
            'timestamp': datetime.now().isoformat(),
            'enhancement_type': 'tcg_price_data',
            'statistics': self.stats,
            'feed_overrides': self.override_stats,
            'product_url_mismatches': self.product_url_mismatches,
            'changes_made': self.changes_made,
            'missing_items': self.missing_items,
            'price_fields_added': [
                'tcg_low',
                'tcg_mid', 
                'tcg_high',
                'tcg_market',
                'tcgplayer_subTypeName',
                'tcg_price_match_quality'
            ]
        }
        
        report_file = f"{base_name}.price_report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        # Summary
        summary_file = f"{base_name}.price_summary.txt"
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write("TCG PRICE ENHANCEMENT REPORT\n")
            f.write("=" * 50 + "\n\n")
            
            f.write("STATISTICS:\n")
            f.write(f"Total printings processed: {self.stats['total_printings']}\n")
            f.write(f"Printings with product ID: {self.stats['printings_with_product_id']}\n")
            f.write(f"Price data successfully added: {self.stats['price_data_added']}\n")
            f.write(f"Price data not found: {self.stats['price_data_not_found']}\n")
            f.write(f"API calls made: {self.stats['api_calls_made']}\n")
            f.write(f"Unique groups processed: {self.stats['unique_groups_processed']}\n\n")
            
            if self.stats['printings_with_product_id'] > 0:
                success_rate = (self.stats['price_data_added'] / self.stats['printings_with_product_id'] * 100)
                f.write(f"SUCCESS RATE:\n")
                f.write(f"Price data added for {self.stats['price_data_added']}/{self.stats['printings_with_product_id']} printings with product IDs ({success_rate:.1f}%)\n\n")
            
            f.write("FIELDS ADDED:\n")
            f.write("- tcg_low: Lowest market price\n")
            f.write("- tcg_mid: Mid market price\n")
            f.write("- tcg_high: Highest market price\n")
            f.write("- tcg_market: Market average price\n")
            f.write("- tcgplayer_subTypeName: Card variant type (Normal, Rainbow Foil, etc.)\n")
            f.write("- tcg_price_match_quality: Quality of price match (exact, good_fallback, etc.)\n")
        
        print(f"✅ Reports saved: {report_file}, {summary_file}")
    
    def print_statistics(self):
        """Display final statistics"""
        print("\n💰 TCG PRICE ENHANCEMENT STATISTICS")
        print("=" * 50)
        print(f"Total printings processed: {self.stats['total_printings']:,}")
        print(f"Printings with product ID: {self.stats['printings_with_product_id']:,}")
        print(f"Price data successfully added: {self.stats['price_data_added']:,}")
        print(f"Price data not found: {self.stats['price_data_not_found']:,}")
        print(f"API calls made: {self.stats['api_calls_made']}")
        print(f"Unique groups processed: {self.stats['unique_groups_processed']}")
        
        if self.stats['printings_with_product_id'] > 0:
            success_rate = (self.stats['price_data_added'] / self.stats['printings_with_product_id'] * 100)
            print(f"\nSuccess rate: {self.stats['price_data_added']:,}/{self.stats['printings_with_product_id']:,} ({success_rate:.1f}%)")
    
    def run(self, input_file, output_file):
        """Run the complete TCG price enhancement process"""
        print("🚀 STARTING TCG PRICE ENHANCER (FIXED FOR MULTIPLE GROUPS)")
        print("=" * 60)
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Input: {input_file}")
        print(f"Output: {output_file}")
        print()
        
        # Step 1: Load group mappings
        group_mappings = self.load_group_mappings()
        if not group_mappings:
            print("❌ No group mappings - cannot proceed")
            return False
        
        print()
        
        # Step 2: Load enhanced cards
        cards_data = self.load_enhanced_cards(input_file)
        if cards_data is None:
            print("❌ Failed to load enhanced cards")
            return False

        print()

        # Step 2b: Apply feed_overrides (manual feed corrections) BEFORE price
        # lookup, so corrected tcgplayer ids drive pricing. A failed fetch
        # warns and continues — one night of uncorrected feed beats killing
        # the run before images/snapshots (and step 08 fails anyway if the DB
        # is truly down).
        cards = _extract_cards(cards_data)
        if cards is None:
            print("❌ Unexpected JSON structure")
            return False
        if self.apply_overrides:
            db_url = resolve_overrides_db_url(self.use_production)
            if not db_url:
                print("⚠️  feed_overrides: no database URL configured — skipping overrides")
            else:
                try:
                    overrides = fetch_feed_overrides(db_url)
                    self.override_stats = apply_feed_overrides(cards, overrides)
                    s = self.override_stats
                    print(f"🔧 feed_overrides: {len(overrides)} active row(s), "
                          f"{s['applied']} printing(s) patched")
                    for detail in s['applied_details']:
                        print(f"   ✏️  {detail['printing_id']} {detail['foiling']}: {detail['fields']}")
                    if s['unmatched']:
                        print(f"   ⚠️  {len(s['unmatched'])} override(s) matched nothing: "
                              f"{[u['collector_number'] for u in s['unmatched']]}")
                    if s['ignored_fields']:
                        print(f"   ⚠️  ignored non-whitelisted field(s): {s['ignored_fields']}")
                except Exception as e:
                    print(f"⚠️  feed_overrides: fetch failed ({e}) — continuing WITHOUT overrides")
        else:
            print("⏭️  feed_overrides: disabled (--no-overrides)")

        # Step 2c: Warn on feed rows whose product id disagrees with their own
        # URL — the upstream bug signature that mispriced SEA015-017. Runs
        # AFTER overrides so corrected rows no longer flag.
        self.product_url_mismatches = collect_product_url_mismatches(cards)
        if self.product_url_mismatches:
            print(f"⚠️  {len(self.product_url_mismatches)} printing(s) have "
                  f"tcgplayer_product_id ≠ id in tcgplayer_url (candidates for feed_overrides):")
            for m in self.product_url_mismatches[:20]:
                print(f"   ❓ {m['printing_id']} {m['foiling']} {m['card_name']}: "
                      f"product_id={m['product_id']} url={m['url_product_id']}")
            if len(self.product_url_mismatches) > 20:
                print(f"   … and {len(self.product_url_mismatches) - 20} more (see price report)")

        print()

        # Step 3: Fetch price data
        price_data = self.fetch_price_data_for_groups(group_mappings)
        if not price_data:
            print("❌ No price data fetched")
            return False
        
        print()
        
        # Step 4: Enhance cards with price data
        success = self.enhance_with_prices(cards_data, price_data)
        if not success:
            print("❌ Price enhancement failed")
            return False
        
        print()
        
        # Step 5: Save price-enhanced JSON
        success = self.save_enhanced_json(cards_data, output_file)
        if not success:
            print("❌ Failed to save price-enhanced file")
            return False
        
        # Step 6: Save reports
        self.save_reports(output_file)
        
        # Step 7: Show statistics
        self.print_statistics()
        
        print(f"\n💰 TCG PRICE ENHANCEMENT COMPLETED SUCCESSFULLY!")
        print(f"Price-enhanced file: {output_file}")
        print("✅ Price data added to all available printings")
        
        return True

def main():
    """CLI interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='TCG Price Enhancer - Add price data to enhanced FAB cards (Fixed for multiple groups)')
    parser.add_argument('input', help='Input enhanced cards JSON file')
    parser.add_argument('--output', '-o', help='Output filename (default: input_with_tcg_prices.json)')
    parser.add_argument('--production', action='store_true',
                        help='Read feed_overrides from the production DB (default: staging)')
    parser.add_argument('--no-overrides', action='store_true',
                        help='Skip applying feed_overrides from the database')

    args = parser.parse_args()
    
    # Generate default output filename if not provided
    if not args.output:
        if args.input.endswith('.json'):
            args.output = args.input.replace('.json', '_with_tcg_prices.json')
        else:
            args.output = args.input + '_with_tcg_prices.json'
    
    enhancer = TCGPriceEnhancer(use_production=args.production,
                                apply_overrides=not args.no_overrides)
    success = enhancer.run(args.input, args.output)
    
    exit(0 if success else 1)

if __name__ == "__main__":
    main()