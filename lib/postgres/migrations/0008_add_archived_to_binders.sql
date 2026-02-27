-- Add archived column to binders table
ALTER TABLE binders ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Mark all transit binders as archived
-- Transit binders are identified by slug starting with 'transit-from' or 'transit-to'
UPDATE binders SET archived = true WHERE slug LIKE 'transit-%';
