#!/usr/bin/env python3
"""
Audit which printings actually have a Cloudflare image, and persist the result
to printings.has_cloudflare_image.

WHY THIS EXISTS / COST NOTE:
  The obvious "does this image exist?" check — a HEAD/GET against
  imagedelivery.net/<hash>/<printing_id>/public — hits the Cloudflare *delivery*
  path, which is billed per "image delivered". Doing that for ~16k printings on
  a schedule is wasteful.

  Instead we enumerate what's STORED via the Cloudflare Images LIST API
  (api.cloudflare.com/.../images/v2). List/stats calls are NOT delivery events,
  so this audit costs nothing in delivery usage. We pull the full set of stored
  image IDs once, diff against all printing_ids, and write the boolean column.

  printing_id == fab-cube `unique_id` and == the Cloudflare image id we upload
  under (see 003_cards_to_printings_transformer.py and 003b_image_uploader.py),
  so a printing has a real image iff its printing_id is in the stored-id set.

USAGE:
    # Report only — no DB writes (safe first run)
    python3 audit_cloudflare_images.py --dry-run

    # Refresh the column on staging (default) / production
    python3 audit_cloudflare_images.py
    python3 audit_cloudflare_images.py --production

    # Dump the full missing list (set / collector# / name / printing_id)
    python3 audit_cloudflare_images.py --dry-run --show-missing
"""

import argparse
import os
import sys

import requests
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv


def list_stored_image_ids(account_id: str, api_token: str) -> set:
    """Enumerate all stored Cloudflare image IDs via the v2 list API.

    Paginates with continuation_token. This is an API call, not a delivery —
    no per-image delivery charge is incurred.
    """
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


def main():
    parser = argparse.ArgumentParser(description="Audit Cloudflare image presence and update printings.has_cloudflare_image")
    parser.add_argument("--dry-run", action="store_true", help="Report only; do not write the column")
    parser.add_argument("--production", action="store_true", help="Use production DB (POSTGRES_URL_PROD)")
    parser.add_argument("--show-missing", action="store_true", help="Print the full list of printings missing an image")
    args = parser.parse_args()

    # load_dotenv() helps local runs; it inspects the caller frame and raises
    # when the script is piped via `python3 -` (stdin). In the container the env
    # is already populated, so failing to find a .env file is harmless.
    try:
        load_dotenv()
    except Exception:
        pass

    cf_account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    cf_api_token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    if not cf_account_id or not cf_api_token:
        print("❌ Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN")
        sys.exit(1)

    if args.production:
        print("⚠️  Using PRODUCTION database")
        db_url = os.environ.get("POSTGRES_URL_PROD")
    else:
        print("🧪 Using STAGING database")
        db_url = os.environ.get("POSTGRES_URL_STAGING")
    # Fallback for environments that only expose a single POSTGRES_URL.
    db_url = db_url or os.environ.get("POSTGRES_URL")
    if not db_url:
        key = "POSTGRES_URL_PROD" if args.production else "POSTGRES_URL_STAGING"
        print(f"❌ Missing {key} (and no POSTGRES_URL fallback)")
        sys.exit(1)

    # 1. Enumerate stored Cloudflare images (cost-free).
    print("🔄 Listing stored Cloudflare images...")
    stored = list_stored_image_ids(cf_account_id, cf_api_token)

    # 2. Load all printing_ids.
    conn = psycopg2.connect(db_url)
    with conn.cursor() as cur:
        cur.execute("SELECT printing_id FROM printings")
        printing_ids = [r[0] for r in cur.fetchall()]
    total = len(printing_ids)
    print(f"📋 {total:,} printings in DB")

    present = [pid for pid in printing_ids if pid in stored]
    missing = [pid for pid in printing_ids if pid not in stored]
    print(f"📊 with image: {len(present):,}  |  missing: {len(missing):,}")

    # 3. Optionally show the missing list (joins cards for a human label).
    if args.show_missing and missing:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT p."set", p.collector_number, c.name, p.printing_id
                FROM printings p
                JOIN cards c ON p.card_unique_id = c.card_unique_id
                WHERE p.printing_id = ANY(%s)
                ORDER BY p."set", p.collector_number
                """,
                (missing,),
            )
            print("\n--- printings missing an image ---")
            for set_code, cn, name, pid in cur.fetchall():
                print(f"   {(set_code or '?').upper()} {cn or ''} — {name} ({pid})")
            print()

    if args.dry_run:
        print(f"🏷️  DRY RUN — would set has_cloudflare_image=true for {len(present):,} "
              f"and false for {len(missing):,} printings. No DB changes made.")
        conn.close()
        return

    # 4. Refresh the column. Use a temp table of present ids and only write rows
    #    whose flag actually changes (keeps the UPDATE small on steady-state runs).
    with conn.cursor() as cur:
        cur.execute("CREATE TEMP TABLE tmp_present (id text PRIMARY KEY) ON COMMIT DROP")
        if present:
            execute_values(cur, "INSERT INTO tmp_present (id) VALUES %s ON CONFLICT DO NOTHING",
                           [(pid,) for pid in present])
        cur.execute(
            """
            UPDATE printings SET has_cloudflare_image = true
            WHERE printing_id IN (SELECT id FROM tmp_present)
              AND has_cloudflare_image = false
            """
        )
        flipped_true = cur.rowcount
        cur.execute(
            """
            UPDATE printings SET has_cloudflare_image = false
            WHERE printing_id NOT IN (SELECT id FROM tmp_present)
              AND has_cloudflare_image = true
            """
        )
        flipped_false = cur.rowcount
    conn.commit()
    conn.close()

    print(f"✅ Updated column — flipped {flipped_true:,} → true, {flipped_false:,} → false")
    print(f"   Now {len(missing):,} printings have has_cloudflare_image = false")


if __name__ == "__main__":
    main()
