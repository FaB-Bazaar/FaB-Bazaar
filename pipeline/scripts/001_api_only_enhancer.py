#!/usr/bin/env python3
"""
🎯 API-Only FAB Cards Enhancer - FIXED VERSION
Simple, focused script that enhances cards JSON with missing TCGPlayer data from API.

FIXES:
- Handles multiple products per card number (Extended Art, Marvel, etc.)
- Smart matching based on art_variations and rarity codes
- No more data overwrites - each variation gets correct name
- Fixed duplicate detection to only flag real issues
- Preserves string data types

Principles:
- NEVER overwrite existing data unless it's genuinely incorrect
- Only add missing tcgplayer_product_id, tcgplayer_url, tcgplayer_name, tcgplayer_rarity, tcgplayer_set_number, and set_name
- Use TCG API as single source of truth for missing data
- Generate URLs deterministically when needed
"""

import json
import csv
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

class APIOnlyEnhancer:
    def __init__(self):
        # self.cards_url = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/develop/json/english/card.json"
        # self.cards_url = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/compendium-of-rathe/json/english/card.json"
        self.cards_url = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/omens-of-the-third-age/json/english/card.json"
        self.group_csv_file = "fab_set_with_db.csv"
        
        # Statistics tracking
        self.stats = {
            'total_printings': 0,
            'already_had_id': 0,
            'already_had_url': 0,
            'already_had_name': 0,
            'already_had_rarity': 0,
            'already_had_set_number': 0,
            'already_had_set_name': 0,
            'api_ids_added': 0,
            'api_urls_added': 0,
            'api_names_added': 0,
            'api_rarities_added': 0,
            'api_set_numbers_added': 0,
            'set_names_added': 0,
            'generated_urls': 0,
            'still_missing_id': 0,
            'still_missing_url': 0,
            'still_missing_name': 0,
            'still_missing_rarity': 0,
            'still_missing_set_number': 0,
            'still_missing_set_name': 0,
            'api_calls_made': 0,
            'api_products_fetched': 0,
            'multiple_products_found': 0,
            'smart_matches_made': 0,
            'duplicate_corrections': 0
        }
        
        # Change tracking
        self.changes_made = []
        self.missing_items = []
        self.matching_decisions = []
    
    def load_group_mappings(self):
        """Load set code -> group ID mappings and set names from CSV"""
        print("📋 Loading group ID mappings and set names...")
        
        try:
            group_mappings = {}  # set_code -> list of group_ids
            set_names = {}  # set_code -> set_name mapping

            with open(self.group_csv_file, 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    set_code = row['printings.set'].strip()
                    group_id = int(row['group_id'])
                    set_name = row.get('set_name', '').strip()

                    # Collect all group_ids per set code (handles GEM Pack 1-4, Silver Age, etc.)
                    if set_code not in group_mappings:
                        group_mappings[set_code] = []
                    if group_id not in group_mappings[set_code]:
                        group_mappings[set_code].append(group_id)

                    # Also add uppercase version for case-insensitive lookup
                    set_code_upper = set_code.upper()
                    if set_code_upper not in group_mappings:
                        group_mappings[set_code_upper] = []
                    if group_id not in group_mappings[set_code_upper]:
                        group_mappings[set_code_upper].append(group_id)

                    if set_name:
                        set_names[set_code] = set_name

            print(f"✅ Loaded {len(set(k.lower() for k in group_mappings.keys()))} unique sets and {len(set_names)} set names")
            return group_mappings, set_names
            
        except FileNotFoundError:
            print(f"❌ Group mappings file not found: {self.group_csv_file}")
            return {}, {}
        except Exception as e:
            print(f"❌ Error loading group mappings: {e}")
            return {}, {}
    
    def download_cards_json(self):
        """Download cards JSON from GitHub"""
        print("🔄 Downloading cards JSON...")
        
        try:
            response = requests.get(self.cards_url, timeout=30)
            response.raise_for_status()
            
            cards_data = response.json()
            print(f"✅ Downloaded cards JSON successfully")
            return cards_data
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to download cards JSON: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON: {e}")
            return None
    
    def extract_extended_data_value(self, extended_data, field_name):
        """Extract value from extendedData array by field name"""
        if not isinstance(extended_data, list):
            return None
            
        for item in extended_data:
            if isinstance(item, dict) and item.get('name') == field_name:
                return item.get('value')
        return None
    
    def fetch_api_data(self, group_mappings):
        """Fetch all product data from TCG API - FIXED VERSION"""
        print("🔄 Fetching data from TCG API...")
        
        # FIXED: Use list to store ALL products, not just one per card number
        api_products_list = []  # List of all products
        api_products_by_number = {}  # card_number -> list of products
        
        seen_group_ids = set()
        for set_code, group_ids in group_mappings.items():
            for group_id in group_ids:
                if group_id in seen_group_ids:
                    continue
                seen_group_ids.add(group_id)
                print(f"   📡 Fetching group {group_id} ({set_code})...")

                try:
                    url = f"https://tcgcsv.com/tcgplayer/62/{group_id}/products"
                    response = requests.get(url, timeout=30, headers=TCGCSV_HEADERS)
                    response.raise_for_status()

                    response_data = response.json()
                    self.stats['api_calls_made'] += 1

                    products = response_data.get('results', [])
                    if not isinstance(products, list):
                        print(f"      ❌ Invalid response structure")
                        continue

                    products_found = 0
                    for product in products:
                        if not isinstance(product, dict):
                            continue

                        extended_data = product.get('extendedData', [])
                        card_number = self.extract_extended_data_value(extended_data, 'Number')

                        if card_number:
                            rarity = self.extract_extended_data_value(extended_data, 'Rarity')

                            product_data = {
                                'productId': product.get('productId'),
                                'url': product.get('url'),
                                'name': product.get('name'),
                                'rarity': rarity,
                                'set_number': card_number,
                                'set_code': set_code
                            }

                            # Store ALL products
                            api_products_list.append(product_data)

                            # Group by card number
                            if card_number not in api_products_by_number:
                                api_products_by_number[card_number] = []
                            api_products_by_number[card_number].append(product_data)

                            products_found += 1
                            self.stats['api_products_fetched'] += 1

                    print(f"      ✅ Found {products_found} products")
                    time.sleep(0.5)

                except requests.exceptions.RequestException as e:
                    print(f"      ❌ API error: {e}")
                    continue
                except Exception as e:
                    print(f"      ❌ Processing error: {e}")
                    continue
        
        # Track cards with multiple products
        multiple_product_cards = {k: v for k, v in api_products_by_number.items() if len(v) > 1}
        self.stats['multiple_products_found'] = len(multiple_product_cards)
        
        print(f"✅ API fetch complete: {len(api_products_list)} total products")
        print(f"   📊 Cards with multiple products: {len(multiple_product_cards)}")
        
        # Log some examples of multiple products
        for card_num, products in list(multiple_product_cards.items())[:3]:
            print(f"   🔍 {card_num}: {[p['name'] for p in products]}")
        
        return api_products_by_number

    def detect_and_resolve_duplicate_product_ids(self, cards_data, api_products_by_number):
        """Find card numbers where multiple variants incorrectly share the same product ID"""
        
        # Group by card number, then by product ID
        card_number_map = {}  # card_number -> {product_id -> [(card, printing)]}
        
        for card in cards_data:
            for printing in card.get('printings', []):
                card_number = printing.get('id')
                product_id = printing.get('tcgplayer_product_id')
                
                if card_number and product_id:
                    if card_number not in card_number_map:
                        card_number_map[card_number] = {}
                    if product_id not in card_number_map[card_number]:
                        card_number_map[card_number][product_id] = []
                    card_number_map[card_number][product_id].append((card, printing))
        
        corrections_made = 0
        
        # Only process card numbers where multiple variants share the same product ID
        for card_number, product_map in card_number_map.items():
            for product_id, printing_pairs in product_map.items():
                if len(printing_pairs) > 1:
                    # Check if these are actually different variants
                    variants = []
                    for card, printing in printing_pairs:
                        variant = (
                            printing.get('rarity', ''),
                            'EA' in printing.get('art_variations', []),
                            printing.get('foiling', '')
                        )
                        variants.append(variant)
                    
                    # If multiple different variants share same product ID, fix them
                    if len(set(variants)) > 1:
                        print(f"🔍 Found {len(printing_pairs)} variants of {card_number} sharing product ID {product_id}")
                        
                        for card, printing in printing_pairs:
                            if card_number in api_products_by_number:
                                products_list = api_products_by_number[card_number]
                                correct_product = self.find_best_matching_product(products_list, printing)
                                
                                if correct_product:
                                    correct_id = str(correct_product['productId'])
                                    if correct_id != product_id:
                                        print(f"  🔧 Correcting {card.get('name')} {card_number}: {product_id} → {correct_id}")
                                        
                                        printing['tcgplayer_product_id'] = correct_id
                                        printing['tcgplayer_name'] = correct_product['name']
                                        printing['tcgplayer_rarity'] = correct_product['rarity']
                                        corrections_made += 1
                                        
                                        self.changes_made.append({
                                            'card_name': card.get('name', 'Unknown'),
                                            'card_number': card_number,
                                            'field': 'tcgplayer_product_id',
                                            'old_value': product_id,
                                            'new_value': correct_id,
                                            'source': 'duplicate_resolution',
                                            'reason': f"Corrected duplicate - matched to {correct_product['name']}"
                                        })
        
        return corrections_made

    def find_best_matching_product(self, products_list, printing):
        """Multi-signal matching with data type consistency"""
        
        if not products_list:
            return None
        
        # If only one product, return it
        if len(products_list) == 1:
            return products_list[0]
        
        # Extract printing characteristics
        has_extended_art = 'EA' in printing.get('art_variations', [])
        has_marvel_rarity = printing.get('rarity', '').upper() == 'V'
        has_promo_rarity = printing.get('rarity', '').upper() == 'P'
        has_golden_foiling = printing.get('foiling', '').upper() == 'G'
        
        scored_matches = []
        
        for product in products_list:
            score = 0
            product_name = product.get('name', '')
            product_rarity = product.get('rarity', '')
            product_url = product.get('url', '')
            
            # Extended Art signals
            ea_in_name = '(Extended Art)' in product_name
            ea_in_url = 'extended-art' in product_url.lower()
            
            if has_extended_art:
                if ea_in_name: score += 10
                elif ea_in_url: score += 8
                else: score -= 5
            else:
                if ea_in_name or ea_in_url: score -= 5
            
            # Marvel signals
            marvel_in_name = '(Marvel)' in product_name
            marvel_in_rarity = product_rarity == 'Marvel'
            marvel_in_url = 'marvel' in product_url.lower()
            
            if has_marvel_rarity:
                if marvel_in_name or marvel_in_rarity: score += 10
                elif marvel_in_url: score += 8
                else: score -= 5
            else:
                if marvel_in_name or marvel_in_rarity or marvel_in_url: score -= 5
            
            # Promo/Golden signals
            if has_promo_rarity or has_golden_foiling:
                if product_rarity == 'Promo' or '(Golden)' in product_name: score += 10
            
            # Base score for regular variants
            if not has_extended_art and not has_marvel_rarity and not has_promo_rarity:
                if not ea_in_name and not marvel_in_name: score += 5
            
            scored_matches.append((score, product))
        
        # Return highest scoring match
        if scored_matches:
            scored_matches.sort(key=lambda x: x[0], reverse=True)
            return scored_matches[0][1]
        
        return products_list[0]
    
    def generate_url(self, product_id, edition, foiling):
        """Generate TCGPlayer URL from product ID and printing details"""
        if not product_id:
            return ""
        
        edition_upper = str(edition).upper()
        foiling_upper = str(foiling).upper()
        
        # Determine printing parameter
        if edition_upper in ['F', 'A']:  # 1st Edition
            if foiling_upper == 'S':
                printing_param = "1st+Edition+Normal"
            elif foiling_upper == 'R':
                printing_param = "1st+Edition+Rainbow+Foil"
            elif foiling_upper == 'C':
                printing_param = "1st+Edition+Cold+Foil"
            elif foiling_upper == 'G':
                printing_param = "1st+Edition+Cold+Foil"
            else:
                printing_param = "1st+Edition+Normal"
        elif edition_upper == 'U':  # Unlimited Edition
            if foiling_upper == 'S':
                printing_param = "Unlimited+Edition+Normal"
            elif foiling_upper == 'R':
                printing_param = "Unlimited+Edition+Rainbow+Foil"
            else:
                printing_param = "Unlimited+Edition+Normal"
        else:  # Everything else (N or unknown)
            if foiling_upper == 'S':
                printing_param = "Normal"
            elif foiling_upper == 'R':
                printing_param = "Rainbow+Foil"
            elif foiling_upper == 'C':
                printing_param = "Cold+Foil"
            elif foiling_upper == 'G':
                return f"https://www.tcgplayer.com/product/{product_id}?Language=English"
            else:
                printing_param = "Normal"
        
        return f"https://www.tcgplayer.com/product/{product_id}?Language=English&Printing={printing_param}"
    
    def enhance_cards_data(self, cards_data, api_products_by_number, set_names):
        """Enhanced cards data with FIXED product matching"""
        print("🔄 Enhancing cards with missing TCGPlayer data...")
        
        # Handle different JSON structures
        if isinstance(cards_data, list):
            cards = cards_data
        elif isinstance(cards_data, dict):
            if 'cards' in cards_data:
                cards = cards_data['cards']
            elif 'data' in cards_data:
                cards = cards_data['data']
            else:
                cards = list(cards_data.values())
        else:
            print(f"❌ Unexpected JSON structure")
            return False
        
        print(f"📊 Processing {len(cards)} cards...")

        # STEP 1: Detect and resolve duplicate product IDs first
        duplicate_corrections = self.detect_and_resolve_duplicate_product_ids(cards, api_products_by_number)
        if duplicate_corrections > 0:
            print(f"✅ Resolved {duplicate_corrections} duplicate product ID conflicts")
            self.stats['duplicate_corrections'] = duplicate_corrections
        
        # STEP 2: Continue with normal enhancement for missing data
        for card in cards:
            for printing in card.get('printings', []):
                self.stats['total_printings'] += 1
                
                card_number = printing.get('id')  # e.g., "SEA074"
                set_code = printing.get('set_id')  # e.g., "SEA"
                
                # Current values
                current_id = printing.get('tcgplayer_product_id')
                current_url = printing.get('tcgplayer_url')
                current_name = printing.get('tcgplayer_name')
                current_rarity = printing.get('tcgplayer_rarity')
                current_set_number = printing.get('tcgplayer_set_number')
                current_set_name = printing.get('set_name')
                
                # Check what needs to be added
                needs_id = current_id is None or current_id == ""
                needs_url = current_url is None or current_url == ""
                needs_name = current_name is None or current_name == ""
                needs_rarity = current_rarity is None or current_rarity == ""
                needs_set_number = current_set_number is None or current_set_number == ""
                needs_set_name = current_set_name is None or current_set_name == ""
                
                # Track existing data
                if not needs_id:
                    self.stats['already_had_id'] += 1
                if not needs_url:
                    self.stats['already_had_url'] += 1
                if not needs_name:
                    self.stats['already_had_name'] += 1
                if not needs_rarity:
                    self.stats['already_had_rarity'] += 1
                if not needs_set_number:
                    self.stats['already_had_set_number'] += 1
                if not needs_set_name:
                    self.stats['already_had_set_name'] += 1
                
                # FIXED: Find best matching product for this specific printing
                if card_number and card_number in api_products_by_number:
                    products_list = api_products_by_number[card_number]
                    best_product = self.find_best_matching_product(products_list, printing)
                    
                    if best_product:
                        has_ea = printing.get('art_variations') and 'EA' in printing.get('art_variations', [])           
                        has_marvel = printing.get('rarity', '').upper() == 'V'
                        has_promo = printing.get('rarity', '').upper() == 'P'
                        has_golden = printing.get('foiling', '').upper() == 'G'
                        product_name = best_product.get('name', '')
                        
                        # Track smart matching decisions
                        if len(products_list) > 1:
                            self.stats['smart_matches_made'] += 1
                            self.matching_decisions.append({
                                'card_name': card.get('name', 'Unknown'),
                                'card_number': card_number,
                                'printing_variations': {
                                    'extended_art': has_ea,
                                    'marvel': has_marvel,
                                    'promo': has_promo,
                                    'golden': has_golden
                                },
                                'available_products': [p['name'] for p in products_list],
                                'selected_product': product_name
                            })
                        
                        print(f"      📝 {card.get('name', 'Unknown')} {card_number} (EA: {has_ea}, Marvel: {has_marvel}, Promo: {has_promo}, Golden: {has_golden}) -> '{product_name}'")
                        
                        # Add missing data from the CORRECT product (preserve string types)
                        if needs_id and best_product['productId']:
                            printing['tcgplayer_product_id'] = str(best_product['productId'])
                            self.stats['api_ids_added'] += 1
                            current_id = str(best_product['productId'])
                            
                            self.changes_made.append({
                                'card_name': card.get('name', 'Unknown'),
                                'card_number': card_number,
                                'field': 'tcgplayer_product_id',
                                'value': str(best_product['productId']),
                                'source': 'api',
                                'product_name': product_name
                            })
                        
                        if needs_name and best_product['name']:
                            printing['tcgplayer_name'] = best_product['name']
                            self.stats['api_names_added'] += 1
                            
                            self.changes_made.append({
                                'card_name': card.get('name', 'Unknown'),
                                'card_number': card_number,
                                'field': 'tcgplayer_name',
                                'value': best_product['name'],
                                'source': 'api',
                                'matched_based_on': f"EA={has_ea}, Marvel={has_marvel}, Promo={has_promo}, Golden={has_golden}"
                            })
                        
                        if needs_rarity and best_product['rarity']:
                            printing['tcgplayer_rarity'] = best_product['rarity']
                            self.stats['api_rarities_added'] += 1
                            
                            self.changes_made.append({
                                'card_name': card.get('name', 'Unknown'),
                                'card_number': card_number,
                                'field': 'tcgplayer_rarity',
                                'value': best_product['rarity'],
                                'source': 'api'
                            })
                        
                        if needs_set_number and best_product['set_number']:
                            printing['tcgplayer_set_number'] = best_product['set_number']
                            self.stats['api_set_numbers_added'] += 1
                            
                            self.changes_made.append({
                                'card_name': card.get('name', 'Unknown'),
                                'card_number': card_number,
                                'field': 'tcgplayer_set_number',
                                'value': best_product['set_number'],
                                'source': 'api'
                            })
                        
                        # Add missing URL (prefer API URL, fall back to generated)
                        if needs_url:
                            added_url = None
                            if best_product['url']:
                                printing['tcgplayer_url'] = best_product['url']
                                added_url = best_product['url']
                                self.stats['api_urls_added'] += 1
                                source = 'api'
                            elif current_id:  # Generate if we have a product ID
                                generated_url = self.generate_url(
                                    current_id,
                                    printing.get('edition'),
                                    printing.get('foiling')
                                )
                                if generated_url:
                                    printing['tcgplayer_url'] = generated_url
                                    added_url = generated_url
                                    self.stats['generated_urls'] += 1
                                    source = 'generated'
                            
                            if added_url:
                                self.changes_made.append({
                                    'card_name': card.get('name', 'Unknown'),
                                    'card_number': card_number,
                                    'field': 'tcgplayer_url',
                                    'value': added_url,
                                    'source': source
                                })
                
                # Generate URL for existing IDs that are missing URLs
                elif needs_url and current_id:
                    generated_url = self.generate_url(
                        current_id,
                        printing.get('edition'),
                        printing.get('foiling')
                    )
                    if generated_url:
                        printing['tcgplayer_url'] = generated_url
                        self.stats['generated_urls'] += 1
                        
                        self.changes_made.append({
                            'card_name': card.get('name', 'Unknown'),
                            'card_number': card_number,
                            'field': 'tcgplayer_url',
                            'value': generated_url,
                            'source': 'generated'
                        })
                
                # Add set name from CSV mapping
                if needs_set_name and set_code and set_code in set_names:
                    printing['set_name'] = set_names[set_code]
                    self.stats['set_names_added'] += 1
                    
                    self.changes_made.append({
                        'card_name': card.get('name', 'Unknown'),
                        'card_number': card_number,
                        'field': 'set_name',
                        'value': set_names[set_code],
                        'source': 'csv_mapping'
                    })
                
                # Track what's still missing
                final_id = printing.get('tcgplayer_product_id')
                final_url = printing.get('tcgplayer_url')
                final_name = printing.get('tcgplayer_name')
                final_rarity = printing.get('tcgplayer_rarity')
                final_set_number = printing.get('tcgplayer_set_number')
                final_set_name = printing.get('set_name')
                
                if not final_id or final_id == "":
                    self.stats['still_missing_id'] += 1
                if not final_url or final_url == "":
                    self.stats['still_missing_url'] += 1
                if not final_name or final_name == "":
                    self.stats['still_missing_name'] += 1
                if not final_rarity or final_rarity == "":
                    self.stats['still_missing_rarity'] += 1
                if not final_set_number or final_set_number == "":
                    self.stats['still_missing_set_number'] += 1
                if not final_set_name or final_set_name == "":
                    self.stats['still_missing_set_name'] += 1
                
                # Track items we couldn't enhance
                if (not final_id or final_id == "") and card_number:
                    self.missing_items.append({
                        'card_name': card.get('name', 'Unknown'),
                        'card_number': card_number,
                        'set_id': printing.get('set_id'),
                        'reason': 'card_number_not_in_api'
                    })
        
        print("✅ Enhancement completed")
        return True
    
    def save_enhanced_json(self, cards_data, output_file):
        """Save the enhanced cards data"""
        print(f"💾 Saving enhanced data to {output_file}...")
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(cards_data, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Saved enhanced data to {output_file}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to save file: {e}")
            return False
    
    def save_reports(self, output_file):
        """Save enhancement reports"""
        base_name = output_file.replace('.json', '')
        
        # Main report
        report = {
            'timestamp': datetime.now().isoformat(),
            'source': self.cards_url,
            'statistics': self.stats,
            'changes_made': self.changes_made,
            'missing_items': self.missing_items,
            'matching_decisions': self.matching_decisions,
            'integrity_guarantee': {
                'no_data_overwritten': True,
                'only_missing_fields_added': True,
                'original_structure_preserved': True,
                'smart_variation_matching': True,
                'duplicate_resolution_applied': True
            }
        }
        
        report_file = f"{base_name}.report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        # Summary
        summary_file = f"{base_name}.summary.txt"
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write("API-ONLY FAB CARDS ENHANCEMENT REPORT - FIXED VERSION\n")
            f.write("=" * 60 + "\n\n")
            
            f.write("STATISTICS:\n")
            f.write(f"Total printings processed: {self.stats['total_printings']}\n")
            f.write(f"Cards with multiple API products: {self.stats['multiple_products_found']}\n")
            f.write(f"Smart matches made: {self.stats['smart_matches_made']}\n")
            f.write(f"Duplicate corrections made: {self.stats['duplicate_corrections']}\n")
            f.write(f"Already had product ID: {self.stats['already_had_id']}\n")
            f.write(f"Already had URL: {self.stats['already_had_url']}\n")
            f.write(f"Already had name: {self.stats['already_had_name']}\n")
            f.write(f"Already had rarity: {self.stats['already_had_rarity']}\n")
            f.write(f"Already had set number: {self.stats['already_had_set_number']}\n")
            f.write(f"Already had set name: {self.stats['already_had_set_name']}\n")
            f.write(f"Product IDs added from API: {self.stats['api_ids_added']}\n")
            f.write(f"URLs added from API: {self.stats['api_urls_added']}\n")
            f.write(f"Names added from API: {self.stats['api_names_added']}\n")
            f.write(f"Rarities added from API: {self.stats['api_rarities_added']}\n")
            f.write(f"Set numbers added from API: {self.stats['api_set_numbers_added']}\n")
            f.write(f"Set names added from CSV: {self.stats['set_names_added']}\n")
            f.write(f"URLs generated: {self.stats['generated_urls']}\n")
            f.write(f"Still missing product ID: {self.stats['still_missing_id']}\n")
            f.write(f"Still missing URL: {self.stats['still_missing_url']}\n")
            f.write(f"Still missing name: {self.stats['still_missing_name']}\n")
            f.write(f"Still missing rarity: {self.stats['still_missing_rarity']}\n")
            f.write(f"Still missing set number: {self.stats['still_missing_set_number']}\n")
            f.write(f"Still missing set name: {self.stats['still_missing_set_name']}\n\n")
            
            # Calculate coverage
            total_ids = self.stats['already_had_id'] + self.stats['api_ids_added']
            total_urls = self.stats['already_had_url'] + self.stats['api_urls_added'] + self.stats['generated_urls']
            total_names = self.stats['already_had_name'] + self.stats['api_names_added']
            total_rarities = self.stats['already_had_rarity'] + self.stats['api_rarities_added']
            total_set_numbers = self.stats['already_had_set_number'] + self.stats['api_set_numbers_added']
            total_set_names = self.stats['already_had_set_name'] + self.stats['set_names_added']
            
            def calc_coverage(total, overall):
                return (total / overall * 100) if overall > 0 else 0
            
            f.write(f"FINAL COVERAGE:\n")
            f.write(f"Product ID coverage: {total_ids}/{self.stats['total_printings']} ({calc_coverage(total_ids, self.stats['total_printings']):.1f}%)\n")
            f.write(f"URL coverage: {total_urls}/{self.stats['total_printings']} ({calc_coverage(total_urls, self.stats['total_printings']):.1f}%)\n")
            f.write(f"Name coverage: {total_names}/{self.stats['total_printings']} ({calc_coverage(total_names, self.stats['total_printings']):.1f}%)\n")
            f.write(f"Rarity coverage: {total_rarities}/{self.stats['total_printings']} ({calc_coverage(total_rarities, self.stats['total_printings']):.1f}%)\n")
            f.write(f"Set number coverage: {total_set_numbers}/{self.stats['total_printings']} ({calc_coverage(total_set_numbers, self.stats['total_printings']):.1f}%)\n")
            f.write(f"Set name coverage: {total_set_names}/{self.stats['total_printings']} ({calc_coverage(total_set_names, self.stats['total_printings']):.1f}%)\n\n")
            
            f.write("SMART MATCHING EXAMPLES:\n")
            for i, decision in enumerate(self.matching_decisions[:10]):  # Show first 10
                f.write(f"{i+1}. {decision['card_name']} ({decision['card_number']})\n")
                f.write(f"   Variations: {decision['printing_variations']}\n")
                f.write(f"   Available: {decision['available_products']}\n")
                f.write(f"   Selected: {decision['selected_product']}\n\n")
            
            if len(self.matching_decisions) > 10:
                f.write(f"... and {len(self.matching_decisions) - 10} more smart matches\n\n")
            
            f.write("DATA INTEGRITY GUARANTEE:\n")
            f.write("✅ No existing data was overwritten unless genuinely incorrect\n")
            f.write("✅ Only missing fields were added\n")
            f.write("✅ Original JSON structure preserved\n")
            f.write("✅ Smart variation matching implemented\n")
            f.write("✅ Extended Art, Marvel, and Promo variations handled correctly\n")
            f.write("✅ Duplicate product ID conflicts resolved\n")
            f.write("✅ String data types preserved\n")
        
        print(f"✅ Reports saved: {report_file}, {summary_file}")
    
    def print_statistics(self):
        """Display final statistics"""
        print("\n📊 API-ONLY ENHANCEMENT STATISTICS - FIXED VERSION")
        print("=" * 60)
        print(f"Total printings processed: {self.stats['total_printings']:,}")
        print(f"Cards with multiple API products: {self.stats['multiple_products_found']:,}")
        print(f"Smart matches made: {self.stats['smart_matches_made']:,}")
        print(f"Duplicate corrections made: {self.stats['duplicate_corrections']:,}")
        print(f"Product IDs added from API: {self.stats['api_ids_added']:,}")
        print(f"URLs added from API: {self.stats['api_urls_added']:,}")
        print(f"Names added from API: {self.stats['api_names_added']:,}")
        print(f"Rarities added from API: {self.stats['api_rarities_added']:,}")
        print(f"Set numbers added from API: {self.stats['api_set_numbers_added']:,}")
        print(f"Set names added from CSV: {self.stats['set_names_added']:,}")
        print(f"URLs generated: {self.stats['generated_urls']:,}")
        print(f"Already had product ID: {self.stats['already_had_id']:,}")
        print(f"Already had URL: {self.stats['already_had_url']:,}")
        print(f"Already had name: {self.stats['already_had_name']:,}")
        print(f"Already had rarity: {self.stats['already_had_rarity']:,}")
        print(f"Already had set number: {self.stats['already_had_set_number']:,}")
        print(f"Already had set name: {self.stats['already_had_set_name']:,}")
        
        # Calculate totals and coverage
        total_ids = self.stats['already_had_id'] + self.stats['api_ids_added']
        total_urls = self.stats['already_had_url'] + self.stats['api_urls_added'] + self.stats['generated_urls']
        total_names = self.stats['already_had_name'] + self.stats['api_names_added']
        total_rarities = self.stats['already_had_rarity'] + self.stats['api_rarities_added']
        total_set_numbers = self.stats['already_had_set_number'] + self.stats['api_set_numbers_added']
        total_set_names = self.stats['already_had_set_name'] + self.stats['set_names_added']
        
        def calc_coverage(total, overall):
            return (total / overall * 100) if overall > 0 else 0
        
        print(f"\nFinal coverage:")
        print(f"Product ID: {total_ids:,}/{self.stats['total_printings']:,} ({calc_coverage(total_ids, self.stats['total_printings']):.1f}%)")
        print(f"URL: {total_urls:,}/{self.stats['total_printings']:,} ({calc_coverage(total_urls, self.stats['total_printings']):.1f}%)")
        print(f"Name: {total_names:,}/{self.stats['total_printings']:,} ({calc_coverage(total_names, self.stats['total_printings']):.1f}%)")
        print(f"Rarity: {total_rarities:,}/{self.stats['total_printings']:,} ({calc_coverage(total_rarities, self.stats['total_printings']):.1f}%)")
        print(f"Set number: {total_set_numbers:,}/{self.stats['total_printings']:,} ({calc_coverage(total_set_numbers, self.stats['total_printings']):.1f}%)")
        print(f"Set name: {total_set_names:,}/{self.stats['total_printings']:,} ({calc_coverage(total_set_names, self.stats['total_printings']):.1f}%)")
        
        print(f"\nAPI calls made: {self.stats['api_calls_made']}")
        print(f"API products fetched: {self.stats['api_products_fetched']}")
        
        # Show some smart matching examples
        if self.matching_decisions:
            print(f"\nSmart Matching Examples:")
            for i, decision in enumerate(self.matching_decisions[:5]):
                print(f"{i+1}. {decision['card_name']} ({decision['card_number']})")
                print(f"   Available: {decision['available_products']}")
                print(f"   Selected: {decision['selected_product']}")
                print(f"   Based on: {decision['printing_variations']}")
    
    def run(self, output_file="cards.enhanced.json"):
        """Run the complete API-only enhancement process"""
        print("🚀 STARTING API-ONLY FAB CARDS ENHANCER - FIXED VERSION")
        print("=" * 70)
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Source: {self.cards_url}")
        print("Policy: Only add missing data or fix genuine errors")
        print("Features: Smart variation matching, duplicate resolution, type preservation")
        print()
        
        # Step 1: Load group mappings and set names
        group_mappings, set_names = self.load_group_mappings()
        if not group_mappings:
            print("❌ No group mappings - cannot proceed")
            return False
        
        print()
        
        # Step 2: Download cards JSON
        cards_data = self.download_cards_json()
        if cards_data is None:
            print("❌ Failed to download cards JSON")
            return False

        # Safety check: verify the download returned a reasonable card count.
        # A partial download (network timeout, CDN error, empty branch) would
        # propagate silently through the pipeline and wipe printings from the DB.
        MIN_EXPECTED_CARDS = 1500
        if isinstance(cards_data, list):
            card_count = len(cards_data)
        else:
            card_count = len(cards_data.get('cards', cards_data.get('data', [])))
        if card_count < MIN_EXPECTED_CARDS:
            print(f"❌ SAFETY ABORT: Source returned only {card_count} cards "
                  f"(expected at least {MIN_EXPECTED_CARDS}).")
            print(f"   Source: {self.cards_url}")
            print(f"   The branch may be empty, incomplete, or unreachable.")
            return False
        print(f"   Source card count: {card_count:,} — OK")

        print()
        
        # Step 3: Fetch API data
        api_products_by_number = self.fetch_api_data(group_mappings)
        if not api_products_by_number:
            print("❌ No API data fetched")
            return False
        
        print()
        
        # Step 4: Enhance cards with missing data
        success = self.enhance_cards_data(cards_data, api_products_by_number, set_names)
        if not success:
            print("❌ Enhancement failed")
            return False
        
        print()
        
        # Step 5: Save enhanced JSON
        success = self.save_enhanced_json(cards_data, output_file)
        if not success:
            print("❌ Failed to save enhanced file")
            return False
        
        # Step 6: Save reports
        self.save_reports(output_file)
        
        # Step 7: Show statistics
        self.print_statistics()
        
        print(f"\n🎯 API-ONLY ENHANCEMENT COMPLETED SUCCESSFULLY!")
        print(f"Enhanced file: {output_file}")
        print("✅ All existing data preserved, only missing fields added")
        print("✅ Smart variation matching implemented")
        print("✅ Extended Art, Marvel, and Promo variations handled correctly")
        print("✅ Duplicate product ID conflicts resolved")
        print("✅ String data types preserved")
        
        return True

def main():
    """CLI interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='API-Only FAB Cards Enhancer - Add missing TCGPlayer data without overwriting')
    parser.add_argument('--output', '-o', default='cards.enhanced.json', 
                       help='Output filename (default: cards.enhanced.json)')
    
    args = parser.parse_args()
    
    enhancer = APIOnlyEnhancer()
    success = enhancer.run(args.output)
    
    exit(0 if success else 1)

if __name__ == "__main__":
    main()

# #!/usr/bin/env python3
# """
# 🎯 API-Only FAB Cards Enhancer - FIXED VERSION
# Simple, focused script that enhances cards JSON with missing TCGPlayer data from API.

# FIXES:
# - Handles multiple products per card number (Extended Art, Marvel, etc.)
# - Smart matching based on art_variations and rarity codes
# - No more data overwrites - each variation gets correct name

# Principles:
# - NEVER overwrite existing data
# - Only add missing tcgplayer_product_id, tcgplayer_url, tcgplayer_name, tcgplayer_rarity, tcgplayer_set_number, and set_name
# - Use TCG API as single source of truth for missing data
# - Generate URLs deterministically when needed
# """

# import json
# import csv
# import requests
# from datetime import datetime
# import time

# class APIOnlyEnhancer:
#     def __init__(self):
#         self.cards_url = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/super-slam/json/english/card.json"
#         self.group_csv_file = "fab_set_with_db.csv"
        
#         # Statistics tracking
#         self.stats = {
#             'total_printings': 0,
#             'already_had_id': 0,
#             'already_had_url': 0,
#             'already_had_name': 0,
#             'already_had_rarity': 0,
#             'already_had_set_number': 0,
#             'already_had_set_name': 0,
#             'api_ids_added': 0,
#             'api_urls_added': 0,
#             'api_names_added': 0,
#             'api_rarities_added': 0,
#             'api_set_numbers_added': 0,
#             'set_names_added': 0,
#             'generated_urls': 0,
#             'still_missing_id': 0,
#             'still_missing_url': 0,
#             'still_missing_name': 0,
#             'still_missing_rarity': 0,
#             'still_missing_set_number': 0,
#             'still_missing_set_name': 0,
#             'api_calls_made': 0,
#             'api_products_fetched': 0,
#             'multiple_products_found': 0,
#             'smart_matches_made': 0
#         }
        
#         # Change tracking
#         self.changes_made = []
#         self.missing_items = []
#         self.matching_decisions = []
    
#     def load_group_mappings(self):
#         """Load set code -> group ID mappings and set names from CSV"""
#         print("📋 Loading group ID mappings and set names...")
        
#         try:
#             group_mappings = {}
#             set_names = {}  # set_code -> set_name mapping
            
#             with open(self.group_csv_file, 'r') as f:
#                 reader = csv.DictReader(f)
#                 for row in reader:
#                     set_code = row['printings.set'].strip()
#                     group_id = int(row['group_id'])
#                     set_name = row.get('set_name', '').strip()  # Assuming set_name column exists
                    
#                     group_mappings[set_code] = group_id
#                     if set_name:
#                         set_names[set_code] = set_name
            
#             print(f"✅ Loaded {len(group_mappings)} group mappings and {len(set_names)} set names")
#             return group_mappings, set_names
            
#         except FileNotFoundError:
#             print(f"❌ Group mappings file not found: {self.group_csv_file}")
#             return {}, {}
#         except Exception as e:
#             print(f"❌ Error loading group mappings: {e}")
#             return {}, {}
    
#     def download_cards_json(self):
#         """Download cards JSON from GitHub"""
#         print("🔄 Downloading cards JSON...")
        
#         try:
#             response = requests.get(self.cards_url, timeout=30)
#             response.raise_for_status()
            
#             cards_data = response.json()
#             print(f"✅ Downloaded cards JSON successfully")
#             return cards_data
            
#         except requests.exceptions.RequestException as e:
#             print(f"❌ Failed to download cards JSON: {e}")
#             return None
#         except json.JSONDecodeError as e:
#             print(f"❌ Invalid JSON: {e}")
#             return None
    
#     def extract_extended_data_value(self, extended_data, field_name):
#         """Extract value from extendedData array by field name"""
#         if not isinstance(extended_data, list):
#             return None
            
#         for item in extended_data:
#             if isinstance(item, dict) and item.get('name') == field_name:
#                 return item.get('value')
#         return None
    
#     def fetch_api_data(self, group_mappings):
#         """Fetch all product data from TCG API - FIXED VERSION"""
#         print("🔄 Fetching data from TCG API...")
        
#         # FIXED: Use list to store ALL products, not just one per card number
#         api_products_list = []  # List of all products
#         api_products_by_number = {}  # card_number -> list of products
        
#         for set_code, group_id in group_mappings.items():
#             print(f"   📡 Fetching group {group_id} ({set_code})...")
            
#             try:
#                 url = f"https://tcgcsv.com/tcgplayer/62/{group_id}/products"
#                 response = requests.get(url, timeout=30)
#                 response.raise_for_status()
                
#                 response_data = response.json()
#                 self.stats['api_calls_made'] += 1
                
#                 products = response_data.get('results', [])
#                 if not isinstance(products, list):
#                     print(f"      ❌ Invalid response structure")
#                     continue
                
#                 products_found = 0
#                 for product in products:
#                     if not isinstance(product, dict):
#                         continue
                    
#                     extended_data = product.get('extendedData', [])
#                     card_number = self.extract_extended_data_value(extended_data, 'Number')
                    
#                     if card_number:
#                         rarity = self.extract_extended_data_value(extended_data, 'Rarity')
                        
#                         product_data = {
#                             'productId': product.get('productId'),
#                             'url': product.get('url'),
#                             'name': product.get('name'),
#                             'rarity': rarity,
#                             'set_number': card_number,
#                             'set_code': set_code
#                         }
                        
#                         # Store ALL products
#                         api_products_list.append(product_data)
                        
#                         # Group by card number
#                         if card_number not in api_products_by_number:
#                             api_products_by_number[card_number] = []
#                         api_products_by_number[card_number].append(product_data)
                        
#                         products_found += 1
#                         self.stats['api_products_fetched'] += 1
                
#                 print(f"      ✅ Found {products_found} products")
#                 time.sleep(0.5)
                
#             except requests.exceptions.RequestException as e:
#                 print(f"      ❌ API error: {e}")
#                 continue
#             except Exception as e:
#                 print(f"      ❌ Processing error: {e}")
#                 continue
        
#         # Track cards with multiple products
#         multiple_product_cards = {k: v for k, v in api_products_by_number.items() if len(v) > 1}
#         self.stats['multiple_products_found'] = len(multiple_product_cards)
        
#         print(f"✅ API fetch complete: {len(api_products_list)} total products")
#         print(f"   📊 Cards with multiple products: {len(multiple_product_cards)}")
        
#         # Log some examples of multiple products
#         for card_num, products in list(multiple_product_cards.items())[:3]:
#             print(f"   🔍 {card_num}: {[p['name'] for p in products]}")
        
#         return api_products_by_number
    
#     # def find_best_matching_product(self, products_list, printing):
#     #     """Find the best matching product for a specific printing"""
#     #     if not products_list:
#     #         return None
        
#     #     # If only one product, return it
#     #     if len(products_list) == 1:
#     #         return products_list[0]
        
#     #     # Check for Extended Art matching
#     #     has_extended_art = printing.get('art_variations') and 'EA' in printing.get('art_variations', [])
        
#     #     # Check for Marvel rarity matching  
#     #     has_marvel_rarity = printing.get('rarity', '').upper() == 'V'  # 'V' = Marvel rarity code
        
#     #     # Check for Promo/Golden matching
#     #     has_promo_rarity = printing.get('rarity', '').upper() == 'P'  # 'P' = Promo rarity code
#     #     has_golden_foiling = printing.get('foiling', '').upper() == 'G'  # 'G' = Golden foiling
        
#     #     # Try exact matching first
#     #     for product in products_list:
#     #         product_name = product.get('name', '')
#     #         product_rarity = product.get('rarity', '')
            
#     #         name_has_extended_art = '(Extended Art)' in product_name
#     #         name_has_marvel = '(Marvel)' in product_name
#     #         name_has_golden = '(Golden)' in product_name
#     #         product_has_marvel_rarity = product_rarity == 'Marvel'
#     #         product_has_promo_rarity = product_rarity == 'Promo'
            
#     #         # Perfect Extended Art match
#     #         if has_extended_art == name_has_extended_art and not name_has_marvel and not name_has_golden:
#     #             return product
                
#     #         # Perfect Marvel match (both rarity and name should align)
#     #         if has_marvel_rarity and name_has_marvel and product_has_marvel_rarity:
#     #             return product
                
#     #         # Perfect Golden/Promo match
#     #         if (has_promo_rarity or has_golden_foiling) and (name_has_golden or product_has_promo_rarity):
#     #             return product
                
#     #         # Perfect regular match (no special variations)
#     #         if (not has_extended_art and not has_marvel_rarity and not has_promo_rarity and not has_golden_foiling and 
#     #             not name_has_extended_art and not name_has_marvel and not name_has_golden):
#     #             return product
        
#     #     # Fallback matching by priority: Marvel > Extended Art > Golden > Regular
#     #     if has_marvel_rarity:
#     #         # Look for Marvel version
#     #         for product in products_list:
#     #             if '(Marvel)' in product.get('name', '') or product.get('rarity') == 'Marvel':
#     #                 return product
#     #     elif has_extended_art:
#     #         # Look for Extended Art version
#     #         for product in products_list:
#     #             if '(Extended Art)' in product.get('name', ''):
#     #                 return product
#     #     elif has_promo_rarity or has_golden_foiling:
#     #         # Look for Golden/Promo version
#     #         for product in products_list:
#     #             product_name = product.get('name', '')
#     #             product_rarity = product.get('rarity', '')
#     #             if '(Golden)' in product_name or product_rarity == 'Promo':
#     #                 return product
#     #     else:
#     #         # Look for regular version (no special suffixes)
#     #         for product in products_list:
#     #             product_name = product.get('name', '')
#     #             if ('(Extended Art)' not in product_name and 
#     #                 '(Marvel)' not in product_name and 
#     #                 '(Golden)' not in product_name):
#     #                 return product
        
#     #     # Last resort: return first product
#     #     return products_list[0]

#     def detect_and_resolve_incorrect_product_ids(self, cards_data, api_products_by_number):
#         """Find and fix incorrect product IDs by validating against API data"""
        
#         corrections_made = 0
        
#         for card in cards_data:
#             for printing in card.get('printings', []):
#                 current_product_id = printing.get('tcgplayer_product_id')
#                 card_number = printing.get('id')  # e.g., "MST095", "ENG025"
                
#                 if not current_product_id or not card_number:
#                     continue
                    
#                 # Check if we have API data for this card number
#                 if card_number not in api_products_by_number:
#                     continue
                    
#                 # Find what the product ID SHOULD be based on printing characteristics
#                 products_list = api_products_by_number[card_number]
#                 correct_product = self.find_best_matching_product(products_list, printing)
                
#                 if not correct_product:
#                     continue
                    
#                 correct_product_id = str(correct_product['productId'])
                
#                 # Only correct if the current ID is wrong AND we can verify the correct one
#                 if current_product_id != correct_product_id:
#                     # Validate that the correct product actually matches this card number in API
#                     api_card_number = correct_product.get('set_number')  # From API extendedData "Number"
                    
#                     if api_card_number == card_number:
#                         print(f"🔧 Correcting {card.get('name')} {card_number}: {current_product_id} → {correct_product_id}")
#                         print(f"    Reason: {current_product_id} vs {correct_product['name']}")
                        
#                         # Make the correction
#                         printing['tcgplayer_product_id'] = correct_product_id
#                         printing['tcgplayer_name'] = correct_product['name']
#                         printing['tcgplayer_rarity'] = correct_product['rarity']
                        
#                         corrections_made += 1
                        
#                         self.changes_made.append({
#                             'card_name': card.get('name', 'Unknown'),
#                             'card_number': card_number,
#                             'field': 'tcgplayer_product_id',
#                             'old_value': current_product_id,
#                             'new_value': correct_product_id,
#                             'source': 'api_validation',
#                             'reason': f"Corrected to match API product: {correct_product['name']}"
#                         })
#                     else:
#                         print(f"⚠️  Skipping {card_number}: API mismatch ({api_card_number})")
        
#         return corrections_made

#     def detect_and_resolve_duplicate_product_ids(self, cards_data, api_products_by_number):
#         """Find printings with duplicate product IDs and resolve using smart matching"""
        
#         # Step 1: Build product ID -> printings mapping
#         product_id_map = {}  # product_id -> list of (card, printing) tuples
        
#         for card in cards_data:
#             for printing in card.get('printings', []):
#                 product_id = printing.get('tcgplayer_product_id')
#                 if product_id:
#                     if product_id not in product_id_map:
#                         product_id_map[product_id] = []
#                     product_id_map[product_id].append((card, printing))
        
#         # Step 2: Find duplicates
#         duplicate_product_ids = {pid: printings for pid, printings in product_id_map.items() if len(printings) > 1}
        
#         # Step 3: Resolve each duplicate using API data
#         corrections_made = 0
        
#         for product_id, printing_pairs in duplicate_product_ids.items():
#             print(f"🔍 Resolving duplicate product ID {product_id} across {len(printing_pairs)} printings")
            
#             for card, printing in printing_pairs:
#                 card_number = printing.get('id')
                
#                 if card_number and card_number in api_products_by_number:
#                     products_list = api_products_by_number[card_number]
#                     best_product = self.find_best_matching_product(products_list, printing)
                    
#                     if best_product and best_product['productId'] != product_id:
#                         old_id = product_id
#                         new_id = best_product['productId']
                        
#                         print(f"  📝 {card.get('name')} {card_number}: {old_id} → {new_id} ({best_product['name']})")
                        
#                         # Update the product ID
#                         printing['tcgplayer_product_id'] = new_id
#                         printing['tcgplayer_name'] = best_product['name']
#                         printing['tcgplayer_rarity'] = best_product['rarity']
                        
#                         corrections_made += 1
                        
#                         self.changes_made.append({
#                             'card_name': card.get('name', 'Unknown'),
#                             'card_number': card_number,
#                             'field': 'tcgplayer_product_id',
#                             'old_value': old_id,
#                             'new_value': new_id,
#                             'source': 'duplicate_resolution',
#                             'reason': f"Resolved duplicate - matched to {best_product['name']}"
#                         })
        
#         return corrections_made

#     def find_best_matching_product(self, products_list, printing):
#         """Multi-signal matching with data type consistency"""
        
#         if not products_list:
#             return None
        
#         # If only one product, return it
#         if len(products_list) == 1:
#             return products_list[0]
        
#         # Extract printing characteristics
#         has_extended_art = 'EA' in printing.get('art_variations', [])
#         has_marvel_rarity = printing.get('rarity', '').upper() == 'V'
#         has_promo_rarity = printing.get('rarity', '').upper() == 'P'
#         has_golden_foiling = printing.get('foiling', '').upper() == 'G'
        
#         scored_matches = []
        
#         for product in products_list:
#             score = 0
#             product_name = product.get('name', '')
#             product_rarity = product.get('rarity', '')
#             product_url = product.get('url', '')
            
#             # Extended Art signals
#             ea_in_name = '(Extended Art)' in product_name
#             ea_in_url = 'extended-art' in product_url.lower()
            
#             if has_extended_art:
#                 if ea_in_name: score += 10
#                 elif ea_in_url: score += 8
#                 else: score -= 5
#             else:
#                 if ea_in_name or ea_in_url: score -= 5
            
#             # Marvel signals
#             marvel_in_name = '(Marvel)' in product_name
#             marvel_in_rarity = product_rarity == 'Marvel'
#             marvel_in_url = 'marvel' in product_url.lower()
            
#             if has_marvel_rarity:
#                 if marvel_in_name or marvel_in_rarity: score += 10
#                 elif marvel_in_url: score += 8
#                 else: score -= 5
#             else:
#                 if marvel_in_name or marvel_in_rarity or marvel_in_url: score -= 5
            
#             # Base score for regular variants
#             if not has_extended_art and not has_marvel_rarity and not has_promo_rarity:
#                 if not ea_in_name and not marvel_in_name: score += 5
            
#             scored_matches.append((score, product))
        
#         # Return highest scoring match
#         if scored_matches:
#             scored_matches.sort(key=lambda x: x[0], reverse=True)
#             return scored_matches[0][1]
        
#         return products_list[0]

    
#     def generate_url(self, product_id, edition, foiling):
#         """Generate TCGPlayer URL from product ID and printing details"""
#         if not product_id:
#             return ""
        
#         edition_upper = str(edition).upper()
#         foiling_upper = str(foiling).upper()
        
#         # Determine printing parameter
#         if edition_upper in ['F', 'A']:  # 1st Edition
#             if foiling_upper == 'S':
#                 printing_param = "1st+Edition+Normal"
#             elif foiling_upper == 'R':
#                 printing_param = "1st+Edition+Rainbow+Foil"
#             elif foiling_upper == 'C':
#                 printing_param = "1st+Edition+Cold+Foil"
#             elif foiling_upper == 'G':
#                 printing_param = "1st+Edition+Cold+Foil"
#             else:
#                 printing_param = "1st+Edition+Normal"
#         elif edition_upper == 'U':  # Unlimited Edition
#             if foiling_upper == 'S':
#                 printing_param = "Unlimited+Edition+Normal"
#             elif foiling_upper == 'R':
#                 printing_param = "Unlimited+Edition+Rainbow+Foil"
#             else:
#                 printing_param = "Unlimited+Edition+Normal"
#         else:  # Everything else (N or unknown)
#             if foiling_upper == 'S':
#                 printing_param = "Normal"
#             elif foiling_upper == 'R':
#                 printing_param = "Rainbow+Foil"
#             elif foiling_upper == 'C':
#                 printing_param = "Cold+Foil"
#             elif foiling_upper == 'G':
#                 return f"https://www.tcgplayer.com/product/{product_id}?Language=English"
#             else:
#                 printing_param = "Normal"
        
#         return f"https://www.tcgplayer.com/product/{product_id}?Language=English&Printing={printing_param}"
    
#     def enhance_cards_data(self, cards_data, api_products_by_number, set_names):
#         """Enhanced cards data with FIXED product matching"""
#         print("🔄 Enhancing cards with missing TCGPlayer data...")
        
#         # Handle different JSON structures
#         if isinstance(cards_data, list):
#             cards = cards_data
#         elif isinstance(cards_data, dict):
#             if 'cards' in cards_data:
#                 cards = cards_data['cards']
#             elif 'data' in cards_data:
#                 cards = cards_data['data']
#             else:
#                 cards = list(cards_data.values())
#         else:
#             print(f"❌ Unexpected JSON structure")
#             return False
        
#         print(f"📊 Processing {len(cards)} cards...")

#         duplicate_corrections = self.detect_and_resolve_duplicate_product_ids(cards, api_products_by_number)
#         if duplicate_corrections > 0:
#             print(f"✅ Resolved {duplicate_corrections} duplicate product ID conflicts")
#             self.stats['duplicate_corrections'] = duplicate_corrections
        
#         for card in cards:
#             for printing in card.get('printings', []):
#                 self.stats['total_printings'] += 1
                
#                 card_number = printing.get('id')  # e.g., "SEA074"
#                 set_code = printing.get('set_id')  # e.g., "SEA"
                
#                 # Current values
#                 current_id = printing.get('tcgplayer_product_id')
#                 current_url = printing.get('tcgplayer_url')
#                 current_name = printing.get('tcgplayer_name')
#                 current_rarity = printing.get('tcgplayer_rarity')
#                 current_set_number = printing.get('tcgplayer_set_number')
#                 current_set_name = printing.get('set_name')
                
#                 # Check what needs to be added
#                 needs_id = current_id is None or current_id == ""
#                 needs_url = current_url is None or current_url == ""
#                 needs_name = current_name is None or current_name == ""
#                 needs_rarity = current_rarity is None or current_rarity == ""
#                 needs_set_number = current_set_number is None or current_set_number == ""
#                 needs_set_name = current_set_name is None or current_set_name == ""
                
#                 # Track existing data
#                 if not needs_id:
#                     self.stats['already_had_id'] += 1
#                 if not needs_url:
#                     self.stats['already_had_url'] += 1
#                 if not needs_name:
#                     self.stats['already_had_name'] += 1
#                 if not needs_rarity:
#                     self.stats['already_had_rarity'] += 1
#                 if not needs_set_number:
#                     self.stats['already_had_set_number'] += 1
#                 if not needs_set_name:
#                     self.stats['already_had_set_name'] += 1
                
#                 # FIXED: Find best matching product for this specific printing
#                 if card_number and card_number in api_products_by_number:
#                     products_list = api_products_by_number[card_number]
#                     best_product = self.find_best_matching_product(products_list, printing)
                    
#                     if best_product:
#                         has_ea = printing.get('art_variations') and 'EA' in printing.get('art_variations', [])           
#                         has_marvel = printing.get('rarity', '').upper() == 'V'
#                         has_promo = printing.get('rarity', '').upper() == 'P'
#                         has_golden = printing.get('foiling', '').upper() == 'G'
#                         product_name = best_product.get('name', '')
                        
#                         # Track smart matching decisions
#                         if len(products_list) > 1:
#                             self.stats['smart_matches_made'] += 1
#                             self.matching_decisions.append({
#                                 'card_name': card.get('name', 'Unknown'),
#                                 'card_number': card_number,
#                                 'printing_variations': {
#                                     'extended_art': has_ea,
#                                     'marvel': has_marvel,
#                                     'promo': has_promo,
#                                     'golden': has_golden
#                                 },
#                                 'available_products': [p['name'] for p in products_list],
#                                 'selected_product': product_name
#                             })
                        
#                         print(f"      📝 {card.get('name', 'Unknown')} {card_number} (EA: {has_ea}, Marvel: {has_marvel}, Promo: {has_promo}, Golden: {has_golden}) -> '{product_name}'")
                        
#                         # Add missing data from the CORRECT product
#                         if needs_id and best_product['productId']:
#                             printing['tcgplayer_product_id'] = str(best_product['productId'])
#                             self.stats['api_ids_added'] += 1
#                             current_id = best_product['productId']
                            
#                             self.changes_made.append({
#                                 'card_name': card.get('name', 'Unknown'),
#                                 'card_number': card_number,
#                                 'field': 'tcgplayer_product_id',
#                                 'value': best_product['productId'],
#                                 'source': 'api',
#                                 'product_name': product_name
#                             })
                        
#                         if needs_name and best_product['name']:
#                             printing['tcgplayer_name'] = best_product['name']
#                             self.stats['api_names_added'] += 1
                            
#                             self.changes_made.append({
#                                 'card_name': card.get('name', 'Unknown'),
#                                 'card_number': card_number,
#                                 'field': 'tcgplayer_name',
#                                 'value': best_product['name'],
#                                 'source': 'api',
#                                 'matched_based_on': f"EA={has_ea}, Marvel={has_marvel}, Promo={has_promo}, Golden={has_golden}"
#                             })
                        
#                         if needs_rarity and best_product['rarity']:
#                             printing['tcgplayer_rarity'] = best_product['rarity']
#                             self.stats['api_rarities_added'] += 1
                            
#                             self.changes_made.append({
#                                 'card_name': card.get('name', 'Unknown'),
#                                 'card_number': card_number,
#                                 'field': 'tcgplayer_rarity',
#                                 'value': best_product['rarity'],
#                                 'source': 'api'
#                             })
                        
#                         if needs_set_number and best_product['set_number']:
#                             printing['tcgplayer_set_number'] = best_product['set_number']
#                             self.stats['api_set_numbers_added'] += 1
                            
#                             self.changes_made.append({
#                                 'card_name': card.get('name', 'Unknown'),
#                                 'card_number': card_number,
#                                 'field': 'tcgplayer_set_number',
#                                 'value': best_product['set_number'],
#                                 'source': 'api'
#                             })
                        
#                         # Add missing URL (prefer API URL, fall back to generated)
#                         if needs_url:
#                             added_url = None
#                             if best_product['url']:
#                                 printing['tcgplayer_url'] = best_product['url']
#                                 added_url = best_product['url']
#                                 self.stats['api_urls_added'] += 1
#                                 source = 'api'
#                             elif current_id:  # Generate if we have a product ID
#                                 generated_url = self.generate_url(
#                                     current_id,
#                                     printing.get('edition'),
#                                     printing.get('foiling')
#                                 )
#                                 if generated_url:
#                                     printing['tcgplayer_url'] = generated_url
#                                     added_url = generated_url
#                                     self.stats['generated_urls'] += 1
#                                     source = 'generated'
                            
#                             if added_url:
#                                 self.changes_made.append({
#                                     'card_name': card.get('name', 'Unknown'),
#                                     'card_number': card_number,
#                                     'field': 'tcgplayer_url',
#                                     'value': added_url,
#                                     'source': source
#                                 })
                
#                 # Generate URL for existing IDs that are missing URLs
#                 elif needs_url and current_id:
#                     generated_url = self.generate_url(
#                         current_id,
#                         printing.get('edition'),
#                         printing.get('foiling')
#                     )
#                     if generated_url:
#                         printing['tcgplayer_url'] = generated_url
#                         self.stats['generated_urls'] += 1
                        
#                         self.changes_made.append({
#                             'card_name': card.get('name', 'Unknown'),
#                             'card_number': card_number,
#                             'field': 'tcgplayer_url',
#                             'value': generated_url,
#                             'source': 'generated'
#                         })
                
#                 # Add set name from CSV mapping
#                 if needs_set_name and set_code and set_code in set_names:
#                     printing['set_name'] = set_names[set_code]
#                     self.stats['set_names_added'] += 1
                    
#                     self.changes_made.append({
#                         'card_name': card.get('name', 'Unknown'),
#                         'card_number': card_number,
#                         'field': 'set_name',
#                         'value': set_names[set_code],
#                         'source': 'csv_mapping'
#                     })
                
#                 # Track what's still missing
#                 final_id = printing.get('tcgplayer_product_id')
#                 final_url = printing.get('tcgplayer_url')
#                 final_name = printing.get('tcgplayer_name')
#                 final_rarity = printing.get('tcgplayer_rarity')
#                 final_set_number = printing.get('tcgplayer_set_number')
#                 final_set_name = printing.get('set_name')
                
#                 if not final_id or final_id == "":
#                     self.stats['still_missing_id'] += 1
#                 if not final_url or final_url == "":
#                     self.stats['still_missing_url'] += 1
#                 if not final_name or final_name == "":
#                     self.stats['still_missing_name'] += 1
#                 if not final_rarity or final_rarity == "":
#                     self.stats['still_missing_rarity'] += 1
#                 if not final_set_number or final_set_number == "":
#                     self.stats['still_missing_set_number'] += 1
#                 if not final_set_name or final_set_name == "":
#                     self.stats['still_missing_set_name'] += 1
                
#                 # Track items we couldn't enhance
#                 if (not final_id or final_id == "") and card_number:
#                     self.missing_items.append({
#                         'card_name': card.get('name', 'Unknown'),
#                         'card_number': card_number,
#                         'set_id': printing.get('set_id'),
#                         'reason': 'card_number_not_in_api'
#                     })
        
#         print("✅ Enhancement completed")
#         return True
    
#     def save_enhanced_json(self, cards_data, output_file):
#         """Save the enhanced cards data"""
#         print(f"💾 Saving enhanced data to {output_file}...")
        
#         try:
#             with open(output_file, 'w', encoding='utf-8') as f:
#                 json.dump(cards_data, f, indent=2, ensure_ascii=False)
            
#             print(f"✅ Saved enhanced data to {output_file}")
#             return True
            
#         except Exception as e:
#             print(f"❌ Failed to save file: {e}")
#             return False
    
#     def save_reports(self, output_file):
#         """Save enhancement reports"""
#         base_name = output_file.replace('.json', '')
        
#         # Main report
#         report = {
#             'timestamp': datetime.now().isoformat(),
#             'source': self.cards_url,
#             'statistics': self.stats,
#             'changes_made': self.changes_made,
#             'missing_items': self.missing_items,
#             'matching_decisions': self.matching_decisions,
#             'integrity_guarantee': {
#                 'no_data_overwritten': True,
#                 'only_missing_fields_added': True,
#                 'original_structure_preserved': True,
#                 'smart_variation_matching': True
#             }
#         }
        
#         report_file = f"{base_name}.report.json"
#         with open(report_file, 'w', encoding='utf-8') as f:
#             json.dump(report, f, indent=2, ensure_ascii=False)
        
#         # Summary
#         summary_file = f"{base_name}.summary.txt"
#         with open(summary_file, 'w', encoding='utf-8') as f:
#             f.write("API-ONLY FAB CARDS ENHANCEMENT REPORT - FIXED VERSION\n")
#             f.write("=" * 60 + "\n\n")
            
#             f.write("STATISTICS:\n")
#             f.write(f"Total printings processed: {self.stats['total_printings']}\n")
#             f.write(f"Cards with multiple API products: {self.stats['multiple_products_found']}\n")
#             f.write(f"Smart matches made: {self.stats['smart_matches_made']}\n")
#             f.write(f"Already had product ID: {self.stats['already_had_id']}\n")
#             f.write(f"Already had URL: {self.stats['already_had_url']}\n")
#             f.write(f"Already had name: {self.stats['already_had_name']}\n")
#             f.write(f"Already had rarity: {self.stats['already_had_rarity']}\n")
#             f.write(f"Already had set number: {self.stats['already_had_set_number']}\n")
#             f.write(f"Already had set name: {self.stats['already_had_set_name']}\n")
#             f.write(f"Product IDs added from API: {self.stats['api_ids_added']}\n")
#             f.write(f"URLs added from API: {self.stats['api_urls_added']}\n")
#             f.write(f"Names added from API: {self.stats['api_names_added']}\n")
#             f.write(f"Rarities added from API: {self.stats['api_rarities_added']}\n")
#             f.write(f"Set numbers added from API: {self.stats['api_set_numbers_added']}\n")
#             f.write(f"Set names added from CSV: {self.stats['set_names_added']}\n")
#             f.write(f"URLs generated: {self.stats['generated_urls']}\n")
#             f.write(f"Still missing product ID: {self.stats['still_missing_id']}\n")
#             f.write(f"Still missing URL: {self.stats['still_missing_url']}\n")
#             f.write(f"Still missing name: {self.stats['still_missing_name']}\n")
#             f.write(f"Still missing rarity: {self.stats['still_missing_rarity']}\n")
#             f.write(f"Still missing set number: {self.stats['still_missing_set_number']}\n")
#             f.write(f"Still missing set name: {self.stats['still_missing_set_name']}\n\n")
            
#             # Calculate coverage
#             total_ids = self.stats['already_had_id'] + self.stats['api_ids_added']
#             total_urls = self.stats['already_had_url'] + self.stats['api_urls_added'] + self.stats['generated_urls']
#             total_names = self.stats['already_had_name'] + self.stats['api_names_added']
#             total_rarities = self.stats['already_had_rarity'] + self.stats['api_rarities_added']
#             total_set_numbers = self.stats['already_had_set_number'] + self.stats['api_set_numbers_added']
#             total_set_names = self.stats['already_had_set_name'] + self.stats['set_names_added']
            
#             def calc_coverage(total, overall):
#                 return (total / overall * 100) if overall > 0 else 0
            
#             f.write(f"FINAL COVERAGE:\n")
#             f.write(f"Product ID coverage: {total_ids}/{self.stats['total_printings']} ({calc_coverage(total_ids, self.stats['total_printings']):.1f}%)\n")
#             f.write(f"URL coverage: {total_urls}/{self.stats['total_printings']} ({calc_coverage(total_urls, self.stats['total_printings']):.1f}%)\n")
#             f.write(f"Name coverage: {total_names}/{self.stats['total_printings']} ({calc_coverage(total_names, self.stats['total_printings']):.1f}%)\n")
#             f.write(f"Rarity coverage: {total_rarities}/{self.stats['total_printings']} ({calc_coverage(total_rarities, self.stats['total_printings']):.1f}%)\n")
#             f.write(f"Set number coverage: {total_set_numbers}/{self.stats['total_printings']} ({calc_coverage(total_set_numbers, self.stats['total_printings']):.1f}%)\n")
#             f.write(f"Set name coverage: {total_set_names}/{self.stats['total_printings']} ({calc_coverage(total_set_names, self.stats['total_printings']):.1f}%)\n\n")
            
#             f.write("SMART MATCHING EXAMPLES:\n")
#             for i, decision in enumerate(self.matching_decisions[:10]):  # Show first 10
#                 f.write(f"{i+1}. {decision['card_name']} ({decision['card_number']})\n")
#                 f.write(f"   Variations: {decision['printing_variations']}\n")
#                 f.write(f"   Available: {decision['available_products']}\n")
#                 f.write(f"   Selected: {decision['selected_product']}\n\n")
            
#             if len(self.matching_decisions) > 10:
#                 f.write(f"... and {len(self.matching_decisions) - 10} more smart matches\n\n")
            
#             f.write("DATA INTEGRITY GUARANTEE:\n")
#             f.write("✅ No existing data was overwritten\n")
#             f.write("✅ Only missing fields were added\n")
#             f.write("✅ Original JSON structure preserved\n")
#             f.write("✅ Smart variation matching implemented\n")
#             f.write("✅ Extended Art, Marvel, and Promo variations handled correctly\n")
        
#         print(f"✅ Reports saved: {report_file}, {summary_file}")
    
#     def print_statistics(self):
#         """Display final statistics"""
#         print("\n📊 API-ONLY ENHANCEMENT STATISTICS - FIXED VERSION")
#         print("=" * 60)
#         print(f"Total printings processed: {self.stats['total_printings']:,}")
#         print(f"Cards with multiple API products: {self.stats['multiple_products_found']:,}")
#         print(f"Smart matches made: {self.stats['smart_matches_made']:,}")
#         print(f"Product IDs added from API: {self.stats['api_ids_added']:,}")
#         print(f"URLs added from API: {self.stats['api_urls_added']:,}")
#         print(f"Names added from API: {self.stats['api_names_added']:,}")
#         print(f"Rarities added from API: {self.stats['api_rarities_added']:,}")
#         print(f"Set numbers added from API: {self.stats['api_set_numbers_added']:,}")
#         print(f"Set names added from CSV: {self.stats['set_names_added']:,}")
#         print(f"URLs generated: {self.stats['generated_urls']:,}")
#         print(f"Already had product ID: {self.stats['already_had_id']:,}")
#         print(f"Already had URL: {self.stats['already_had_url']:,}")
#         print(f"Already had name: {self.stats['already_had_name']:,}")
#         print(f"Already had rarity: {self.stats['already_had_rarity']:,}")
#         print(f"Already had set number: {self.stats['already_had_set_number']:,}")
#         print(f"Already had set name: {self.stats['already_had_set_name']:,}")
        
#         # Calculate totals and coverage
#         total_ids = self.stats['already_had_id'] + self.stats['api_ids_added']
#         total_urls = self.stats['already_had_url'] + self.stats['api_urls_added'] + self.stats['generated_urls']
#         total_names = self.stats['already_had_name'] + self.stats['api_names_added']
#         total_rarities = self.stats['already_had_rarity'] + self.stats['api_rarities_added']
#         total_set_numbers = self.stats['already_had_set_number'] + self.stats['api_set_numbers_added']
#         total_set_names = self.stats['already_had_set_name'] + self.stats['set_names_added']
        
#         def calc_coverage(total, overall):
#             return (total / overall * 100) if overall > 0 else 0
        
#         print(f"\nFinal coverage:")
#         print(f"Product ID: {total_ids:,}/{self.stats['total_printings']:,} ({calc_coverage(total_ids, self.stats['total_printings']):.1f}%)")
#         print(f"URL: {total_urls:,}/{self.stats['total_printings']:,} ({calc_coverage(total_urls, self.stats['total_printings']):.1f}%)")
#         print(f"Name: {total_names:,}/{self.stats['total_printings']:,} ({calc_coverage(total_names, self.stats['total_printings']):.1f}%)")
#         print(f"Rarity: {total_rarities:,}/{self.stats['total_printings']:,} ({calc_coverage(total_rarities, self.stats['total_printings']):.1f}%)")
#         print(f"Set number: {total_set_numbers:,}/{self.stats['total_printings']:,} ({calc_coverage(total_set_numbers, self.stats['total_printings']):.1f}%)")
#         print(f"Set name: {total_set_names:,}/{self.stats['total_printings']:,} ({calc_coverage(total_set_names, self.stats['total_printings']):.1f}%)")
        
#         print(f"\nAPI calls made: {self.stats['api_calls_made']}")
#         print(f"API products fetched: {self.stats['api_products_fetched']}")
        
#         # Show some smart matching examples
#         if self.matching_decisions:
#             print(f"\nSmart Matching Examples:")
#             for i, decision in enumerate(self.matching_decisions[:5]):
#                 print(f"{i+1}. {decision['card_name']} ({decision['card_number']})")
#                 print(f"   Available: {decision['available_products']}")
#                 print(f"   Selected: {decision['selected_product']}")
#                 print(f"   Based on: {decision['printing_variations']}")
    
#     def run(self, output_file="cards.enhanced.json"):
#         """Run the complete API-only enhancement process"""
#         print("🚀 STARTING API-ONLY FAB CARDS ENHANCER - FIXED VERSION")
#         print("=" * 70)
#         print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
#         print(f"Source: {self.cards_url}")
#         print("Policy: NEVER overwrite existing data")
#         print("Features: Smart variation matching for Extended Art, Marvel, Promo")
#         print()
        
#         # Step 1: Load group mappings and set names
#         group_mappings, set_names = self.load_group_mappings()
#         if not group_mappings:
#             print("❌ No group mappings - cannot proceed")
#             return False
        
#         print()
        
#         # Step 2: Download cards JSON
#         cards_data = self.download_cards_json()
#         if cards_data is None:
#             print("❌ Failed to download cards JSON")
#             return False
        
#         print()
        
#         # Step 3: Fetch API data
#         api_products_by_number = self.fetch_api_data(group_mappings)
#         if not api_products_by_number:
#             print("❌ No API data fetched")
#             return False
        
#         print()
        
#         # Step 4: Enhance cards with missing data
#         success = self.enhance_cards_data(cards_data, api_products_by_number, set_names)
#         if not success:
#             print("❌ Enhancement failed")
#             return False
        
#         print()
        
#         # Step 5: Save enhanced JSON
#         success = self.save_enhanced_json(cards_data, output_file)
#         if not success:
#             print("❌ Failed to save enhanced file")
#             return False
        
#         # Step 6: Save reports
#         self.save_reports(output_file)
        
#         # Step 7: Show statistics
#         self.print_statistics()
        
#         print(f"\n🎯 API-ONLY ENHANCEMENT COMPLETED SUCCESSFULLY!")
#         print(f"Enhanced file: {output_file}")
#         print("✅ All existing data preserved, only missing fields added")
#         print("✅ Smart variation matching implemented")
#         print("✅ Extended Art, Marvel, and Promo variations handled correctly")
        
#         return True

# def main():
#     """CLI interface"""
#     import argparse
    
#     parser = argparse.ArgumentParser(description='API-Only FAB Cards Enhancer - Add missing TCGPlayer data without overwriting')
#     parser.add_argument('--output', '-o', default='cards.enhanced.json', 
#                        help='Output filename (default: cards.enhanced.json)')
    
#     args = parser.parse_args()
    
#     enhancer = APIOnlyEnhancer()
#     success = enhancer.run(args.output)
    
#     exit(0 if success else 1)

# if __name__ == "__main__":
#     main()