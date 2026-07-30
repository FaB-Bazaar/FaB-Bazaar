# CLAUDE.md - Pipeline

Nightly data pipeline (`scripts/daily_pipeline.sh`, cron 23:00 UTC → `--production`).
Runs in the `fabbazaar-pipeline` container. See root CLAUDE.md "Data Architecture".

## Gotchas

- **feed_overrides patch the feed BEFORE pricing** — step 02 reads the
  `feed_overrides` Postgres table (migration 0095; managed at `/admin/feed-overrides`)
  at run start and patches matching feed printings (whitelisted `tcgplayer_*` fields
  only) before the tcgcsv price lookup. This is THE mechanism for correcting bad
  upstream fab-cube data (e.g. a wrong product id): never hand-edit `printings` —
  005/006 clobber it nightly, and prices are computed from the FEED's product id in
  JSON-land, so a DB-only fix never reprices. Step 02 now takes `${DB_FLAG}`
  (`--production`) so overrides come from the DB the run targets; a failed overrides
  fetch warns and continues (one uncorrected night beats killing the run). 02 also
  warns on any printing whose product id ≠ the id in its own `tcgplayer_url` — those
  are override candidates (this signature mispriced SEA015-017 at $100+/1st Strike).
  **Art-variation discriminator (migration 0096)**: the feed is 1:N on
  (collector, edition, foiling) — art variants share the key (ELE146 regular +
  Alternate Art both 1st-ed rainbow foil). `feed_overrides.art_variations`:
  NULL = match any (legacy wildcard), `{}` = only no-variant printings,
  `{AA}` = exact set match (case/order-insensitive). NEVER record a wildcard
  override for a card that has art variants — it repoints every sibling.
  The superadmin printing-TCGplayer PATCH (`/api/admin/printings/[id]/tcgplayer`)
  auto-records an override keyed by the row's exact identity, so a manual admin
  fix is durable by construction.

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

- **005 anchor reconcile** — `_reconcile_anchors` remaps feed docs to internal ids and
  adopts provisional rows BEFORE upserting; stale-delete ownership is
  `fab_cube_printing_id IS NOT NULL` (NULL-anchor rows — i18n + CardVault-provisional —
  are never pruned). Anchors are INSERT-only (`SOURCE_ANCHOR_COLS`); ambiguous adoption
  is reported in the log ("Anchor reconcile:"), never guessed.

- **Old pipeline image after 0088** — if the RAM-gated rebuild skip leaves the
  pre-anchor 005 running after the migration, that night's new rows insert unanchored
  (dual-NULL en rows). Fix: confirm the rebuild, then re-run 0088's backfill UPDATE
  (idempotent).
