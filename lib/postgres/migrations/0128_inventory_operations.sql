-- 0128: binder change history.
--
-- One row per user action that moved cards (transfer first; add/remove/import
-- later). `items` holds only what actually changed:
--   [{ printingId, condition, language, quantity }]
-- Written in the same transaction as the inventory change, so a rolled-back
-- change leaves no history. Nothing the app renders reads it.
--
-- Binder FKs are ON DELETE SET NULL so history outlives a deleted binder; the
-- user FK cascades (account deletion removes their history).
--
-- Retention: 30 days (INVENTORY_HISTORY_RETENTION_DAYS), pruned nightly —
-- idx_inventory_operations_created_at serves that DELETE.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS inventory_operations (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  source_binder_id text REFERENCES binders(id) ON DELETE SET NULL,
  target_binder_id text REFERENCES binders(id) ON DELETE SET NULL,
  items jsonb NOT NULL,
  reverted_by text REFERENCES inventory_operations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_operations_user_created
  ON inventory_operations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_operations_created_at
  ON inventory_operations (created_at);
