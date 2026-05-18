/**
 * Helpers for displaying printings grouped by physical-printing language.
 *
 * - `sortPrintingsByLanguage` orders printings so English appears first,
 *   then French, then Japanese, then all other languages grouped contiguously
 *   (each language group's first-seen-in-input order determines the slot).
 * - `languageFlag` maps an ISO 639-1 code to a unicode emoji flag.
 */

const PRIORITY: Record<string, number> = { en: 0, fr: 1, ja: 2 };

const FLAGS: Record<string, string> = {
  en: '🇬🇧',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  es: '🇪🇸',
  ja: '🇯🇵',
};

const FALLBACK_FLAG = '🌐';

function normalizeLang(lang: string | null | undefined): string {
  if (!lang) return 'en';
  return lang.toLowerCase();
}

export function sortPrintingsByLanguage<T extends { language?: string | null }>(
  printings: T[],
): T[] {
  // Assign a stable index to non-priority languages based on first appearance.
  const otherLangIndex = new Map<string, number>();
  for (const p of printings) {
    const lang = normalizeLang(p.language);
    if (PRIORITY[lang] === undefined && !otherLangIndex.has(lang)) {
      otherLangIndex.set(lang, otherLangIndex.size);
    }
  }

  const sortKey = (p: T): number => {
    const lang = normalizeLang(p.language);
    if (PRIORITY[lang] !== undefined) return PRIORITY[lang];
    return 3 + (otherLangIndex.get(lang) ?? 0);
  };

  // .sort mutates in place — copy first so the input array is preserved.
  return [...printings].sort((a, b) => sortKey(a) - sortKey(b));
}

export function languageFlag(lang: string | null | undefined): string {
  if (!lang) return FALLBACK_FLAG;
  return FLAGS[lang.toLowerCase()] ?? FALLBACK_FLAG;
}
