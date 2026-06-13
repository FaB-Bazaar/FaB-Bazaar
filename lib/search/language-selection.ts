/**
 * Toggle a printing-language code within the search's language selection.
 *
 * Selection model (shared by /opt and /search):
 *   ['en']        → English default
 *   []            → ALL languages
 *   ['ja', ...]   → those specific languages (OR'd in the query)
 *
 * The English default is "sticky": the first explicit pick of another language
 * REPLACES it instead of adding to it, so picking Japanese shows Japanese — not
 * English + Japanese. Once the user has de-stuck the default, further picks
 * toggle additively, so unions like ['ja', 'de'] (and even adding English back)
 * are still possible.
 */
export function toggleLanguageSelection(current: string[], code: string): string[] {
  const isEnglishDefault = current.length === 1 && current[0] === 'en';
  if (isEnglishDefault && code !== 'en') return [code];

  return current.includes(code)
    ? current.filter((c) => c !== code)
    : [...current, code];
}
