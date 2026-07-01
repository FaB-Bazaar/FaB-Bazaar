#!/usr/bin/env python3
"""
Backfill missing Cloudflare images: find printings with no stored image, pull
the source art from fab-cube, upload to Cloudflare under the printing_id, and
set printings.has_cloudflare_image = true.

DETECTION (cost note): we enumerate STORED images via the Cloudflare Images
LIST API (api.cloudflare.com/.../images/v2). That is an API call, not a
delivery, so it incurs no per-image delivery charge. We do NOT HEAD/GET the
imagedelivery.net URL per printing (that hits the billed delivery path). See
audit_cloudflare_images.py for the same rationale — this script is the "fix"
counterpart to that "audit".

MATCHING: a printing has a real image iff its printing_id is in the stored-id
set. Source art is matched by fab-cube `unique_id` == printing_id (see
003_cards_to_printings_transformer.py:509).

Usage:
    # Check a specific set (dry run — no uploads, no writes)
    python3 backfill_missing_images.py --set gem --dry-run

    # Upload for real against production
    python3 backfill_missing_images.py --set gem --production

    # All sets, limited to N uploads
    python3 backfill_missing_images.py --all --production --limit 50
"""

import argparse
import os
import sys
import time
from typing import Tuple

import requests
import psycopg2
from dotenv import load_dotenv

# fab-cube card data — source of original image URLs.
# KEEP IN SYNC with the active branch in 001_api_only_enhancer.py (cards_url).
# The pipeline tracks the upcoming set's branch until it merges to develop.
FAB_CUBE_URL = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/refs/heads/develop/json/english/card.json"


