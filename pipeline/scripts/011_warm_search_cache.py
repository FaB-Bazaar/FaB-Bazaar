#!/usr/bin/env python3
"""
Step 13: warm the app's /opt search cache after the nightly price update.

The price update invalidates every cached search (entries are only served
while no price has changed since they were written), so the first visitor of
each common search would pay the cold query. This asks the app to re-run them:
POST /api/cron/warm-search-cache with the CRON_SECRET bearer. The route picks
the searches (every class/talent, hero class+talent pairs, newest sets, Armory,
GEM) and paces them over --duration-ms itself, so this call blocks for about
that long.

Env: CRON_SECRET (shared .env), APP_INTERNAL_URL (default http://nextjs:3000,
the app's service name on the compose network).
"""

import argparse
import os
import sys

import requests

DEFAULT_BASE_URL = "http://nextjs:3000"
# Headroom over the paced duration for the searches themselves.
TIMEOUT_SLACK_S = 180


def summarize(data):
    lines = [
        f"{data.get('warmed', 0)} warmed, {data.get('alreadyCached', 0)} already cached, "
        f"{len(data.get('failed') or [])} failed of {data.get('targets', 0)} "
        f"in {round((data.get('elapsedMs') or 0) / 1000)}s"
    ]
    for f in data.get("failed") or []:
        lines.append(f"  failed: {f.get('query')} — {f.get('error')}")
    return lines


def run(base_url, secret, duration_ms, post=requests.post):
    if not secret:
        print("❌ CRON_SECRET is not set — cannot call the warm-up route")
        return 1
    url = f"{base_url.rstrip('/')}/api/cron/warm-search-cache"
    try:
        resp = post(
            url,
            headers={"Authorization": f"Bearer {secret}"},
            json={"durationMs": duration_ms},
            timeout=duration_ms / 1000 + TIMEOUT_SLACK_S,
        )
    except requests.RequestException as e:
        print(f"❌ warm-up request failed: {e}")
        return 1
    if resp.status_code != 200:
        print(f"❌ warm-up returned HTTP {resp.status_code}: {resp.text[:200]}")
        return 1
    for line in summarize(resp.json().get("data") or {}):
        print(line)
    return 0


def main():
    parser = argparse.ArgumentParser(description="Warm the /opt search cache")
    parser.add_argument("--duration-ms", type=int, default=120000,
                        help="spread the searches over this many ms (default 120000)")
    args = parser.parse_args()
    return run(
        base_url=os.environ.get("APP_INTERNAL_URL", DEFAULT_BASE_URL),
        secret=os.environ.get("CRON_SECRET", ""),
        duration_ms=args.duration_ms,
    )


if __name__ == "__main__":
    sys.exit(main())
