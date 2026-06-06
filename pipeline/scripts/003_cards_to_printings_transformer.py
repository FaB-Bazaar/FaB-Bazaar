#!/usr/bin/env python3
"""
🎯 Cards to Printings Transformer with Elemental Essence Parsing
Transforms cards JSON with printings arrays into individual printing documents.

Input: Cards JSON with nested printings arrays
Output: Individual printing documents ready for MongoDB import

# Basic usage with your specific file
python cards_to_printings_transformer.py /Users/eko/cards_to_printings/data_prep_for_db/api_enhanced_json/my_enhanced_cards_with_tcg_prices.json

"""

import json
import re
import hashlib
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
# Ban/restriction lists are no longer sourced from the static fab_banned_cards
# module — the banned_cards registry (admin UI + MCP) owns that state now.


# ─── Talishar card identifier ────────────────────────────────────────────────
# Port of lib/talishar/cardId.ts (which itself ports Talishar's
# zzCardCodeGenerator.php). Keep these two implementations in sync — the
# vitest suite at lib/talishar/cardId.test.ts is the source of truth for
# expected behavior.

_TALISHAR_DIACRITICS = str.maketrans({
    'ā': 'a', 'ä': 'a', 'ö': 'o', 'ü': 'u',
    'ß': 's', 'ṣ': 's', 'ð': 'd',
})
_TALISHAR_COMBINING = re.compile(r'[̀-ͯ]')
_TALISHAR_NON_ID = re.compile(r'[^a-z0-9_]')
_TALISHAR_DOUBLE_UNDERSCORE = re.compile(r'__')


def to_talishar_card_id(display_name, pitch):
    if display_name is None:
        return None
    if display_name == 'Goldfin Harpoon':
        return 'goldfin_harpoon_yellow'
    s = display_name.lower()
    s = s.replace('//', '_')
    s = s.translate(_TALISHAR_DIACRITICS)
    s = s.replace('þ', 'th')  # two-char replacement; not expressible in maketrans
    s = unicodedata.normalize('NFD', s)
    s = _TALISHAR_COMBINING.sub('', s)
    s = s.replace(' ', '_').replace('-', '_')
    s = _TALISHAR_NON_ID.sub('', s)
    s = _TALISHAR_DOUBLE_UNDERSCORE.sub('_', s)
    suffix = {1: '_red', 2: '_yellow', 3: '_blue'}.get(pitch, '')
    return s + suffix


