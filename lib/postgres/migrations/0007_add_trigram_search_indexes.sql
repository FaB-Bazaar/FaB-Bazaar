-- Enable the pg_trgm extension for fuzzy/typo-tolerant text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for fast fuzzy lookups on card name and searchable text
CREATE INDEX IF NOT EXISTS cards_name_trgm_idx ON cards USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS cards_searchable_text_trgm_idx ON cards USING GIN (searchable_text gin_trgm_ops);
