/**
 * Pick the printing of the same card in a target language that exactly matches
 * the current printing's variant (set + edition + foiling). Returns null when no
 * such printing exists, or when the only match is the current printing itself
 * (already in the target language) — in both cases the deck card is left as-is.
 *
 * "Exact variant only": a rainbow-foil OMN171 converts only to a rainbow-foil
 * OMN171 in the target language, never to a standard or different-set printing.
 */
export interface VariantPrinting {
  printing_id: string;
  set: string;
  edition: string;
  foiling: string;
  language: string;
}

export function pickLanguageVariant<T extends VariantPrinting>(
  current: { printing_id: string; set: string; edition: string; foiling: string },
  candidates: T[],
  targetLanguage: string,
): T | null {
  const match = candidates.find(
    (p) =>
      p.language === targetLanguage &&
      p.set === current.set &&
      p.edition === current.edition &&
      p.foiling === current.foiling &&
      p.printing_id !== current.printing_id,
  );
  return match ?? null;
}
