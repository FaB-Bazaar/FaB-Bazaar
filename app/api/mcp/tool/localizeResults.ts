// Localize search_printings results for a non-English conversation.
//
// The swap joins by card_unique_id + printings.language (the same equivalence
// the deck copy-as-language feature uses) and prefers the closest physical
// variant via pickLanguageVariant (foiling > edition > set). Cards with no
// printing in the target language FALL BACK to the English printing untouched;
// the translated card name (card_translations) still attaches when known, so
// the model can speak the user's language even for English-only printings.
import { pickLanguageVariant } from '@/lib/deck/language-variant';

// Languages with printing/translation data (lib/search/build-server-filters
// LANGUAGES minus 'en' — English is the default and needs no localization).
const RESPONSE_LANGUAGES = new Set(['fr', 'de', 'it', 'es', 'ja']);

/** Lowercase + validate an options.language value; null = no localization. */
export function normalizeResponseLanguage(lang?: string | null): string | null {
  const l = lang?.trim().toLowerCase();
  return l && RESPONSE_LANGUAGES.has(l) ? l : null;
}

interface TranslationRow {
  cardUniqueId: string;
  name: string;
  displayName: string;
}

/**
 * Swap each result printing to its localized variant (when one exists) and
 * attach `name_local`. Mutates `output` in place — it runs between the search
 * and projection/formatting, on the service's snake_case rows.
 *
 * Kept from the English row: name/display_name (canonical for trading and
 * Talishar) and tcg_* prices (localized printings carry no TCGplayer data).
 * Taken from the variant: printing identity (printing_id, collector_number,
 * set, edition, foiling, rarity), image_url, language, and text (the service
 * already overlays translated rules text per printing language).
 */
export function localizeSearchOutput(
  output: Array<{ printings: any[] }>,
  candidates: any[],
  translations: TranslationRow[],
  language: string,
): void {
  const candidatesByCard = new Map<string, any[]>();
  for (const c of candidates) {
    const key = c.card_unique_id;
    if (!key) continue;
    if (!candidatesByCard.has(key)) candidatesByCard.set(key, []);
    candidatesByCard.get(key)!.push(c);
  }
  const translationByCard = new Map(translations.map((t) => [t.cardUniqueId, t]));

  for (const section of output) {
    section.printings = section.printings.map((p) => {
      const variant = pickLanguageVariant(
        {
          printing_id: p.printing_id,
          set: p.set,
          edition: p.edition,
          foiling: p.foiling,
          language: p.language || 'en',
        },
        candidatesByCard.get(p.card_unique_id) ?? [],
        language,
      );
      const translation = translationByCard.get(p.card_unique_id);
      if (!variant && !translation) return p;

      const next = { ...p };
      if (variant) {
        next.printing_id = variant.printing_id;
        next.collector_number = variant.collector_number;
        next.set = variant.set;
        next.edition = variant.edition;
        next.foiling = variant.foiling;
        next.rarity = variant.rarity ?? p.rarity;
        next.language = language;
        if (variant.image_url) next.image_url = variant.image_url;
        if (variant.text) next.text = variant.text;
      }
      if (translation?.displayName) next.name_local = translation.displayName;
      return next;
    });
  }
}
