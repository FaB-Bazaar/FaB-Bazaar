-- 0122: CardVault payload cache for the /admin/cardvault ingest job
--
-- scripts/import-new-set.ts caches every `card_id/<slug>/` response on disk so
-- re-runs cost ~1 CardVault request. The admin page runs the same ingest
-- inside the app container, whose root filesystem is read-only, so the cache
-- lives here instead. Rows are raw API responses keyed by CardVault slug;
-- nothing else reads them. Idempotent.

CREATE TABLE IF NOT EXISTS cardvault_payload_cache (
  slug       TEXT PRIMARY KEY,
  payload    JSONB NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT now()
);
