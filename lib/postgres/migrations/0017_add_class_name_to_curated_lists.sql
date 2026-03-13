ALTER TABLE curated_lists ADD COLUMN class_name TEXT;
CREATE INDEX idx_curated_lists_class_name ON curated_lists(class_name);
