#!/usr/bin/env python3
"""
Weekly Cards + Printings Updater for PostgreSQL

Reads printings_collection_seed.json (one JSON object per line — each is a flat
merged card+printing document) and upserts all records into the `cards` and
`printings` PostgreSQL tables.

- Cards are upserted first (printings FK references cards)
- Printings are upserted second
- ON CONFLICT DO UPDATE overwrites all non-PK, non-created_at fields EXCEPT
  the columns in CARD_ADMIN_OWNED_COLS (cc_legal / blitz_legal / silver_age_legal
  / commoner_legal / ll_legal), which are managed via /admin/heroes
- Batch upserts via psycopg2.extras.execute_values (500 rows per batch)
- Reports: unique cards and printings from file, before/after row counts in DB

Usage:
    python3 05_weekly_printings_updater.py --file printings_collection_seed.json --dry-run
    python3 05_weekly_printings_updater.py --file printings_collection_seed.json
    python3 05_weekly_printings_updater.py --file printings_collection_seed.json --production
"""

import json
import traceback
import argparse
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
import os

# ─── Field definitions (must match PostgreSQL column names exactly) ────────────

CARD_FIELDS: List[str] = [
    'card_unique_id', 'name', 'display_name', 'talishar_card_id', 'text', 'searchable_text',
    'type_text', 'type_text_display',
    # Arrays
    'types', 'traits', 'keywords', 'keywords_display', 'abilities', 'classes', 'talents', 'essences',
    # Game stats
    'power', 'power_text', 'cost', 'cost_text', 'defense', 'defense_text',
    'pitch', 'pitch_text', 'health', 'intelligence', 'color', 'played_horizontally',
    # Type flags
    'is_action', 'is_attack', 'is_defense_reaction', 'is_instant',
    'is_equipment', 'is_weapon', 'is_hero', 'is_mentor', 'is_token',
    # Class flags
    'is_generic', 'is_brute', 'is_guardian', 'is_mechanologist', 'is_ranger',
    'is_runeblade', 'is_assassin', 'is_warrior', 'is_ninja', 'is_wizard',
    'is_merchant', 'is_bard', 'is_adjudicator', 'is_illusionist', 'is_thief',
    'is_shapeshifter', 'is_necromancer',
    # Talent flags
    'has_chaos', 'has_light', 'has_royal', 'has_draconic', 'has_lightning',
    'has_shadow', 'has_earth', 'has_mystic', 'has_revered', 'has_ice',
    'has_reviled', 'has_pirate', 'has_elemental',
    # Combination flags
    'is_generic_only', 'has_class_and_talent', 'has_class_only', 'has_talent_only',
    # Format legality
    'blitz_legal', 'cc_legal', 'commoner_legal', 'll_legal', 'silver_age_legal',
    # Banned / suspended
    'blitz_banned', 'cc_banned', 'commoner_banned', 'll_banned',
    'blitz_suspended', 'cc_suspended', 'commoner_suspended', 'll_restricted',
    'silver_age_banned', 'silver_age_suspended',
]

PRINTING_FIELDS: List[str] = [
    'printing_id', 'card_unique_id', 'set_printing_unique_id', 'collector_number',
    'set', 'edition', 'foiling', 'rarity',
    # Edition flags
    'is_first_edition', 'is_unlimited', 'is_normal_edition',
    # Foiling flags
    'is_normal_foil', 'is_rainbow_foil', 'is_cold_foil', 'is_extended_art',
    # Rarity flags
    'is_common', 'is_rare', 'is_super_rare', 'is_majestic', 'is_legendary',
    'is_fabled', 'is_promo',
    # Visual / metadata
    'image_url', 'image_rotation_degrees', 'artists', 'flavor_text', 'art_variations',
    # TCGPlayer
    'tcgplayer_product_id', 'tcgplayer_url', 'tcgplayer_subtype_name',
    # Pricing (weekly seed includes fresh TCGPlayer prices from step 02)
    'tcg_market', 'tcg_low', 'tcg_mid', 'tcg_high', 'has_price', 'price_updated_at',
    # Price category flags
    'is_budget', 'is_under_5', 'is_under_10', 'is_under_25', 'is_under_50',
    'is_under_100', 'is_expensive', 'is_premium',
    # System
    'expansion_slot', 'content_hash',
    # Double-faced card linking
    'other_face_printing_id', 'is_front_face',
]

