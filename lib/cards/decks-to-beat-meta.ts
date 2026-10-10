/**
 * Pure helpers for the card-details lightbox "Decks to Beat" panel. The
 * Meta tab is derived client-side from the same response as the Decks tab
 * (GET /api/cards/[cardUniqueId]/decks-to-beat) — no second request.
 */

import type { CardDecksToBeatEntryDTO } from '@/lib/services/contracts/IDeckService';
import { shortFormatLabel } from './card-legality';

export const shortFormat = shortFormatLabel;

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Formats the card appears in, most decks first (ties keep first-seen order). */
export function metaFormats(decks: CardDecksToBeatEntryDTO[]): string[] {
  const counts = new Map<string, number>();
  for (const d of decks) {
    if (d.format) counts.set(d.format, (counts.get(d.format) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
}

export interface MetaSummary {
  /** Decks to Beat in this format that play the card */
  deckCount: number;
  /** All Decks to Beat in this format */
  total: number;
  bestPlacing?: number;
  /** Most decks first, then name */
  heroes: Array<{ heroName: string; count: number }>;
}

export function summarizeMeta(
  decks: CardDecksToBeatEntryDTO[],
  totalsByFormat: Record<string, number>,
  format: string,
): MetaSummary {
  const inFormat = decks.filter((d) => d.format === format);
  const heroCounts = new Map<string, number>();
  let bestPlacing: number | undefined;
  for (const d of inFormat) {
    const hero = d.heroName || 'Unknown hero';
    heroCounts.set(hero, (heroCounts.get(hero) ?? 0) + 1);
    if (d.placing != null && (bestPlacing === undefined || d.placing < bestPlacing)) bestPlacing = d.placing;
  }
  return {
    deckCount: inFormat.length,
    total: totalsByFormat[format] ?? 0,
    bestPlacing,
    heroes: [...heroCounts.entries()]
      .map(([heroName, count]) => ({ heroName, count }))
      .sort((a, b) => b.count - a.count || a.heroName.localeCompare(b.heroName)),
  };
}
