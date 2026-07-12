-- Preferred UI/chat language for Volzar localization. Nullable: NULL means
-- "auto" (derive from country_code, else English). Stores a short language
-- code ('fr', 'ja', 'pt', ...) validated at the API layer.
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language text;