# Fields from the JSON that do not exist in PostgreSQL (MongoDB-only)
EXCLUDE_FIELDS = {'_id', 'printing_data', 'printing_card_id', 'set_name'}

# Timestamp fields that may arrive as ISO strings from the JSON seed
TIMESTAMP_FIELDS = {'price_updated_at'}

# Boolean NOT NULL fields — default None → False so we never violate constraints
CARD_BOOL_NOT_NULL: frozenset = frozenset([
    'played_horizontally',
    'is_action', 'is_attack', 'is_defense_reaction', 'is_instant',
    'is_equipment', 'is_weapon', 'is_hero', 'is_mentor', 'is_token',
    'is_generic', 'is_brute', 'is_guardian', 'is_mechanologist', 'is_ranger',
    'is_runeblade', 'is_assassin', 'is_warrior', 'is_ninja', 'is_wizard',
    'is_merchant', 'is_bard', 'is_adjudicator', 'is_illusionist', 'is_thief',
    'is_shapeshifter', 'is_necromancer',
    'has_chaos', 'has_light', 'has_royal', 'has_draconic', 'has_lightning',
    'has_shadow', 'has_earth', 'has_mystic', 'has_revered', 'has_ice',
    'has_reviled', 'has_pirate', 'has_elemental',
    'is_generic_only', 'has_class_and_talent', 'has_class_only', 'has_talent_only',
    'blitz_legal', 'cc_legal', 'commoner_legal', 'll_legal', 'silver_age_legal',
    'blitz_banned', 'cc_banned', 'commoner_banned', 'll_banned',
    'blitz_suspended', 'cc_suspended', 'commoner_suspended', 'll_restricted',
    'silver_age_banned', 'silver_age_suspended',
])

PRINTING_BOOL_NOT_NULL: frozenset = frozenset([
    'is_first_edition', 'is_unlimited', 'is_normal_edition',
    'is_normal_foil', 'is_rainbow_foil', 'is_cold_foil', 'is_extended_art',
    'is_common', 'is_rare', 'is_super_rare', 'is_majestic', 'is_legendary',
    'is_fabled', 'is_promo',
    'has_price',
    'is_budget', 'is_under_5', 'is_under_10', 'is_under_25', 'is_under_50',
    'is_under_100', 'is_expensive', 'is_premium',
    'expansion_slot', 'is_front_face',
])

# ─── SQL (built once at module load) ──────────────────────────────────────────

# Columns the admin UI (/admin/heroes) owns. We keep INSERT-ing them so brand-new
# cards still get whatever upstream said on first import, but we never UPDATE
# them on a re-sync — that way manual fixes via the admin page survive the
# weekly run. Upstream legality changes (e.g. an actual ban) must be applied
# through the admin UI now.
CARD_ADMIN_OWNED_COLS = {
    'cc_legal',
    'blitz_legal',
    'silver_age_legal',
    'commoner_legal',
    'll_legal',
}


def _build_card_upsert_sql() -> str:
    col_names = ', '.join(f'"{c}"' for c in CARD_FIELDS)
    update_cols = [
        c for c in CARD_FIELDS
        if c != 'card_unique_id' and c not in CARD_ADMIN_OWNED_COLS
    ]
    update_set = ',\n            '.join(f'"{c}" = EXCLUDED."{c}"' for c in update_cols)
    return f"""
        INSERT INTO cards ({col_names}, created_at, updated_at)
        VALUES %s
        ON CONFLICT (card_unique_id) DO UPDATE SET
            {update_set},
            updated_at = NOW()
    """


