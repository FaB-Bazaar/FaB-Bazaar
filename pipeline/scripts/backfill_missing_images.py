#!/usr/bin/env python3
"""
One-time backfill: find printings whose Cloudflare image doesn't exist,
download from fab-cube source, and upload to Cloudflare.

Usage:
    # Check a specific set (dry run)
    python3 backfill_missing_images.py --set aha --dry-run

    # Check a specific set (upload for real)
    python3 backfill_missing_images.py --set aha

    # Check ALL printings (dry run first!)
    python3 backfill_missing_images.py --all --dry-run

    # Limit to N uploads
    python3 backfill_missing_images.py --all --limit 50
"""

import argparse
import json
import os
import sys
import time
from typing import List, Tuple

import requests
import psycopg2
from dotenv import load_dotenv

CF_DELIVERY_BASE = "https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg"

# fab-cube card data — source of original image URLs
FAB_CUBE_URL = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/develop/json/english/card.json"


def check_image_exists(printing_id: str) -> bool:
    """HEAD request to Cloudflare to see if the image actually exists."""
    url = f"{CF_DELIVERY_BASE}/{printing_id}/public"
    try:
        resp = requests.head(url, timeout=10, allow_redirects=True)
        return resp.status_code == 200
    except Exception:
        return False


def download_image(url: str) -> bytes:
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def upload_to_cloudflare(image_bytes: bytes, printing_id: str,
                         account_id: str, api_token: str,
                         source_url: str = '',
                         max_retries: int = 3) -> Tuple[bool, str]:
    cf_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1"

    content_type = 'image/webp'
    if source_url.endswith('.png'):
        content_type = 'image/png'
    elif source_url.endswith('.jpg') or source_url.endswith('.jpeg'):
        content_type = 'image/jpeg'

    last_error = ''
    for attempt in range(max_retries):
        try:
            resp = requests.post(
                cf_url,
                headers={'Authorization': f'Bearer {api_token}'},
                files={'file': (f'{printing_id}.webp', image_bytes, content_type)},
                data={'id': printing_id},
                timeout=60,
            )

            result = resp.json()
            if resp.ok and result.get('success'):
                return True, ''

            errors = result.get('errors', [])
            last_error = '; '.join(e.get('message', 'unknown') for e in errors) if errors else f'HTTP {resp.status_code}'
            return False, last_error
        except (requests.exceptions.ConnectionError, requests.exceptions.SSLError) as e:
            last_error = str(e)
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # 1s, 2s backoff
                continue
            return False, f'network error after {max_retries} retries: {last_error}'

    return False, last_error


def load_fab_cube_image_map() -> dict:
    """Download fab-cube card.json and build printing_id → source_image_url map."""
    print("🔄 Downloading fab-cube card data...")
    resp = requests.get(FAB_CUBE_URL, timeout=120)
    resp.raise_for_status()
    cards = resp.json()
    print(f"   {len(cards)} cards loaded from fab-cube")

    image_map = {}
    for card in cards:
        for printing in card.get('printings', []):
            pid = printing.get('unique_id', '')
            img = printing.get('image_url', '')
            if pid and img:
                image_map[pid] = img

    print(f"   {len(image_map)} printing→image mappings built")
    return image_map


