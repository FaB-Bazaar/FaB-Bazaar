#!/usr/bin/env python3
"""
Daily Price Updater for PostgreSQL — `printings` table only

Reads price_update_feed.json (a filtered subset of high-value printings produced
by step 07) and updates price fields on the `printings` table in PostgreSQL.

- Only writes to `printings` — inventory_items prices flow through JOIN
- Compares each price field with 0.01 float tolerance before deciding to update
- Batch updates (500 rows per batch)
- Reports: printings checked, updated, unchanged, not found

Usage:
    python3 08_daily_price_updater.py price_update_feed.json --dry-run
    python3 08_daily_price_updater.py price_update_feed.json --auto-confirm
    python3 08_daily_price_updater.py price_update_feed.json --production
    python3 08_daily_price_updater.py price_update_feed.json --printing-id ABC123 --dry-run
"""

import json
import sys
import time
import traceback
import argparse
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
import os

# ─── Configuration ────────────────────────────────────────────────────────────

BATCH_SIZE = 500

# Price fields compared between the feed and the DB (float, 0.01 tolerance)
PRICE_FLOAT_FIELDS = ('tcg_low', 'tcg_mid', 'tcg_high', 'tcg_market')

# Price category flags — boolean, written alongside price fields
PRICE_CATEGORY_FLAGS = (
    'has_price',
    'is_budget', 'is_under_5', 'is_under_10', 'is_under_25',
    'is_under_50', 'is_under_100', 'is_expensive', 'is_premium',
)

# All fields we UPDATE when a price change is detected
PRICE_UPDATE_FIELDS = PRICE_FLOAT_FIELDS + PRICE_CATEGORY_FLAGS

# Sync-completion marker read by the app (binder "Prices updated X" label via
# PostgresBinderService). Written on EVERY successful run — including runs with
# zero price changes — because per-row price_updated_at only moves on change.
PRICES_LAST_RUN_KEY = 'prices_last_run_at'
RECORD_RUN_SQL = """
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (%(key)s, to_jsonb(NOW()), NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
"""


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _prices_changed(db_row: dict, feed_doc: dict) -> bool:
    """Return True if any price float field differs by more than 0.01."""
    for field in PRICE_FLOAT_FIELDS:
        db_val = db_row.get(field)
        feed_val = feed_doc.get(field)
        if db_val is None and feed_val is None:
            continue
        if db_val is None or feed_val is None:
            return True
        try:
            if abs(float(db_val) - float(feed_val)) > 0.01:
                return True
        except (TypeError, ValueError):
            if db_val != feed_val:
                return True
    return False


def _build_update_payload(feed_doc: dict) -> dict:
    """Build the dict of fields to write when a price change is detected."""
    payload = {f: feed_doc.get(f) for f in PRICE_UPDATE_FIELDS}
    # Boolean category flags are NOT NULL DEFAULT false — never write None
    for flag in PRICE_CATEGORY_FLAGS:
        if payload[flag] is None:
            payload[flag] = False
    return payload


# ─── Main class ───────────────────────────────────────────────────────────────