class CardsToPrintingsTransformer:
    def __init__(self):
        self.stats = {
            'cards_processed': 0,
            'printings_created': 0,
            'cards_with_no_printings': 0,
            'cards_with_printings': 0,
            'elemental_cards_processed': 0
        }
        
        # Define class and talent sets
        self.CLASSES = {
            'brute', 'guardian', 'mechanologist', 'ranger', 'runeblade', 
            'assassin', 'warrior', 'ninja', 'wizard', 'merchant', 'bard', 
            'adjudicator', 'illusionist', 'thief', 'shapeshifter', 'necromancer',
            'generic'
        }
        
        self.TALENTS = {
            'chaos', 'light', 'royal', 'draconic', 'lightning', 'shadow', 
            'earth', 'mystic', 'revered', 'ice', 'reviled', 'pirate', 'elemental'
        }
        
    def normalize_string(self, value):
        """Normalize strings to lowercase for database consistency"""
        if isinstance(value, str):
            return value.lower().strip()
        return value

    def normalize_array(self, arr):
        """Normalize arrays to lowercase strings"""
        if isinstance(arr, list):
            return [self.normalize_string(item) for item in arr if item]
        elif isinstance(arr, str):
            return [self.normalize_string(arr)]
        return []

    def extract_classes_and_talents(self, types):
        """Extract classes and talents from the types array"""
        if not types:
            return [], []
        
        types_normalized = self.normalize_array(types)
        
        classes = [t for t in types_normalized if t in self.CLASSES]
        talents = [t for t in types_normalized if t in self.TALENTS]
        
        # If no specific class found but has other types, consider it generic
        if not classes and types_normalized:
            # Check if it has non-talent types (like action, attack, etc.)
            non_talent_types = [t for t in types_normalized if t not in self.TALENTS]
            if non_talent_types:
                classes = ['generic']
        
        return classes, talents

    def parse_hero_essences(self, card_data):
        """Parse the essence card pools a HERO grants access to.

        Returns a list of normalized lowercase essence names (e.g. ['earth'],
        ['earth','ice'], ['earth','ice','lightning']) by reading the hero
        card's keywords for the "essence of X[, Y, and Z]" pattern. Returns
        [] for any non-hero card OR any hero card whose keywords don't
        mention essences (Tuffnut, Dorinthea, Aurora Emissary, etc.).

        This is hero-only because non-hero cards can have "essence of X" in
        their card text/keywords (fusion abilities like Channel Lake Frigid)
        without granting hero-level essence pool access.
        """
        types = self.normalize_array(card_data.get('types', []))
        if 'hero' not in types:
            return []

        # Source JSON uses `card_keywords`; the DB column ultimately written
        # is `keywords`, but at this stage we read the source field.
        keywords = card_data.get('card_keywords', []) or []
        if isinstance(keywords, str):
            keywords = [keywords]

        # Upstream sometimes pre-splits a single essence list across multiple
        # array elements — Bravo, Star of the Show ships as
        # ["Essence of Earth", "Ice", "and Lightning"] instead of one joined
        # string. Walk the keywords and merge contiguous non-"essence of"
        # continuations into the preceding essence entry before parsing.
        merged: list[str] = []
        for kw in keywords:
            if not isinstance(kw, str):
                continue
            text = kw.strip().lower()
            if not text:
                continue
            if text.startswith('essence of '):
                merged.append(text)
            elif merged:
                # Continuation of the preceding essence entry — re-join with a
                # comma so the existing parser handles it uniformly.
                merged[-1] = merged[-1] + ', ' + text

        essences: list[str] = []
        for entry in merged:
            remainder = entry[len('essence of '):]
            # Split on commas and "and" tokens — handles "earth", "earth and
            # ice", and "earth, ice, and lightning" uniformly.
            parts = re.split(r',\s*|\s+and\s+', remainder)
            for p in parts:
                name = p.strip()
                # Strip leading "and " for the case after a comma: parts split
                # from "ice, and lightning" yields "and lightning" because the
                # comma already consumed the separator.
                if name.startswith('and '):
                    name = name[4:].strip()
                if name and name not in essences:
                    essences.append(name)

        return essences

    def parse_elemental_essence(self, card_data):
        """Parse elemental essence from any card with elemental talents"""
        essence_flags = {
            'has_earth': False,
            'has_ice': False, 
            'has_lightning': False
        }
        
        # Check if card has any elemental talents
        types = self.normalize_array(card_data.get('types', []))
        has_elemental_talents = any(talent in types for talent in ['ice', 'lightning', 'earth'])
        
        # Only parse essence for cards with elemental talents
        if not has_elemental_talents:
            return essence_flags
        
        # Track that we're processing a card with elemental talents
        self.stats['elemental_cards_processed'] = self.stats.get('elemental_cards_processed', 0) + 1
        
        # For cards with elemental talents, set the flags based on their types
        essence_flags['has_earth'] = 'earth' in types
        essence_flags['has_ice'] = 'ice' in types
        essence_flags['has_lightning'] = 'lightning' in types
        
        # Also parse keywords and text for additional essence patterns (for elemental heroes)
        keywords = card_data.get('keywords', []) or []
        if isinstance(keywords, str):
            keywords = [keywords]
        
        # Look for essence patterns in keywords AND text
        search_text = ' '.join(keywords).lower()
        
        # Also check the card text for essence patterns
        card_text = card_data.get('functional_text_plain', '') or ''
        search_text += ' ' + card_text.lower()
        
        # Parse additional essence patterns (for cards that might have fusion abilities, etc.)
        if any(pattern in search_text for pattern in ['earth fusion', 'essence of earth']):
            essence_flags['has_earth'] = True
        if any(pattern in search_text for pattern in ['ice fusion', 'essence of ice']):
            essence_flags['has_ice'] = True  
        if any(pattern in search_text for pattern in ['lightning fusion', 'essence of lightning']):
            essence_flags['has_lightning'] = True
        
        return essence_flags

    def get_class_talent_flags(self, classes, talents, essence_flags=None):
        """Generate boolean flags for classes and talents"""
        flags = {}
        
        # Class flags
        for class_name in self.CLASSES:
            flags[f'is_{class_name}'] = class_name in classes
        
        # Talent flags  
        for talent_name in self.TALENTS:
            flags[f'has_{talent_name}'] = talent_name in talents
        
        # Override elemental essence flags if provided (only for cards with elemental talents)
        if essence_flags:
            flags['has_earth'] = essence_flags['has_earth']
            flags['has_ice'] = essence_flags['has_ice']
            flags['has_lightning'] = essence_flags['has_lightning']
        
        # Combination flags for easier querying
        flags['is_generic_only'] = len(classes) == 1 and 'generic' in classes and len(talents) == 0
        flags['has_class_and_talent'] = len(classes) > 0 and len(talents) > 0 and not ('generic' in classes and len(classes) == 1)
        flags['has_class_only'] = len(classes) > 0 and len(talents) == 0 and not ('generic' in classes and len(classes) == 1)
        flags['has_talent_only'] = len(classes) <= 1 and 'generic' in classes and len(talents) > 0
        
        return flags



    def parse_numeric_value(self, value):
        """Parse numeric values, returning None for empty/invalid values"""
        if isinstance(value, (int, float)):
            return value
        if isinstance(value, str) and value.strip():
            # Try to extract numbers from string
            numbers = re.findall(r'\d+', value)
            if numbers:
                return int(numbers[0])
        return None

    def parse_price(self, value):
        """Parse price values, returning None for invalid prices"""
        if isinstance(value, (int, float)) and value > 0:
            return float(value)
        if isinstance(value, str):
            try:
                parsed = float(value)
                return parsed if parsed > 0 else None
            except (ValueError, TypeError):
                pass
        return None

    def parse_tcg_product_id(self, value):
        """Parse TCGPlayer product ID as string (as seen in your examples)"""
        if isinstance(value, (int, str)) and value:
            return str(value)
        return None

    def extract_keywords_from_text(self, text):
        """Extract keywords from functional text"""
        if not isinstance(text, str):
            return []
        
        text_lower = text.lower()
        keywords = [
            'go again', 'dominate', 'intimidate', 'overpower', 'crush', 'piercing',
            'ward', 'temper', 'blade break', 'combo', 'reload', 'boost', 'surge',
            'stealth', 'phantasm', 'essence', 'opt', 'reprise', 'specialize',
            'arcane', 'lightning', 'ice', 'earth', 'shadow', 'light', 'nature',
            'freeze', 'frostbite', 'bloodrot', 'burn', 'poison',
            'blood debt', 'once per turn', 'if you have played', 'cost less',
            'draw a card', 'destroy target', 'deal damage', 'gain life',
            'banish', 'exile', 'reveal', 'discard', 'shuffle', 'instant'
        ]
        
        found_keywords = []
        for keyword in keywords:
            if keyword in text_lower:
                found_keywords.append(keyword)
        return found_keywords

    def create_content_hash(self, printing_data):
        """Create a content hash for the printing document (excluding timestamps and MongoDB-specific fields)"""
        # Create a copy without timestamp and MongoDB fields
        hash_data = printing_data.copy()
        hash_data.pop('_id', None)
        hash_data.pop('created_at', None)
        hash_data.pop('price_updated_at', None)
        hash_data.pop('updated_at', None)
        
        # Convert to JSON string and hash
        json_string = json.dumps(hash_data, sort_keys=True)
        return hashlib.sha256(json_string.encode()).hexdigest()

    def create_searchable_text(self, card_data):
        """Create searchable text field combining various card text fields"""
        components = [
            card_data.get('name', ''),
            card_data.get('functional_text_plain', ''),
            ' '.join(card_data.get('types', [])),
            ' '.join(card_data.get('traits', [])),
            ' '.join(card_data.get('card_keywords', [])),
            card_data.get('type_text', '')
        ]
        return ' '.join(filter(None, components)).lower()

    def get_dfc_fields(self, printing):
        """Extract double-faced card linking fields (only for is_DFC: true entries)"""
        dfc_list = printing.get('double_sided_card_info') or []
        dfc_info = dfc_list[0] if dfc_list else {}
        is_dfc = bool(dfc_info.get('is_DFC', False))
        return {
            'other_face_printing_id': dfc_info.get('other_face_unique_id') if is_dfc else None,
            'is_front_face': bool(dfc_info.get('is_front', True)) if is_dfc else True,
        }

    def get_edition_flags(self, edition_code):
        """Get edition flags based on edition code"""
        edition_lower = self.normalize_string(edition_code)
        return {
            'is_first_edition': edition_lower == 'f',     # 'f' = first edition
            'is_unlimited': edition_lower == 'u',         # 'u' = unlimited
            'is_normal_edition': edition_lower == 'n',    # 'n' = normal/no specific edition
        }

    def get_foiling_flags(self, foiling_code):
        """Get foiling flags based on foiling code"""
        foiling_lower = self.normalize_string(foiling_code)
        return {
            'is_normal_foil': foiling_lower == 's',       # 's' = standard/normal foil
            'is_rainbow_foil': foiling_lower == 'r',      # 'r' = rainbow foil
            'is_cold_foil': foiling_lower in ['c', 'g'],  # 'c' = cold foil, 'g' = gold cold foil
        }

    def get_rarity_flags(self, rarity_code):
        """Get rarity flags based on rarity code"""
        rarity_lower = self.normalize_string(rarity_code)
        return {
            'is_common': rarity_lower == 'c',
            'is_rare': rarity_lower == 'r',
            'is_super_rare': rarity_lower == 's',
            'is_majestic': rarity_lower == 'm',
            'is_legendary': rarity_lower == 'l',
            'is_fabled': rarity_lower == 'f',
            'is_promo': rarity_lower == 'p',
        }

    def get_price_flags(self, tcg_market, tcg_mid=None, tcg_low=None):
        """Get price range flags based on TCG market price (fallback to mid if market unavailable)"""
        # Use tcg_market if available, otherwise fall back to tcg_mid
        price = tcg_market if tcg_market is not None else (tcg_mid or 0)

        return {
            'has_price': bool(tcg_market or tcg_low),
            'is_budget': price < 1,
            'is_under_5': price < 5,
            'is_under_10': price < 10,
            'is_under_25': price < 25,
            'is_under_50': price < 50,
            'is_under_100': price < 100,
            'is_expensive': price > 100,
            'is_premium': price > 500,
        }

    def get_card_type_flags(self, types):
        """Get card type flags"""
        types_normalized = self.normalize_array(types)
        return {
            'is_action': 'action' in types_normalized,
            'is_attack': 'attack' in types_normalized,
            'is_defense_reaction': 'defense reaction' in types_normalized,
            'is_instant': 'instant' in types_normalized,
            'is_equipment': 'equipment' in types_normalized,
            'is_weapon': 'weapon' in types_normalized,
            'is_hero': 'hero' in types_normalized,
            'is_mentor': 'mentor' in types_normalized,
            'is_token': 'token' in types_normalized,
        }

    def get_art_flags(self, art_variations):
        """Get art variation flags"""
        art_variations = art_variations or []
        return {
            'is_extended_art': 'EA' in art_variations,
        }

    def transform_card_to_printings(self, card):
        """Transform a single card with printings array into individual printing documents"""
        printings_list = []
        
        # Extract classes and talents from types
        classes, talents = self.extract_classes_and_talents(card.get('types', []))

        # Essences: hero-only pool grants parsed from "essence of X" keywords.
        # Empty for every non-hero card. This is the source of truth used by
        # the app's add-card legality check (PostgresDeckService).
        essences = self.parse_hero_essences(card)

        # Parse elemental essence for any card with elemental talents
        types_normalized = self.normalize_array(card.get('types', []))
        has_elemental_talents = any(talent in types_normalized for talent in ['ice', 'lightning', 'earth'])
        
        if has_elemental_talents:
            essence_flags = self.parse_elemental_essence(card)
            class_talent_flags = self.get_class_talent_flags(classes, talents, essence_flags)
        else:
            # No elemental talents, use standard talent flags
            class_talent_flags = self.get_class_talent_flags(classes, talents)
        
        # Extract base card data
        base_data = {
            'card_unique_id': card.get('unique_id'),
            'name': self.normalize_string(card.get('name', '')),
            'display_name': card.get('name', ''),  # Keep original case for display
            'talishar_card_id': to_talishar_card_id(card.get('name', ''), self.parse_numeric_value(card.get('pitch'))),
            'text': self.normalize_string(card.get('functional_text_plain', '')),
            'type_text': self.normalize_string(card.get('type_text', '')),
            'type_text_display': card.get('type_text', ''),  # Keep original formatting for display
            'types': self.normalize_array(card.get('types', [])),
            'classes': classes,  # Extracted classes
            'talents': talents,  # Extracted talents
            'essences': essences,  # Hero-granted essence pools (empty for non-heroes)
            'traits': self.normalize_array(card.get('traits', [])),
            'keywords': self.normalize_array(card.get('card_keywords', [])),
            # Original-case keywords for display (e.g. "Go Again", "Ward 10").
            # `keywords` is lowercased for search/filter use; `keywords_display` preserves casing.
            'keywords_display': [k.strip() for k in (card.get('card_keywords') or []) if isinstance(k, str) and k.strip()],
            'abilities': self.normalize_array(card.get('abilities_and_effects', [])),
            'power': self.parse_numeric_value(card.get('power')),
            'cost': self.parse_numeric_value(card.get('cost')),
            'defense': self.parse_numeric_value(card.get('defense')),
            'pitch': self.parse_numeric_value(card.get('pitch')),
            'health': self.parse_numeric_value(card.get('health')),
            'intelligence': self.parse_numeric_value(card.get('intelligence')),
            'power_text': str(card.get('power', '')),
            'cost_text': str(card.get('cost', '')),
            'defense_text': str(card.get('defense', '')),
            'pitch_text': str(card.get('pitch', '')),
            'color': self.normalize_string(card.get('color', '')),
            'blitz_legal': bool(card.get('blitz_legal', False)),
            'silver_age_legal': bool(card.get('silver_age_legal', False)),
            'cc_legal': bool(card.get('cc_legal', False)),
            'commoner_legal': bool(card.get('commoner_legal', False)),
            'll_legal': bool(card.get('ll_legal', False)),
            'blitz_banned': bool(card.get('blitz_banned', False)),
            'silver_age_banned': bool(card.get('silver_age_banned', False)),
            'silver_age_suspended': bool(card.get('silver_age_suspended', False)),
            'cc_banned': bool(card.get('cc_banned', False)),
            'commoner_banned': bool(card.get('commoner_banned', False)),
            'll_banned': bool(card.get('ll_banned', False)),
            'blitz_suspended': bool(card.get('blitz_suspended', False)),
            'cc_suspended': bool(card.get('cc_suspended', False)),
            'commoner_suspended': bool(card.get('commoner_suspended', False)),
            'll_restricted': bool(card.get('ll_restricted', False)),
            'searchable_text': self.create_searchable_text(card),
            'played_horizontally': bool(card.get('played_horizontally', False)),
            'created_at': datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]  # MongoDB format
        }

        # Ban/suspend/restrict state is NOT sourced here anymore. The banned_cards
        # registry (admin UI + MCP) is the single source of truth and projects
        # into cards.*_banned/*_suspended/ll_restricted via recomputeCardFlags;
        # step 05 treats those columns as admin-owned and never overwrites them.
        # New cards just keep the upstream JSON default (false) on first insert.

        # Add card type flags
        base_data.update(self.get_card_type_flags(card.get('types', [])))
        
        # Add class and talent flags (with essence override for elemental cards)
        base_data.update(class_talent_flags)
        
        # Process each printing
        printings = card.get('printings', [])
        
        if not printings:
            # Card with no printings - create a base document (though this shouldn't happen with your data)
            self.stats['cards_with_no_printings'] += 1
            # You can decide whether to include cards with no printings or skip them
            return printings_list
        
        self.stats['cards_with_printings'] += 1
        
        for printing in printings:
            # Create a copy of base data for this specific printing
            printing_doc = base_data.copy()

            # --- ADD THIS NEW BLOCK ---
            # Get the printing_id to build the new URL
            printing_id = printing.get('unique_id')
            new_image_url = None
            if printing_id:
                new_image_url = f"https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/{printing_id}/public"
            
            # Normalize printing-specific fields
            set_code = self.normalize_string(printing.get('set_id', ''))
            edition_code = self.normalize_string(printing.get('edition', ''))
            foiling_code = self.normalize_string(printing.get('foiling', ''))
            rarity_code = self.normalize_string(printing.get('rarity', ''))
            
            # Parse price data
            tcg_low = self.parse_price(printing.get('tcg_low'))
            tcg_mid = self.parse_price(printing.get('tcg_mid'))
            tcg_high = self.parse_price(printing.get('tcg_high'))
            tcg_market = self.parse_price(printing.get('tcg_market'))
            
            # Add printing-specific data
            printing_doc.update({
                # Printing identifiers
                'printing_id': printing.get('unique_id'),
                'printing_card_id': printing.get('id'),
                'collector_number': printing.get('id'),
                'set_printing_unique_id': printing.get('set_printing_unique_id'),

                # TCGPlayer fields
                'tcgplayer_product_id': printing.get('tcgplayer_product_id'),
                'tcgplayer_url': printing.get('tcgplayer_url'),
                'tcgplayer_subtype_name': printing.get('tcgplayer_subTypeName'),
                
                # Set name from CSV if available
                'set_name': printing.get('set_name', ''),
                
                # Printing attributes (normalized)
                'set': set_code,
                'edition': edition_code,
                'foiling': foiling_code, 
                'rarity': rarity_code,
                'artists': self.normalize_array(printing.get('artists', [])),
                
                # Price data
                'tcg_low': tcg_low,
                'tcg_mid': tcg_mid,
                'tcg_high': tcg_high,
                'tcg_market': tcg_market,
                
                # Edition, foiling, rarity, and art flags
                **self.get_edition_flags(edition_code),
                **self.get_foiling_flags(foiling_code),
                **self.get_rarity_flags(rarity_code),
                **self.get_art_flags(printing.get('art_variations', [])),
                **self.get_price_flags(tcg_market, tcg_mid, tcg_low),
                
                # Double-faced card info
                **self.get_dfc_fields(printing),

                # Language: this pipeline only handles English from the GitHub
                # source. Non-English printings are created/maintained by
                # scripts/import-i18n.ts and are excluded from this pipeline's
                # stale-row DELETE (see _delete_stale_printings in step 05).
                'language': 'en',

                # Other printing data
                'expansion_slot': bool(printing.get('expansion_slot', False)),
                'flavor_text': self.normalize_string(printing.get('flavor_text_plain', '')),
                'image_url': new_image_url or printing.get('image_url', ''),
                'image_rotation_degrees': printing.get('image_rotation_degrees', 0),
                'art_variations': printing.get('art_variations', []),
                
                # Set name from CSV if available
                'set_name': printing.get('set_name', ''),
                
                # Store original printing data for reference (frontend code depends on this)
                'printing_data': {
                    **printing,  # Include all original printing data
                    'printing_id': printing.get('unique_id')  # Add printing_id for convenience
                },
                
                # Timestamps (using current time as placeholder - you can adjust this)
                'price_updated_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
            })

            if new_image_url:
                printing_doc['printing_data']['image_url'] = new_image_url
            
            # Create content hash
            printing_doc['content_hash'] = self.create_content_hash(printing_doc)
            
            printings_list.append(printing_doc)
            self.stats['printings_created'] += 1
        
        return printings_list

    def transform_cards_to_printings(self, input_file, output_file):
        """Transform the entire cards JSON to individual printings"""
        print(f"🔄 Loading cards from {input_file}...")
        
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                cards_data = json.load(f)
        except Exception as e:
            print(f"❌ Error loading input file: {e}")
            return False
        
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
            print("❌ Unexpected JSON structure")
            return False
        
        print(f"📊 Processing {len(cards)} cards...")
        
        all_printings = []
        
        for i, card in enumerate(cards):
            if i % 1000 == 0 and i > 0:
                print(f"   Processed {i}/{len(cards)} cards...")
            
            self.stats['cards_processed'] += 1
            card_printings = self.transform_card_to_printings(card)
            all_printings.extend(card_printings)
        
        print(f"💾 Saving {len(all_printings)} printings to {output_file}...")
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                # Save as JSON Lines format (one JSON object per line) for easier MongoDB import
                for printing in all_printings:
                    json.dump(printing, f, default=str, ensure_ascii=False)
                    f.write('\n')
            
            print(f"✅ Successfully saved {len(all_printings)} printings")
            return True
            
        except Exception as e:
            print(f"❌ Error saving output file: {e}")
            return False

    def print_statistics(self):
        """Print transformation statistics"""
        print("\n📊 TRANSFORMATION STATISTICS")
        print("=" * 50)
        print(f"Cards processed: {self.stats['cards_processed']:,}")
        print(f"Cards with printings: {self.stats['cards_with_printings']:,}")
        print(f"Cards with no printings: {self.stats['cards_with_no_printings']:,}")
        print(f"Total printings created: {self.stats['printings_created']:,}")
        print(f"Elemental cards processed: {self.stats['elemental_cards_processed']:,}")
        
        if self.stats['cards_with_printings'] > 0:
            avg_printings = self.stats['printings_created'] / self.stats['cards_with_printings']
            print(f"Average printings per card: {avg_printings:.2f}")

    def run(self, input_file, output_file=None):
        """Run the complete transformation process"""
        print("🚀 STARTING CARDS TO PRINTINGS TRANSFORMATION")
        print("=" * 60)
        print(f"Input: {input_file}")
        
        # Generate default output filename if not provided
        if not output_file:
            output_file = "printings_collection_seed.json"
        
        print(f"Output: {output_file}")
        print()
        
        # Check if input file exists
        if not Path(input_file).exists():
            print(f"❌ Input file not found: {input_file}")
            return False
        
        # Transform the data
        success = self.transform_cards_to_printings(input_file, output_file)
        
        if success:
            # Print statistics
            self.print_statistics()
            
            print(f"\n🎯 TRANSFORMATION COMPLETED SUCCESSFULLY!")
            print(f"Output file: {output_file}")
            print("✅ Ready for MongoDB import using mongoimport")
            print(f"\n📝 To import into MongoDB:")
            print(f"   mongoimport --db your_db --collection printings --file {output_file}")
            
            return True
        else:
            print("\n❌ Transformation failed")
            return False

def main():
    """CLI interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Transform cards JSON with printings arrays into individual printing documents')
    parser.add_argument('input', help='Input cards JSON file')
    parser.add_argument('--output', '-o', help='Output printings JSON file (default: input_printings.json)')
    
    args = parser.parse_args()
    
    transformer = CardsToPrintingsTransformer()
    success = transformer.run(args.input, args.output)
    
    exit(0 if success else 1)

if __name__ == "__main__":
    main()