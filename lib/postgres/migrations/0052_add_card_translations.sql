-- Translations of card-level text (name, rules text, type line, traits)
-- keyed by (card_unique_id, language). Drives the viewer's preferred display
-- language, independent of which physical printing they're looking at.
--
-- Design decisions:
--   - English stays on `cards` as the source of truth. No 'en' rows in this
--     table by default. Read path is LEFT JOIN + COALESCE(t.field, c.field).
--   - Lowercase ISO 639-1 language codes ('fr', 'de', 'it', 'es', 'ja').
--   - `traits` is text[] mirroring `cards.traits`. Other gameplay-canonical
--     arrays (types, keywords, classes, talents, essences) stay on `cards` —
--     they're identifiers, not rendered strings.
--   - `source` + `source_card_id` are bookkeeping: which feed / dataset the
--     row came from, and the upstream UUID (e.g. LSS card id) for traceability.
--     Plain text, not a FK.
--
-- Adding a new language is INSERT-only; no schema change.

CREATE TABLE IF NOT EXISTS card_translations (
  card_unique_id  text NOT NULL REFERENCES cards(card_unique_id) ON DELETE CASCADE,
  language        text NOT NULL,

  name            text NOT NULL,
  display_name    text NOT NULL,
  text            text,
  type_text       text,
  traits          text[],
  flavor_text     text,

  source          text,
  source_card_id  text,
  updated_at      timestamp DEFAULT now() NOT NULL,

  PRIMARY KEY (card_unique_id, language)
);

CREATE INDEX IF NOT EXISTS idx_card_translations_lang_name
  ON card_translations(language, name);
