/**
 * Kit-browse view model for the deck editor's mobile Cards tab.
 *
 * Curated lists express quantity by repeating a printingId (a kit wanting 3×
 * of a card lists it 3 times) — mirror of the deck page's `seenCards` logic.
 * This collapses each kit into ordered { printingId, qty } entries and collects
 * the unique printingIds across all kits for a single hydration fetch.
 */

export interface KitBrowseBuild {
  id: string;
  name: string;
  cards: Array<{ printingId: string }>;
  curatorUser?: { displayUsername?: string | null } | null;
}

export interface KitSection {
  id: string;
  name: string;
  curatorName: string | null;
  entries: Array<{ printingId: string; qty: number }>;
  /** Total card count including repeats (what the kit actually contains). */
  totalCards: number;
}

export function buildKitSections(builds: KitBrowseBuild[]): {
  sections: KitSection[];
  allPrintingIds: string[];
} {
  const sections: KitSection[] = [];
  const allIds = new Set<string>();

  for (const build of builds) {
    if (!build.cards?.length) continue;
    const byPrinting = new Map<string, { printingId: string; qty: number }>();
    for (const card of build.cards) {
      const entry = byPrinting.get(card.printingId);
      if (entry) entry.qty++;
      else byPrinting.set(card.printingId, { printingId: card.printingId, qty: 1 });
      allIds.add(card.printingId);
    }
    sections.push({
      id: build.id,
      name: build.name,
      curatorName: build.curatorUser?.displayUsername ?? null,
      entries: Array.from(byPrinting.values()),
      totalCards: build.cards.length,
    });
  }

  return { sections, allPrintingIds: Array.from(allIds) };
}
