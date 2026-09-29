import { deckToSections } from '../../web-components/src/utils/deck-sections';

/**
 * Freeze decks into article decklists. A `decklist-block` section sent with a
 * `deckId` and a `snapshotLabel` gets `snapshot: { label, takenAt, title,
 * exportUrl, sections }` — the list as it is right now, grouped by the same
 * code the block renders with — so the article keeps showing what was written
 * even as the deck changes (the block still offers the live list + a diff).
 */
export async function withDecklistSnapshots(
  sections: Record<string, any>[],
  fetchDeck: (deckId: string) => Promise<any | null>,
  now: Date = new Date(),
): Promise<Record<string, any>[]> {
  return Promise.all(sections.map(async (section) => {
    if (section?.type !== 'decklist-block' || !section.snapshotLabel || !section.deckId) return section;
    const deck = await fetchDeck(section.deckId);
    if (!deck) throw new Error(`Could not load deck ${section.deckId} to snapshot it`);
    const { snapshotLabel, ...rest } = section;
    const { sections: grouped, title, exportUrl } = deckToSections(deck);
    return {
      ...rest,
      snapshot: { label: snapshotLabel, takenAt: now.toISOString().slice(0, 10), title, exportUrl, sections: grouped },
    };
  }));
}

/** Loads a deck through the app API with the MCP caller's bearer (so private decks resolve for their owner). */
export function deckFetcher(apiBase: string, bearer: string) {
  return async (deckId: string) => {
    const res = await fetch(`${apiBase}/api/decks/${encodeURIComponent(deckId)}`, { headers: { Authorization: `Bearer ${bearer}` } });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.success ? body.data : null;
  };
}

/** One-line preview of what a section will store. */
export function describeSection(section: Record<string, any>): string {
  if (section.type === 'decklist-block' && section.snapshot) {
    const cards = (section.snapshot.sections ?? []).reduce((n: number, s: any) => n + (s.totalCards ?? 0), 0);
    return `decklist-block: "${section.snapshot.title}" frozen as "${section.snapshot.label}" (${section.snapshot.takenAt}, ${cards} cards) — live list + changes one click away`;
  }
  return `${section.type} section`;
}