def main():
    parser = argparse.ArgumentParser(description='Backfill missing Cloudflare images')
    parser.add_argument('--set', type=str, help='Set code to check (e.g. aha)')
    parser.add_argument('--all', action='store_true', help='Check all printings')
    parser.add_argument('--dry-run', action='store_true', help='Only report, do not upload')
    parser.add_argument('--limit', type=int, default=0, help='Max uploads (0 = unlimited)')
    args = parser.parse_args()

    if not args.set and not args.all:
        print("❌ Specify --set <code> or --all")
        sys.exit(1)

    load_dotenv()

    cf_account_id = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')
    cf_api_token = os.environ.get('CLOUDFLARE_API_TOKEN', '')

    if not args.dry_run and (not cf_account_id or not cf_api_token):
        print("❌ Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN")
        sys.exit(1)

    # Connect to DB
    db_url = os.environ.get('POSTGRES_URL') or os.environ.get('POSTGRES_URL_PROD') or os.environ.get('POSTGRES_URL_STAGING')
    if not db_url:
        print("❌ Missing POSTGRES_URL / POSTGRES_URL_PROD / POSTGRES_URL_STAGING")
        sys.exit(1)

    conn = psycopg2.connect(db_url)

    # Query printings
    with conn.cursor() as cur:
        if args.set:
            cur.execute(
                'SELECT p.printing_id, c.name, p.collector_number, p."set" FROM printings p JOIN cards c ON p.card_unique_id = c.card_unique_id WHERE p."set" = %s ORDER BY p.collector_number',
                (args.set.lower(),)
            )
        else:
            cur.execute('SELECT p.printing_id, c.name, p.collector_number, p."set" FROM printings p JOIN cards c ON p.card_unique_id = c.card_unique_id ORDER BY p."set", p.collector_number')

        rows = cur.fetchall()

    conn.close()
    print(f"📋 {len(rows)} printings to check")

    # Check which images exist on Cloudflare
    print("🔍 Checking Cloudflare for existing images...")
    missing = []
    for i, (pid, name, cn, set_code) in enumerate(rows):
        exists = check_image_exists(pid)
        status = "✅" if exists else "❌"
        if not exists:
            missing.append((pid, name, cn, set_code))
        # Progress every 50
        if (i + 1) % 50 == 0 or i == len(rows) - 1:
            print(f"   Checked {i + 1}/{len(rows)} — {len(missing)} missing so far")
        time.sleep(0.05)  # Be gentle on Cloudflare

    print(f"\n📊 Results: {len(rows)} checked, {len(rows) - len(missing)} exist, {len(missing)} missing")

    if not missing:
        print("✅ All images present!")
        return

    print(f"\n❌ Missing images:")
    for pid, name, cn, set_code in missing:
        print(f"   {set_code.upper()} {cn} — {name} ({pid})")

    if args.dry_run:
        print(f"\n🏷️  DRY RUN — {len(missing)} images would need uploading")
        return

    # Load fab-cube source URLs
    image_map = load_fab_cube_image_map()

    # Upload missing images
    uploadable = []
    for pid, name, cn, set_code in missing:
        source_url = image_map.get(pid, '')
        if source_url:
            uploadable.append((pid, name, cn, set_code, source_url))
        else:
            print(f"   ⚠️  No fab-cube source for {set_code.upper()} {cn} — {name} ({pid})")

    if not uploadable:
        print("❌ No source images available for any missing printings")
        return

    if args.limit > 0:
        uploadable = uploadable[:args.limit]

    print(f"\n🚀 Uploading {len(uploadable)} images...")
    stats = {'uploaded': 0, 'failed': 0, 'already_exists': 0}

    for i, (pid, name, cn, set_code, source_url) in enumerate(uploadable, 1):
        prefix = f"[{i}/{len(uploadable)}] {set_code.upper()} {cn} — {name}"

        try:
            image_bytes = download_image(source_url)
        except Exception as e:
            print(f"   ❌ {prefix} — download failed: {e}")
            stats['failed'] += 1
            continue

        success, error = upload_to_cloudflare(image_bytes, pid, cf_account_id, cf_api_token, source_url)

        if success:
            print(f"   ✅ {prefix}")
            stats['uploaded'] += 1
        elif 'already exists' in error.lower() or 'duplicate' in error.lower():
            print(f"   ⏭️  {prefix} — already in Cloudflare")
            stats['already_exists'] += 1
        else:
            print(f"   ❌ {prefix} — upload failed: {error}")
            stats['failed'] += 1

        time.sleep(0.1)

    print(f"\n📊 Upload Summary:")
    print(f"   Uploaded:        {stats['uploaded']}")
    print(f"   Already existed: {stats['already_exists']}")
    print(f"   Failed:          {stats['failed']}")


if __name__ == '__main__':
    main()
