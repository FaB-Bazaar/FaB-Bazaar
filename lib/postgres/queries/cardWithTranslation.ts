/**
 * lib/postgres/queries/cardWithTranslation.ts
 *
 * Fetch a printing with a single language overlay applied.
 *
 * Read path: LEFT JOIN card_translations + COALESCE through the canonical
 * `cards` columns. English now lives in `card_translations` (LSS-feed
 * provides richer text than the lowercased `cards.text`), with cards.*
 * remaining as the last-resort fallback for cards we haven't imported yet.
 */

import { db } from '@/lib/postgres/db';
import { sql } from 'drizzle-orm';

export interface PrintingWithTranslation {
  printing_id: string;
  card_unique_id: string;
  set: string;
  edition: string;
  foiling: string;
  rarity: string;
  collector_number: string | null;
  printing_language: string;
  image_url: string | null;
  is_extended_art: boolean;
  art_variations: string[] | null;

  // Translated (or fallback) fields
  name: string;
  display_name: string;
  text: string | null;
  type_text: string | null;
  traits: string[] | null;
  flavor_text: string | null;

  /** Language requested by the caller. */
  requested_language: string;
  /** Language actually rendered (the requested one, or 'en' if no translation row existed). */
  rendered_language: string;
}

export async function getCardWithTranslation(
  printingId: string,
  language: string,
): Promise<PrintingWithTranslation | null> {
  const result = await db.execute<{
    printing_id: string;
    card_unique_id: string;
    set: string;
    edition: string;
    foiling: string;
    rarity: string;
    collector_number: string | null;
    printing_language: string;
    image_url: string | null;
    is_extended_art: boolean;
    art_variations: string[] | null;
    name: string;
    display_name: string;
    text: string | null;
    type_text: string | null;
    traits: string[] | null;
    flavor_text: string | null;
    has_translation: boolean;
  }>(sql`
    SELECT
      p.printing_id,
      p.card_unique_id,
      p.set,
      p.edition,
      p.foiling,
      p.rarity,
      p.collector_number,
      p.language          AS printing_language,
      p.image_url,
      p.is_extended_art,
      p.art_variations,

      COALESCE(t.name,         c.display_name)      AS name,
      COALESCE(t.display_name, c.display_name)      AS display_name,
      COALESCE(t.text,         c.text)              AS text,
      COALESCE(t.type_text,    c.type_text_display) AS type_text,
      COALESCE(t.traits,       c.traits)            AS traits,
      COALESCE(t.flavor_text,  p.flavor_text)       AS flavor_text,

      (t.card_unique_id IS NOT NULL) AS has_translation
    FROM printings p
    JOIN cards c ON c.card_unique_id = p.card_unique_id
    LEFT JOIN card_translations t
           ON t.card_unique_id = p.card_unique_id
          AND t.language = ${language}
    WHERE p.printing_id = ${printingId}
    LIMIT 1
  `);

  const row = result.rows[0];
  if (!row) return null;

  return {
    printing_id: row.printing_id,
    card_unique_id: row.card_unique_id,
    set: row.set,
    edition: row.edition,
    foiling: row.foiling,
    rarity: row.rarity,
    collector_number: row.collector_number,
    printing_language: row.printing_language,
    image_url: row.image_url,
    is_extended_art: row.is_extended_art,
    art_variations: row.art_variations,
    name: row.name,
    display_name: row.display_name,
    text: row.text,
    type_text: row.type_text,
    traits: row.traits,
    flavor_text: row.flavor_text,
    requested_language: language,
    rendered_language: row.has_translation ? language : 'en',
  };
}

/**
 * Given a card and a target language, find the best matching printing.
 *
 * Strategy (in order of preference):
 *   1. Same set + collector_number as the anchor printing
 *   2. Same set
 *   3. Same foiling
 *   4. Any printing of this card in that language
 * Falls back to `anchorPrintingId` if no printing in that language exists.
 *
 * The "anchor" is whatever printing brought the user to this page (URL slug).
 * Using it as a tiebreaker keeps the rendered printing close to what they
 * navigated to — e.g. if you're looking at EVO249 in English and switch to
 * French, you get FR_EVO249 rather than a random FR print of the same card.
 */
export async function findBestPrintingForCard(
  cardUniqueId: string,
  language: string,
  anchorPrintingId: string,
): Promise<string> {
  const result = await db.execute<{ printing_id: string }>(sql`
    SELECT p.printing_id
    FROM printings p
    LEFT JOIN printings anchor ON anchor.printing_id = ${anchorPrintingId}
    WHERE p.card_unique_id = ${cardUniqueId}
      AND p.language = ${language}
    ORDER BY
      (p.set = anchor.set AND p.collector_number = anchor.collector_number) DESC,
      (p.set = anchor.set) DESC,
      (p.foiling = anchor.foiling) DESC,
      p.printing_id
    LIMIT 1
  `);
  return result.rows[0]?.printing_id ?? anchorPrintingId;
}