class DailyPriceUpdater:
    def __init__(self, dry_run: bool = False, use_production: bool = False):
        load_dotenv()
        self.dry_run = dry_run

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
            'processed_from_file': 0,
            'not_found_in_db': 0,
            'updates_prepared': 0,
            'skipped_no_change': 0,
            'updated': 0,
            'failed_batches': 0,
        }

    # ── Data loading ──────────────────────────────────────────────────────────

    def _load_feed(self, input_file: str) -> Dict[str, dict]:
        print(f"🔄 Loading price feed from {input_file}...")
        feed: Dict[str, dict] = {}
        try:
            with open(input_file, 'r', encoding='utf-8') as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    doc = json.loads(line)
                    pid = doc.get('printing_id')
                    if pid:
                        feed[pid] = doc
        except FileNotFoundError:
            print(f"❌ File not found: {input_file}")
            exit(1)
        except json.JSONDecodeError as e:
            print(f"❌ JSON parse error: {e}")
            exit(1)
        print(f"   Loaded {len(feed):,} records from the price feed.")
        return feed

    # ── DB helpers ────────────────────────────────────────────────────────────

    def _fetch_current_prices(self, printing_ids: List[str]) -> Dict[str, dict]:
        """Fetch current price fields from the printings table for the given IDs."""
        if not printing_ids:
            return {}

        price_cols = ', '.join(f'"{f}"' for f in PRICE_FLOAT_FIELDS)
        sql = f"""
            SELECT printing_id, {price_cols}
            FROM printings
            WHERE printing_id = ANY(%s)
        """
        existing: Dict[str, dict] = {}
        try:
            with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql, (printing_ids,))
                for row in cur:
                    existing[row['printing_id']] = dict(row)
        except Exception as e:
            print(f"❌ Error fetching current prices: {e}")
            exit(1)

        print(f"   Found {len(existing):,} matching printings in database.")
        return existing

    def _execute_price_updates(self, updates: List[Tuple[str, dict]]):
        """
        Execute batch UPDATE for printings with changed prices.
        updates: list of (printing_id, payload_dict)
        """
        if not updates:
            return

        # Build SET clause from the price update fields
        set_clause = ", ".join(
            f'"{f}" = %({f})s' for f in PRICE_UPDATE_FIELDS
        )
        sql = f"""
            UPDATE printings
            SET {set_clause}, price_updated_at = NOW(), updated_at = NOW()
            WHERE printing_id = %(printing_id)s
        """

        total = len(updates)
        total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
        total_updated = 0

        for i in range(0, total, BATCH_SIZE):
            batch = updates[i:i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1

            # Print progress bar for large batches
            if total > 1000:
                progress = (i + len(batch)) / total
                bar = '█' * int(40 * progress) + '░' * (40 - int(40 * progress))
                print(f"\r   [{bar}] {progress * 100:5.1f}% ({i + len(batch):,}/{total:,})", end='')
                sys.stdout.flush()
            else:
                print(f"   Price update batch {batch_num}/{total_batches} ({len(batch)} rows)...")

            if self.dry_run:
                continue

            params = [{**payload, 'printing_id': pid} for pid, payload in batch]
            try:
                with self.conn.cursor() as cur:
                    cur.executemany(sql, params)
                    total_updated += cur.rowcount
                self.conn.commit()
            except Exception as e:
                self.conn.rollback()
                print(f"\n   ❌ Price update batch {batch_num} failed: {e}")
                self.stats['failed_batches'] += 1

        if total > 1000:
            print()  # newline after progress bar

        self.stats['updated'] = total_updated

    # ── Main entry ────────────────────────────────────────────────────────────

    def run_updates(self, input_file: str):
        if self.dry_run:
            print("\n" + "*" * 50)
            print(" DRY RUN MODE ACTIVATED ".center(50, "*"))
            print("*" * 50 + "\n")

        start_time = time.time()
        feed = self._load_feed(input_file)
        if not feed:
            print("No printings found in the input file. Exiting.")
            return

        printing_ids = list(feed.keys())
        self.stats['processed_from_file'] = len(printing_ids)

        print("🔍 Fetching current prices from `printings` table...")
        existing = self._fetch_current_prices(printing_ids)

        print("⚖️  Comparing prices and preparing updates...")
        updates: List[Tuple[str, dict]] = []

        for pid, feed_doc in feed.items():
            db_row = existing.get(pid)
            if db_row is None:
                self.stats['not_found_in_db'] += 1
                continue
            if _prices_changed(db_row, feed_doc):
                updates.append((pid, _build_update_payload(feed_doc)))
                self.stats['updates_prepared'] += 1
            else:
                self.stats['skipped_no_change'] += 1

        if not updates:
            print("\n✅ No price changes detected. All printings are up-to-date.")
            self._record_run_timestamp()
            self._print_summary(time.time() - start_time)
            return

        print(f"   {len(updates):,} printings need price updates.")
        self._execute_price_updates(updates)
        self._record_run_timestamp()
        self._print_summary(time.time() - start_time)

        if self.conn and not self.conn.closed:
            self.conn.close()

    def _record_run_timestamp(self):
        """Upsert site_settings.prices_last_run_at = NOW().

        Cosmetic metadata for the UI freshness label — a failure here must
        never fail the run, and the app falls back to MAX(price_updated_at).
        """
        if self.dry_run:
            return
        try:
            with self.conn.cursor() as cur:
                cur.execute(RECORD_RUN_SQL, {'key': PRICES_LAST_RUN_KEY})
            self.conn.commit()
            print(f"🕒 Recorded sync completion in site_settings ('{PRICES_LAST_RUN_KEY}').")
        except Exception as e:
            print(f"⚠️  Failed to record run timestamp (non-fatal): {e}")
            self.conn.rollback()

    def _print_summary(self, duration: float):
        title = "DAILY PRICE DRY RUN SUMMARY" if self.dry_run else "DAILY PRICE UPDATE SUMMARY"
        print("\n" + "=" * 60)
        print(title.center(60))
        print("=" * 60)
        print(f"Records processed from feed:".ljust(45) + f"{self.stats['processed_from_file']:,}")
        print(f"Not found in DB:".ljust(45) + f"{self.stats['not_found_in_db']:,}")
        print(f"Skipped (no price change):".ljust(45) + f"{self.stats['skipped_no_change']:,}")
        print(f"Updates prepared:".ljust(45) + f"{self.stats['updates_prepared']:,}")
        if not self.dry_run:
            print(f"Printings updated:".ljust(45) + f"{self.stats['updated']:,}")
            print(f"Failed batches:".ljust(45) + f"{self.stats['failed_batches']:,}")
        print(f"Total time:".ljust(45) + f"{duration:.2f}s")
        print("=" * 60)
        if not self.dry_run:
            print("🎯 Daily price update for `printings` table complete.")

    # ── Debug mode ────────────────────────────────────────────────────────────

    def debug_single_printing(self, input_file: str, printing_id: str):
        """Show a detailed before/after price comparison for one printing."""
        print("\n" + "=" * 60)
        print(f"🔍 DEBUG MODE: {printing_id}".center(60))
        print("=" * 60)

        feed = self._load_feed(input_file)
        feed_doc = feed.get(printing_id)
        if not feed_doc:
            print(f"❌ '{printing_id}' not found in feed file.")
            return

        existing = self._fetch_current_prices([printing_id])
        db_row = existing.get(printing_id)
        if not db_row:
            print(f"ℹ️  '{printing_id}' not found in `printings` table.")
            return

        print(f"\n{'Field':<25} {'Current (DB)':<20} {'New (feed)':<20} Status")
        print("-" * 75)
        has_changes = False
        for field in PRICE_FLOAT_FIELDS:
            db_val = db_row.get(field)
            feed_val = feed_doc.get(field)
            changed = False
            if db_val is None and feed_val is None:
                pass
            elif db_val is None or feed_val is None:
                changed = True
            else:
                try:
                    changed = abs(float(db_val) - float(feed_val)) > 0.01
                except (TypeError, ValueError):
                    changed = db_val != feed_val
            marker = "🔄 CHANGED" if changed else "  same"
            if changed:
                has_changes = True
            print(f"{field:<25} {str(db_val):<20} {str(feed_val):<20} {marker}")

        if not has_changes:
            print("\n✅ No price changes detected — this printing would be skipped.")
            return

        print(f"\nUpdate payload:")
        payload = _build_update_payload(feed_doc)
        for k, v in sorted(payload.items()):
            print(f"  {k}: {v}")

        if not self.dry_run:
            print("\n" + "!" * 60)
            response = input(f"\nApply this update for '{printing_id}'? (type 'YES' to confirm): ")
            if response == 'YES':
                self._execute_price_updates([(printing_id, payload)])
                print("✅ Update applied.")
            else:
                print("❌ Update cancelled.")


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Daily price updater: updates price fields on the `printings` table.'
    )
    parser.add_argument('input_file', help='Price feed JSON Lines file (price_update_feed.json)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Simulate and show stats without writing to the DB')
    parser.add_argument('--production', action='store_true',
                        help='Target production DB (default: staging)')
    parser.add_argument('--auto-confirm', action='store_true',
                        help='Skip confirmation prompt (for automated pipelines)')
    parser.add_argument('--printing-id', type=str,
                        help='Debug a single printing — shows before/after comparison')
    args = parser.parse_args()

    updater = DailyPriceUpdater(dry_run=args.dry_run, use_production=args.production)

    if args.printing_id:
        updater.debug_single_printing(args.input_file, args.printing_id)
        return

    if not args.dry_run and not args.auto_confirm:
        print("\n" + "!" * 60)
        print(" WARNING: FULL BATCH LIVE UPDATE MODE ".center(60, '!'))
        print("This will update price fields in the `printings` table.".center(60))
        print("!" * 60 + "\n")
        response = input("Are you sure you want to proceed? (type 'YES' to confirm): ")
        if response != 'YES':
            print("Update cancelled.")
            return
    elif not args.dry_run and args.auto_confirm:
        print("🤖 Running in AUTO-CONFIRM mode (no user interaction required)")

    try:
        updater.run_updates(args.input_file)
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    main()
