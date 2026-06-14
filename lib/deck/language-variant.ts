/**
 * Pick the CLOSEST printing of the same card in a target language. Preference,
 * highest first:
 *   1. exact variant — same set + edition + foiling
 *   2. same foiling (preserve rainbow/cold/standard) in another set/edition
 *   3. any printing in the target language
 * Returns null when the card has no printing in the target language, or when the
 * only candidate is the current printing itself (already that language).
 *
 * Foiling is preserved over set/edition — a rainbow-foil card prefers a
 * rainbow-foil printing. Ties break deterministically (set, then printing_id).
 */
export interface VariantPrinting {
  printing_id: string;
  set: string;
  edition: string;
  foiling: string;
  language: string;
}

export function pickLanguageVariant<T extends VariantPrinting>(
  current: { printing_id: string; set: string; edition: string; foiling: string; language: string },
  candidates: T[],
  targetLanguage: string,
): T | null {
  // Already in the target language — leave it as-is, don't reshuffle to another printing.
  if (current.language === targetLanguage) return null;

  const pool = candidates.filter(
    (p) => p.language === targetLanguage && p.printing_id !== current.printing_id,
  );
  if (!pool.length) return null;

  const score = (p: T) =>
    (p.foiling === current.foiling ? 4 : 0) +
    (p.edition === current.edition ? 2 : 0) +
    (p.set === current.set ? 1 : 0);

  return [...pool].sort((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d;
    if (a.set !== b.set) return a.set < b.set ? -1 : 1;
    return a.printing_id < b.printing_id ? -1 : 1;
  })[0];
}