def list_stored_image_ids(account_id: str, api_token: str) -> set:
    """All stored Cloudflare image IDs via the v2 list API (no delivery charge)."""
    base = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v2"
    headers = {"Authorization": f"Bearer {api_token}"}
    ids: set = set()
    continuation_token = None
    pages = 0
    while True:
        params = {"per_page": 1000}
        if continuation_token:
            params["continuation_token"] = continuation_token
        resp = requests.get(base, headers=headers, params=params, timeout=60)
        data = resp.json()
        if not (resp.ok and data.get("success")):
            errs = data.get("errors", [])
            msg = "; ".join(e.get("message", "unknown") for e in errs) if errs else f"HTTP {resp.status_code}"
            raise RuntimeError(f"Cloudflare list API failed: {msg}")
        images = data["result"]["images"]
        ids.update(img["id"] for img in images)
        pages += 1
        continuation_token = data["result"].get("continuation_token")
        if not images or not continuation_token:
            break
    print(f"   {len(ids):,} stored Cloudflare image IDs ({pages} pages)")
    return ids


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
    """Download fab-cube card.json and build printing_id (unique_id) → source_image_url."""
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
    parser.add_argument('--set', type=str, help='Set code to check (e.g. gem)')
    parser.add_argument('--all', action='store_true', help='Check all printings')
    parser.add_argument('--dry-run', action='store_true', help='Only report, do not upload or write')
    parser.add_argument('--production', action='store_true', help='Use production DB (POSTGRES_URL_PROD)')
    parser.add_argument('--limit', type=int, default=0, help='Max uploads (0 = unlimited)')
    args = parser.parse_args()

    if not args.set and not args.all:
        print("❌ Specify --set <code> or --all")
        sys.exit(1)

    # load_dotenv() helps local runs; it inspects the caller frame and raises
    # when the script is piped via `python3 -` (stdin). In the container the env
    # is already populated, so failing to find a .env file is harmless.
    try:
        load_dotenv()
    except Exception:
        pass

    # Cloudflare creds are required even for --dry-run: detection uses the list API.
    cf_account_id = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')
    cf_api_token = os.environ.get('CLOUDFLARE_API_TOKEN', '')
    if not cf_account_id or not cf_api_token:
        print("❌ Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN")
        sys.exit(1)

    if args.production:
        print("⚠️  Using PRODUCTION database")
        db_url = os.environ.get('POSTGRES_URL_PROD')
    else:
        print("🧪 Using STAGING database")
        db_url = os.environ.get('POSTGRES_URL_STAGING')
    db_url = db_url or os.environ.get('POSTGRES_URL')
    if not db_url:
        key = 'POSTGRES_URL_PROD' if args.production else 'POSTGRES_URL_STAGING'
        print(f"❌ Missing {key} (and no POSTGRES_URL fallback)")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    conn.autocommit = True

    # Query printings (id, name, collector#, set)
    with conn.cursor() as cur:
        if args.set:
            cur.execute(
                'SELECT p.printing_id, c.name, p.collector_number, p."set" '
                'FROM printings p JOIN cards c ON p.card_unique_id = c.card_unique_id '
                'WHERE p."set" = %s ORDER BY p.collector_number',
                (args.set.lower(),),
            )
        else:
            cur.execute(
                'SELECT p.printing_id, c.name, p.collector_number, p."set" '
                'FROM printings p JOIN cards c ON p.card_unique_id = c.card_unique_id '
                'ORDER BY p."set", p.collector_number'
            )
        rows = cur.fetchall()
    print(f"📋 {len(rows)} printings to check")

    # Detect missing via the cost-free list API.
    print("🔍 Listing stored Cloudflare images...")
    stored = list_stored_image_ids(cf_account_id, cf_api_token)
    missing = [(pid, name, cn, set_code) for (pid, name, cn, set_code) in rows if pid not in stored]

    print(f"\n📊 Results: {len(rows)} checked, {len(rows) - len(missing)} exist, {len(missing)} missing")
    if not missing:
        print("✅ All images present!")
        conn.close()
        return

    print("\n❌ Missing images:")
    for pid, name, cn, set_code in missing:
        print(f"   {(set_code or '?').upper()} {cn or ''} — {name} ({pid})")

    if args.dry_run:
        print(f"\n🏷️  DRY RUN — {len(missing)} images would need uploading")
        conn.close()
        return

    # Load fab-cube source URLs and filter to those we can actually fetch.
    image_map = load_fab_cube_image_map()
    uploadable = []
    for pid, name, cn, set_code in missing:
        source_url = image_map.get(pid, '')
        if source_url:
            uploadable.append((pid, name, cn, set_code, source_url))
        else:
            print(f"   ⚠️  No fab-cube source for {(set_code or '?').upper()} {cn or ''} — {name} ({pid})")

    if not uploadable:
        print("❌ No source images available for any missing printings")
        conn.close()
        return

    if args.limit > 0:
        uploadable = uploadable[:args.limit]

    print(f"\n🚀 Uploading {len(uploadable)} images...")
    stats = {'uploaded': 0, 'failed': 0, 'already_exists': 0}

    for i, (pid, name, cn, set_code, source_url) in enumerate(uploadable, 1):
        prefix = f"[{i}/{len(uploadable)}] {(set_code or '?').upper()} {cn or ''} — {name}"
        try:
            image_bytes = download_image(source_url)
        except Exception as e:
            print(f"   ❌ {prefix} — download failed: {e}")
            stats['failed'] += 1
            continue

        success, error = upload_to_cloudflare(image_bytes, pid, cf_account_id, cf_api_token, source_url)

        if success or 'already exists' in error.lower() or 'duplicate' in error.lower():
            # Image is now present in Cloudflare — record it.
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE printings SET has_cloudflare_image = true WHERE printing_id = %s",
                    (pid,),
                )
            if success:
                print(f"   ✅ {prefix}")
                stats['uploaded'] += 1
            else:
                print(f"   ⏭️  {prefix} — already in Cloudflare")
                stats['already_exists'] += 1
        else:
            print(f"   ❌ {prefix} — upload failed: {error}")
            stats['failed'] += 1

        time.sleep(0.1)

    conn.close()
    print("\n📊 Upload Summary:")
    print(f"   Uploaded:        {stats['uploaded']}")
    print(f"   Already existed: {stats['already_exists']}")
    print(f"   Failed:          {stats['failed']}")
    print("   (has_cloudflare_image set true for uploaded/existing printings)")


if __name__ == '__main__':
    main()
