#!/usr/bin/env python3
"""
Price Snapshot Creator

Reads the full printings seed file and produces a lean price snapshot containing
only the fields needed for price analysis and historical comparison. Also saves a
timestamped copy to price_history/ so that step 11 can compare today's prices
against yesterday's.

Fields kept: printing_id, card_unique_id, name, display_name, image_url,
             rarity, foiling, set, edition, type_text, type_text_display,
             color, collector_number, is_extended_art, has_price,
             tcg_low, tcg_mid, tcg_high, tcg_market, tcgplayer_url,
             created_at, updated_at, price_updated_at

Usage:
    python3 04_price_snapshot_creator.py printings_collection_seed.json --output price_snapshot.json
    python3 04_price_snapshot_creator.py printings_collection_seed.json --dry-run
"""

import json
import argparse
from datetime import datetime
from pathlib import Path

SNAPSHOT_FIELDS = {
    'printing_id', 'card_unique_id', 'set_printing_unique_id', 'name', 'display_name', 'image_url',
    'rarity', 'foiling', 'set', 'edition', 'type_text', 'type_text_display',
    'color', 'is_extended_art', 'has_price',
    'tcg_low', 'tcg_mid', 'tcg_high', 'tcg_market', 'tcgplayer_url',
    'created_at', 'updated_at', 'price_updated_at',
}

HISTORY_DIR = Path("price_history")


class PriceSnapshotCreator:
    def __init__(self):
        self.stats = {
            'total_processed': 0,
            'snapshots_created': 0,
            'skipped_invalid': 0,
            'size_reduction_bytes': 0,
        }

    def _extract_snapshot(self, full_printing: dict) -> dict:
        doc = {f: full_printing[f] for f in SNAPSHOT_FIELDS if f in full_printing}

        # Generate image_url from printing_id
        pid = full_printing.get('printing_id')
        if pid:
            doc['image_url'] = f"http://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/{pid}/public"

        # Map printing_card_id → collector_number
        if 'printing_card_id' in full_printing:
            doc['collector_number'] = full_printing['printing_card_id']

        # Normalise color
        color = full_printing.get('color', '').lower()
        doc['color'] = color if color in ('red', 'blue', 'yellow') else ''

        # Flatten pricing from nested printing_data if not already present
        printing_data = full_printing.get('printing_data', {})
        for f in ('tcg_low', 'tcg_mid', 'tcg_high', 'tcg_market', 'tcgplayer_url'):
            if f not in doc and f in printing_data:
                doc[f] = printing_data[f]

        # Computed flags
        art_variations = full_printing.get('art_variations', []) or []
        doc['is_extended_art'] = 'EA' in art_variations
        doc['has_price'] = bool(doc.get('tcg_market') or doc.get('tcg_low'))

        return doc

    def _save(self, snapshots: list, path: str) -> bool:
        try:
            with open(path, 'w', encoding='utf-8') as fh:
                for snap in snapshots:
                    json.dump(snap, fh, default=str, ensure_ascii=False)
                    fh.write('\n')
            return True
        except Exception as e:
            print(f"Error saving {path}: {e}")
            return False

    def _save_history(self, snapshots: list) -> str:
        HISTORY_DIR.mkdir(exist_ok=True)
        timestamp = int(datetime.now().timestamp())
        history_path = HISTORY_DIR / f"price_snapshot_{timestamp}.json"
        if self._save(snapshots, str(history_path)):
            return str(history_path)
        return None

    def run(self, input_file: str, output_file: str, dry_run: bool = False) -> bool:
        if dry_run:
            print("\n" + "*" * 50)
            print(" DRY RUN MODE ACTIVATED ".center(50, "*"))
            print(" Will process data but not write output files. ".center(50, "*"))
            print("*" * 50 + "\n")

        print(f"Input:  {input_file}")
        if not dry_run:
            print(f"Output: {output_file}")
            print(f"History: {HISTORY_DIR}/price_snapshot_[timestamp].json")
        print()

        if not Path(input_file).exists():
            print(f"❌ Error: Input file not found - {input_file}")
            return False

        # Load (supports both JSON array and JSON Lines)
        print(f"Loading printings from {input_file}...")
        try:
            with open(input_file, 'r', encoding='utf-8') as fh:
                content = fh.read().strip()
            if not content:
                print("Error: Input file is empty.")
                return False
            if content.startswith('['):
                printings = json.loads(content)
            else:
                printings = [json.loads(line) for line in content.splitlines() if line]
        except (json.JSONDecodeError, FileNotFoundError) as e:
            print(f"Error loading input file: {e}")
            return False

        print(f"Loaded {len(printings):,} printings.")

        snapshots = []
        color_stats = {'red': 0, 'blue': 0, 'yellow': 0, '': 0}

        for printing in printings:
            self.stats['total_processed'] += 1
            if not printing.get('printing_id'):
                self.stats['skipped_invalid'] += 1
                continue

            snap = self._extract_snapshot(printing)
            self.stats['size_reduction_bytes'] += (
                len(json.dumps(printing).encode()) - len(json.dumps(snap).encode())
            )
            self.stats['snapshots_created'] += 1
            color_stats[snap.get('color', '')] += 1
            snapshots.append(snap)

            if self.stats['total_processed'] % 5000 == 0:
                print(f"   ... Processed {self.stats['total_processed']:,} printings")

        self._print_stats(dry_run, color_stats)

        if dry_run:
            print("\n✅ Dry run complete.")
            return True

        print(f"\nSaving {len(snapshots):,} price snapshots...")
        if not self._save(snapshots, output_file):
            return False
        print(f"  → Main output: {output_file}")

        history_path = self._save_history(snapshots)
        if history_path:
            print(f"  → History backup: {history_path}")
        else:
            print("  → Warning: Failed to create history backup")

        print(f"\n✅ Price snapshot created successfully.")
        return True

    def _print_stats(self, dry_run: bool, color_stats: dict):
        title = "DRY RUN STATISTICS" if dry_run else "PRICE SNAPSHOT STATISTICS"
        print(f"\n{'=' * 60}")
        print(title)
        print(f"{'=' * 60}")
        print(f"Total printings processed:   {self.stats['total_processed']:,}")
        print(f"Snapshots created:           {self.stats['snapshots_created']:,}")
        print(f"Skipped (missing ID):        {self.stats['skipped_invalid']:,}")

        if self.stats['snapshots_created'] > 0:
            print("\nColor distribution:")
            for color, count in color_stats.items():
                label = 'Colorless' if color == '' else color.capitalize()
                pct = count / self.stats['snapshots_created'] * 100
                print(f"  {label:<10}: {count:>8,}  ({pct:.1f}%)")

        if self.stats['size_reduction_bytes'] > 0:
            mb = self.stats['size_reduction_bytes'] / (1024 * 1024)
            avg_kb = (self.stats['size_reduction_bytes'] / self.stats['snapshots_created']) / 1024
            print(f"\nSize reduction: {mb:.2f} MB total, {avg_kb:.1f} KB avg per printing")


def main():
    parser = argparse.ArgumentParser(
        description='Create a lean price snapshot from the full printings seed file.'
    )
    parser.add_argument('input_file', help='Full printings seed file (printings_collection_seed.json)')
    parser.add_argument('--output', '-o', default='price_snapshot.json',
                        help='Output filename (default: price_snapshot.json)')
    parser.add_argument('--dry-run', '-d', action='store_true',
                        help='Process and show stats without writing files')
    args = parser.parse_args()

    creator = PriceSnapshotCreator()
    success = creator.run(args.input_file, args.output, args.dry_run)
    exit(0 if success else 1)


if __name__ == "__main__":
    main()
