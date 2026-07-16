# CLAUDE.md - Pipeline

Nightly data pipeline (`scripts/daily_pipeline.sh`, cron 23:00 UTC → `--production`).
Runs in the `fabbazaar-pipeline` container. See root CLAUDE.md "Data Architecture".

## Gotchas

- **Card source branch gets deleted on set release** — `001_api_only_enhancer.py`
  `cards_url` should track the-fab-cube's `develop` branch. Upcoming-set branches
  (e.g. `omens-of-the-third-age`) are temporary; fab-cube deletes them at launch,
  step 01 then 404s, and `set -e` silently kills the whole run before the Discord
  poster (step 12). Keep `backfill_missing_images.py` `FAB_CUBE_URL` in sync.

- **Poster can silently post nothing** — step 12's skip guard
  (`008_discord_market_poster.py`) bails if gainers==0 AND decliners==0. A missing
  snapshot day used to blank those (the day-over-day diff had no "yesterday").
  Movers now anchor "yesterday" to `max(snapshot_date) < today`, not calendar day-1,
  so a one-night gap widens the window instead of blanking it (`010_compute_movers.py`).

- **Movers guard against junk listings** — signals key off `tcg_low` (single cheapest
  listing), which placeholder/fat-finger listings distort ($30k rares, $189k Briar).
  `SANE_LOW` rejects rows where `tcg_low > 5x tcg_market` (500%, a ratio not dollars).

- **Deploy may skip the pipeline rebuild** — `deploy.yml` only rebuilds
  `python-pipeline` when `pipeline/` changed AND the VPS has ≥600 MB free RAM.
  A pipeline code change under memory pressure won't reach prod — check the deploy log.

- **006 records `site_settings.prices_last_run_at`** on every successful run
  (even zero-change runs) — the binder "Prices updated X" label reads it
  (fallback: `MAX(price_updated_at)`, which only moves on price CHANGES and
  reads misleadingly fresh/stale). Non-fatal on failure; don't remove the write.

- **Pipeline Python tests** — `python3 pipeline/scripts/test_*.py` (unittest).
  `010_compute_movers` reads `POSTGRES_URL` at import; set a dummy to import it for
  SQL-only tests. Filenames start with digits → load via importlib.
