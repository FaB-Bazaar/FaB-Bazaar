#!/usr/bin/env python3
"""
Image Uploader for New Printings

Reads printings_collection_seed.json, identifies printings that don't yet exist
in the database, downloads their source images from fab-cube, and uploads them
to Cloudflare Images using the printing_id as the image ID.

Environment variables (never hardcoded):
  CLOUDFLARE_ACCOUNT_ID  — Cloudflare account ID
  CLOUDFLARE_API_TOKEN   — Cloudflare API token with Images write permission

Usage:
    python3 003b_image_uploader.py printings_collection_seed.json --dry-run
    python3 003b_image_uploader.py printings_collection_seed.json
    python3 003b_image_uploader.py printings_collection_seed.json --production
"""

import json
import argparse
import os
import sys
import time
from typing import Dict, List, Set, Tuple

import requests
import psycopg2
from dotenv import load_dotenv


def load_seed_printings(file_path: str) -> List[Dict]:
    """Load printings from JSONL seed file."""
    printings = []
    with open(file_path, 'r', encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                doc = json.loads(line)
                printing_id = doc.get('printing_id')
                if printing_id:
                    printings.append(doc)
            except json.JSONDecodeError:
                continue
    return printings


def get_existing_printing_ids(conn) -> Set[str]:
    """Query DB for all existing printing_ids."""
    with conn.cursor() as cur:
        cur.execute("SELECT printing_id FROM printings")
        return {row[0] for row in cur.fetchall()}


def get_source_image_url(doc: Dict) -> str:
    """Extract the original fab-cube image URL from a seed document."""
    printing_data = doc.get('printing_data', {})
    # 003 rewrites image_url to the Cloudflare delivery URL and stashes the
    # upstream (fab-cube / LSS) URL in source_image_url. Prefer that; fall
    # back to image_url only for legacy seeds where it still held the source.
    url = printing_data.get('source_image_url') or printing_data.get('image_url', '')

    # Skip if it's already a Cloudflare URL or empty
    if not url or 'imagedelivery.net' in url:
        return ''

    return url


def download_image(url: str, timeout: int = 30) -> bytes:
    """Download an image from a URL. Raises on failure."""
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp.content


def upload_to_cloudflare(image_bytes: bytes, printing_id: str,
                         account_id: str, api_token: str,
                         source_url: str = '') -> Tuple[bool, str]:
    """Upload image to Cloudflare Images with the printing_id as the image ID."""
    cf_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1"

    # Guess content type from source URL
    content_type = 'image/webp'
    if source_url.endswith('.png'):
        content_type = 'image/png'
    elif source_url.endswith('.jpg') or source_url.endswith('.jpeg'):
        content_type = 'image/jpeg'

    files = {
        'file': (f'{printing_id}.webp', image_bytes, content_type),
    }
    data = {
        'id': printing_id,
    }

    resp = requests.post(
        cf_url,
        headers={'Authorization': f'Bearer {api_token}'},
        files=files,
        data=data,
        timeout=60,
    )

    result = resp.json()
    if resp.ok and result.get('success'):
        return True, ''

    errors = result.get('errors', [])
    error_msg = '; '.join(e.get('message', 'unknown') for e in errors) if errors else f'HTTP {resp.status_code}'
    return False, error_msg


def main():
    parser = argparse.ArgumentParser(description='Upload images for new printings to Cloudflare')
    parser.add_argument('input_file', help='Path to printings_collection_seed.json')
    parser.add_argument('--dry-run', action='store_true', help='Report what would be uploaded without actually uploading')
    parser.add_argument('--production', action='store_true', help='Use production database')
    parser.add_argument('--limit', type=int, default=0, help='Max number of images to upload (0 = unlimited)')
    args = parser.parse_args()

    load_dotenv()

    # Validate Cloudflare credentials
    cf_account_id = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')
    cf_api_token = os.environ.get('CLOUDFLARE_API_TOKEN', '')

    if not args.dry_run and (not cf_account_id or not cf_api_token):
        print("❌ Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN environment variables")
        sys.exit(1)

    # Connect to database
    if args.production:
        print("⚠️  Using PRODUCTION database")
        db_url = os.environ.get('POSTGRES_URL_PROD')
    else:
        print("🧪 Using STAGING database")
        db_url = os.environ.get('POSTGRES_URL_STAGING')

    if not db_url:
        key = 'POSTGRES_URL_PROD' if args.production else 'POSTGRES_URL_STAGING'
        print(f"❌ Missing {key} environment variable")
        sys.exit(1)

    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        print("✅ Database connected")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        sys.exit(1)

    # Load seed data
    print(f"🔄 Loading seed data from {args.input_file}...")
    seed_printings = load_seed_printings(args.input_file)
    print(f"   {len(seed_printings)} printings in seed file")

    # Find new printings
    print("🔍 Querying database for existing printings...")
    existing_ids = get_existing_printing_ids(conn)
    print(f"   {len(existing_ids)} printings already in database")
    conn.close()

    new_printings = [p for p in seed_printings if p['printing_id'] not in existing_ids]
    print(f"   {len(new_printings)} new printings to process")

    if not new_printings:
        print("✅ No new printings — nothing to upload")
        return

    # Filter to those with a downloadable source image
    uploadable = []
    for p in new_printings:
        source_url = get_source_image_url(p)
        if source_url:
            uploadable.append((p, source_url))

    print(f"   {len(uploadable)} have downloadable source images")

    if not uploadable:
        print("✅ No source images available for new printings")
        return

    if args.limit > 0:
        uploadable = uploadable[:args.limit]
        print(f"   Limited to {args.limit} uploads")

    # Process uploads
    stats = {'downloaded': 0, 'uploaded': 0, 'skipped': 0, 'failed': 0, 'already_exists': 0}

    for i, (printing, source_url) in enumerate(uploadable, 1):
        pid = printing['printing_id']
        name = printing.get('name', 'unknown')
        set_code = printing.get('set', '?').upper()
        prefix = f"[{i}/{len(uploadable)}] {set_code} {name} ({pid})"

        if args.dry_run:
            print(f"   🏷️  {prefix} — would download from {source_url}")
            stats['skipped'] += 1
            continue

        # Download
        try:
            image_bytes = download_image(source_url)
            stats['downloaded'] += 1
        except Exception as e:
            print(f"   ⚠️  {prefix} — download failed: {e}")
            stats['failed'] += 1
            continue

        # Upload
        success, error = upload_to_cloudflare(
            image_bytes, pid, cf_account_id, cf_api_token, source_url
        )

        if success:
            print(f"   ✅ {prefix}")
            stats['uploaded'] += 1
        elif 'already exists' in error.lower() or 'duplicate' in error.lower():
            print(f"   ⏭️  {prefix} — already exists in Cloudflare")
            stats['already_exists'] += 1
        else:
            print(f"   ❌ {prefix} — upload failed: {error}")
            stats['failed'] += 1

        # Small delay to avoid rate limiting
        time.sleep(0.1)

    # Summary
    print("\n📊 Image Upload Summary:")
    if args.dry_run:
        print(f"   DRY RUN — {stats['skipped']} images would be uploaded")
    else:
        print(f"   Downloaded: {stats['downloaded']}")
        print(f"   Uploaded:   {stats['uploaded']}")
        print(f"   Already existed: {stats['already_exists']}")
        print(f"   Failed:     {stats['failed']}")


if __name__ == '__main__':
    main()