def _build_printing_upsert_sql() -> str:
    col_names = ', '.join(f'"{c}"' for c in PRINTING_FIELDS)
    update_cols = [c for c in PRINTING_FIELDS if c != 'printing_id']
    update_set = ',\n            '.join(f'"{c}" = EXCLUDED."{c}"' for c in update_cols)
    return f"""
        INSERT INTO printings ({col_names}, created_at, updated_at)
        VALUES %s
        ON CONFLICT (printing_id) DO UPDATE SET
            {update_set},
            updated_at = NOW()
    """


CARD_UPSERT_SQL = _build_card_upsert_sql()
PRINTING_UPSERT_SQL = _build_printing_upsert_sql()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_timestamp(val) -> Optional[datetime]:
    """Convert an ISO string or datetime to a datetime object (for psycopg2)."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        try:
            # Handle 'Z' suffix
            cleaned = val.replace('Z', '+00:00')
            return datetime.fromisoformat(cleaned)
        except (ValueError, AttributeError):
            return None
    return None


def _extract_card(doc: Dict) -> Optional[Dict]:
    card_id = doc.get('card_unique_id')
    if not card_id:
        return None
    result = {f: doc.get(f) for f in CARD_FIELDS}
    for f in CARD_BOOL_NOT_NULL:
        if result[f] is None:
            result[f] = False
    return result


def _extract_printing(doc: Dict) -> Optional[Dict]:
    printing_id = doc.get('printing_id')
    card_id = doc.get('card_unique_id')
    if not printing_id or not card_id:
        return None
    row = {f: doc.get(f) for f in PRINTING_FIELDS}
    # Convert timestamp strings to datetime objects
    for field in TIMESTAMP_FIELDS:
        if isinstance(row.get(field), str):
            row[field] = _parse_timestamp(row[field])
    # Default NOT NULL boolean fields to False when missing from JSON
    for f in PRINTING_BOOL_NOT_NULL:
        if row[f] is None:
            row[f] = False
    return row


def _to_row(record: Dict, fields: List[str]) -> tuple:
    """Convert a record dict to a tuple matching the given field order."""
    now = datetime.now(timezone.utc)
    return tuple(record.get(f) for f in fields) + (now,)  # appends created_at placeholder


# ─── Main class ───────────────────────────────────────────────────────────────

class WeeklyPrintingsUpdater:
    def __init__(self, use_production: bool = False):
        load_dotenv()

        if use_production:
            print("⚠️  WARNING: Using PRODUCTION database")
            db_url = os.getenv("POSTGRES_URL_PROD")
            env_label = "PRODUCTION"
        else:
            print("🧪 Using STAGING database (safe mode)")
            db_url = os.getenv("POSTGRES_URL_STAGING")
            env_label = "STAGING"

        if not db_url:
            key = "POSTGRES_URL_PROD" if use_production else "POSTGRES_URL_STAGING"
            print(f"❌ ERROR: Missing environment variable {key}")
            exit(1)

        try:
            self.conn = psycopg2.connect(db_url)
            self.conn.autocommit = False
            print(f"✅ PostgreSQL connection successful - {env_label} database")
        except Exception as e:
            print(f"❌ Failed to connect to PostgreSQL: {e}")
            exit(1)

        self.stats = {
            'total_from_file': 0,
            'skipped_invalid': 0,
            'failed_batches': 0,
            'cards_before': 0,
            'cards_after': 0,
            'printings_before': 0,
            'printings_after': 0,
            'printings_deleted': 0,
            'printings_skipped_user_ref': 0,
            'cards_deleted': 0,
        }

    # ── Data loading ──────────────────────────────────────────────────────────

    def _load_json_data(self, file_path: str) -> Tuple[Dict[str, Dict], Dict[str, Dict]]:
        print(f"🔄 Loading source data from {file_path}...")
        cards_map: Dict[str, Dict] = {}
        printings_map: Dict[str, Dict] = {}

        with open(file_path, 'r', encoding='utf-8') as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    doc = json.loads(line)
                    card = _extract_card(doc)
                    printing = _extract_printing(doc)
                    if card and printing:
                        cards_map[card['card_unique_id']] = card
                        printings_map[printing['printing_id']] = printing
                    else:
                        self.stats['skipped_invalid'] += 1
                except json.JSONDecodeError:
                    self.stats['skipped_invalid'] += 1

        self.stats['total_from_file'] = len(printings_map)
        print(
            f"   Loaded {len(cards_map):,} unique cards and "
            f"{len(printings_map):,} printings from source file."
        )
        return cards_map, printings_map

    # ── DB helpers ────────────────────────────────────────────────────────────

    def _get_row_counts(self) -> Tuple[int, int]:
        # Use separate try/catch per table so a missing extension on one table
        # (e.g. pgvector not installed locally) doesn't prevent counting the other.
        card_count = 0
        try:
            with self.conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM cards")
                card_count = cur.fetchone()[0]
        except Exception as e:
            self.conn.rollback()
            print(f"   ⚠️  Could not count cards table (skipping): {e}")

        printing_count = 0
        try:
            with self.conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM printings")
                printing_count = cur.fetchone()[0]
        except Exception as e:
            self.conn.rollback()
            print(f"   ⚠️  Could not count printings table (skipping): {e}")

        return card_count, printing_count

    # ── Batch upserts ─────────────────────────────────────────────────────────

    def _upsert_cards(self, cards: List[Dict], batch_size: int, dry_run: bool):
        total = len(cards)
        total_batches = (total + batch_size - 1) // batch_size
        print(f"\n🔄 Upserting {total:,} cards in {total_batches} batch(es) of {batch_size}...")

        for i in range(0, total, batch_size):
            batch = cards[i:i + batch_size]
            batch_num = i // batch_size + 1
            print(f"   Cards batch {batch_num}/{total_batches} ({len(batch)} rows)...")

            if dry_run:
                continue

            now = datetime.now(timezone.utc)
            # +2: created_at and updated_at appended after CARD_FIELDS
            rows = [tuple(c.get(f) for f in CARD_FIELDS) + (now, now) for c in batch]
            template = "(" + ", ".join(["%s"] * (len(CARD_FIELDS) + 2)) + ")"
            try:
                with self.conn.cursor() as cur:
                    psycopg2.extras.execute_values(
                        cur, CARD_UPSERT_SQL, rows, template=template, page_size=batch_size
                    )
                self.conn.commit()
            except Exception as e:
                self.conn.rollback()
                print(f"   ❌ Cards batch {batch_num} failed: {e}")
                self.stats['failed_batches'] += 1

    def _upsert_printings(self, printings: List[Dict], batch_size: int, dry_run: bool):
        total = len(printings)
        total_batches = (total + batch_size - 1) // batch_size
        print(f"\n🔄 Upserting {total:,} printings in {total_batches} batch(es) of {batch_size}...")

        for i in range(0, total, batch_size):
            batch = printings[i:i + batch_size]
            batch_num = i // batch_size + 1
            print(f"   Printings batch {batch_num}/{total_batches} ({len(batch)} rows)...")

            if dry_run:
                continue

            now = datetime.now(timezone.utc)
            # +2: created_at and updated_at appended after PRINTING_FIELDS
            rows = [tuple(p.get(f) for f in PRINTING_FIELDS) + (now, now) for p in batch]
            template = "(" + ", ".join(["%s"] * (len(PRINTING_FIELDS) + 2)) + ")"
            try:
                with self.conn.cursor() as cur:
                    psycopg2.extras.execute_values(
                        cur, PRINTING_UPSERT_SQL, rows, template=template, page_size=batch_size
                    )
                self.conn.commit()
            except Exception as e:
                self.conn.rollback()
                print(f"   ❌ Printings batch {batch_num} failed: {e}")
                self.stats['failed_batches'] += 1

    # ── Deletion of stale rows ────────────────────────────────────────────────

    def _delete_stale_printings(self, source_ids: set, dry_run: bool):
        """Delete printings no longer in the source, unless a user still holds them."""
        print("\n🧹 Checking for stale printings to remove...")
        try:
            with self.conn.cursor() as cur:
                # Count stale printings referenced by user data (keep these)
                cur.execute("""
                    SELECT COUNT(*) FROM printings
                    WHERE printing_id != ALL(%s)
                      AND (
                        printing_id IN (SELECT printing_id FROM inventory_items)
                        OR printing_id IN (SELECT printing_id FROM wants_items)
                        OR printing_id IN (SELECT printing_id FROM deck_cards)
                      )
                """, (list(source_ids),))
                skipped = cur.fetchone()[0]
                self.stats['printings_skipped_user_ref'] = skipped

                if dry_run:
                    cur.execute("""
                        SELECT COUNT(*) FROM printings
                        WHERE printing_id != ALL(%s)
                          AND printing_id NOT IN (SELECT printing_id FROM inventory_items)
                          AND printing_id NOT IN (SELECT printing_id FROM wants_items)
                          AND printing_id NOT IN (SELECT printing_id FROM deck_cards)
                    """, (list(source_ids),))
                    would_delete = cur.fetchone()[0]
                    print(f"   Would delete {would_delete:,} stale printings "
                          f"({skipped:,} skipped — referenced by user data)")
                    self.stats['printings_deleted'] = would_delete
                    return

                cur.execute("""
                    DELETE FROM printings
                    WHERE printing_id != ALL(%s)
                      AND printing_id NOT IN (SELECT printing_id FROM inventory_items)
                      AND printing_id NOT IN (SELECT printing_id FROM wants_items)
                      AND printing_id NOT IN (SELECT printing_id FROM deck_cards)
                """, (list(source_ids),))
                deleted = cur.rowcount
            self.conn.commit()
            self.stats['printings_deleted'] = deleted
            print(f"   Deleted {deleted:,} stale printings "
                  f"({skipped:,} kept — referenced by user data)")
        except Exception as e:
            self.conn.rollback()
            print(f"   ❌ Stale printing deletion failed: {e}")

    def _delete_stale_cards(self, source_ids: set, dry_run: bool):
        """Delete cards no longer in the source that have no remaining printings."""
        print("\n🧹 Checking for stale cards to remove...")
        try:
            with self.conn.cursor() as cur:
                if dry_run:
                    cur.execute("""
                        SELECT COUNT(*) FROM cards
                        WHERE card_unique_id != ALL(%s)
                          AND card_unique_id NOT IN (
                            SELECT DISTINCT card_unique_id FROM printings
                          )
                    """, (list(source_ids),))
                    would_delete = cur.fetchone()[0]
                    print(f"   Would delete {would_delete:,} stale cards")
                    self.stats['cards_deleted'] = would_delete
                    return

                cur.execute("""
                    DELETE FROM cards
                    WHERE card_unique_id != ALL(%s)
                      AND card_unique_id NOT IN (
                        SELECT DISTINCT card_unique_id FROM printings
                      )
                """, (list(source_ids),))
                deleted = cur.rowcount
            self.conn.commit()
            self.stats['cards_deleted'] = deleted
            print(f"   Deleted {deleted:,} stale cards")
        except Exception as e:
            self.conn.rollback()
            print(f"   ❌ Stale card deletion failed: {e}")

    # ── Main entry ────────────────────────────────────────────────────────────

    def process_updates(
        self,
        json_file_path: str,
        batch_size: int = 500,
        dry_run: bool = False,
    ):
        if dry_run:
            print("\n" + "*" * 50)
            print(" DRY RUN MODE ACTIVATED ".center(50, "*"))
            print("*" * 50 + "\n")

        cards_map, printings_map = self._load_json_data(json_file_path)

        # Capture before-counts (also works in dry-run to show current state)
        self.stats['cards_before'], self.stats['printings_before'] = self._get_row_counts()
        print(
            f"   Current DB: {self.stats['cards_before']:,} cards, "
            f"{self.stats['printings_before']:,} printings"
        )

        card_list = list(cards_map.values())
        printing_list = list(printings_map.values())

        # ── Absolute minimum check ─────────────────────────────────────────────
        # Abort if the source file looks truncated or corrupt. This is a last
        # line of defense — step 01 already checks the GitHub download count,
        # but this catches a corrupted seed file on disk.
        MIN_EXPECTED_PRINTINGS = 10_000
        if len(printing_list) < MIN_EXPECTED_PRINTINGS:
            print(f"\n{'=' * 60}")
            print(" SAFETY ABORT ".center(60, "!"))
            print(f"{'=' * 60}")
            print(f"  Source printings : {len(printing_list):,}")
            print(f"  Minimum expected : {MIN_EXPECTED_PRINTINGS:,}")
            print(f"  The source file appears incomplete or corrupt.")
            print(f"{'=' * 60}\n")
            self.conn.close()
            import sys; sys.exit(1)
        # ──────────────────────────────────────────────────────────────────────

        self._upsert_cards(card_list, batch_size, dry_run)
        self._upsert_printings(printing_list, batch_size, dry_run)

        # ── Sync: remove rows no longer in the source ──────────────────────────
        self._delete_stale_printings(set(printings_map.keys()), dry_run)
        self._delete_stale_cards(set(cards_map.keys()), dry_run)
        # ──────────────────────────────────────────────────────────────────────

        if not dry_run:
            self.stats['cards_after'], self.stats['printings_after'] = self._get_row_counts()

        self._print_summary(dry_run)

        if self.conn and not self.conn.closed:
            self.conn.close()

    def _print_summary(self, dry_run: bool):
        title = "DRY RUN SUMMARY" if dry_run else "EXECUTION COMPLETE"
        print("\n" + "=" * 60)
        print(f" {title} ".center(60, "="))
        print("=" * 60)
        print(f"Total printings in source file:".ljust(45) + f"{self.stats['total_from_file']:,}")
        print(f"Skipped (invalid / missing IDs):".ljust(45) + f"{self.stats['skipped_invalid']:,}")

        if dry_run:
            print(f"Printings would delete (stale):".ljust(45) + f"{self.stats['printings_deleted']:,}")
            print(f"Printings kept (user-referenced):".ljust(45) + f"{self.stats['printings_skipped_user_ref']:,}")
            print(f"Cards would delete (stale):".ljust(45) + f"{self.stats['cards_deleted']:,}")
        else:
            cards_inserted = self.stats['cards_after'] - self.stats['cards_before']
            printings_inserted = self.stats['printings_after'] - self.stats['printings_before']
            print(f"Cards inserted (new):".ljust(45) + f"{max(0, cards_inserted):,}")
            print(f"Cards deleted (stale):".ljust(45) + f"{self.stats['cards_deleted']:,}")
            print(f"Printings inserted (new):".ljust(45) + f"{max(0, printings_inserted):,}")
            print(f"Printings deleted (stale):".ljust(45) + f"{self.stats['printings_deleted']:,}")
            print(f"Printings kept (user-referenced):".ljust(45) + f"{self.stats['printings_skipped_user_ref']:,}")
            print(f"Failed batches:".ljust(45) + f"{self.stats['failed_batches']:,}")
            print(f"DB after:  {self.stats['cards_after']:,} cards, {self.stats['printings_after']:,} printings")
        print("=" * 60)
        print("🎯 Weekly sync for `cards` and `printings` tables complete.")


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Weekly updater: upserts cards + printings into PostgreSQL."
    )
    parser.add_argument('--file', '-f', required=True,
                        help='Path to printings_collection_seed.json')
    parser.add_argument('--batch-size', '-b', type=int, default=500,
                        help='Number of rows per upsert batch (default: 500)')
    parser.add_argument('--force-update', action='store_true',
                        help='Ignored (ON CONFLICT always updates). Kept for CLI compatibility.')
    parser.add_argument('--dry-run', '-d', action='store_true',
                        help='Show what would be done without writing to the DB')
    parser.add_argument('--production', action='store_true',
                        help='Target production DB (default: staging)')
    args = parser.parse_args()

    updater = WeeklyPrintingsUpdater(use_production=args.production)
    try:
        updater.process_updates(
            json_file_path=args.file,
            batch_size=args.batch_size,
            dry_run=args.dry_run,
        )
    except FileNotFoundError:
        print(f"❌ Error: Input file not found at '{args.file}'")
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    main()
