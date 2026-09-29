/**
 * The deck -> sections grouping the decklist block renders (hero + equipment,
 * the library by pitch, inventory, ...). Shared by the live block and the
 * server-side article snapshot, so a frozen list groups exactly like the live
 * one. Pure: no DOM, no fetch.
 */

export type PitchColor = 'red' | 'yellow' | 'blue' | null;

export interface DeckCard {
  cardName: string;
  printingId: string;
  quantity: number;
  foiling?: string;
  // Stored CDN url from the printing row. Never construct one from printingId —
  // the printing_id-keyed Cloudflare images were deleted (2026-07) and 404.
  imageUrl?: string;
  // HUD filter stats
  pitch: number | null;
  cost: number | null;
  power: number | null;
  defense: number | null;
  types: string[];
  keywords: string[];
}

export interface DeckSection {
  label: string;
  pitchColor: PitchColor;
  totalCards: number;
  uniqueCards: number;
  cards: DeckCard[];
}

export function deckToSections(deck: any): {
  sections: DeckSection[];
  title: string;
  exportUrl?: string;
  notes?: string;
} {
  const sections: DeckSection[] = [];

  // === EQUIPMENT & WEAPONS: merge hero + equipment into one section ===
  const heroAndEquipment = [
    ...(Array.isArray(deck.hero) ? deck.hero : []),
    ...(Array.isArray(deck.equipment) ? deck.equipment : []),
  ];
  if (heroAndEquipment.length > 0) {
    const cardMap = new Map<string, DeckCard>();
    for (const card of heroAndEquipment) {
      const printingId = card.printingId;
      const cardName = card.printingDetails?.display_name || card.printingDetails?.name || 'Unknown Card';
      const qty = card.quantity ?? 1;
      if (cardMap.has(printingId)) {
        cardMap.get(printingId)!.quantity += qty;
      } else {
        cardMap.set(printingId, {
          cardName,
          printingId,
          quantity: qty,
          foiling: card.printingDetails?.foiling || card.foiling,
          imageUrl: card.printingDetails?.image_url,
          pitch: card.printingDetails?.pitch ?? null,
          cost: card.printingDetails?.cost ?? null,
          power: card.printingDetails?.power ?? null,
          defense: card.printingDetails?.defense ?? null,
          types: card.printingDetails?.types ?? [],
          keywords: card.printingDetails?.keywords ?? [],
        });
      }
    }
    const totalEquip = Array.from(cardMap.values()).reduce((s, c) => s + c.quantity, 0);
    sections.push({
      label: 'EQUIPMENT & WEAPONS',
      pitchColor: null,
      totalCards: totalEquip,
      uniqueCards: cardMap.size,
      cards: Array.from(cardMap.values()),
    });
  }

  // === MAINDECK + other sections ===
  const remainingCategories: Array<{ key: string; label: string }> = [
    { key: 'maindeck', label: 'Main Deck' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'maybeboard', label: 'Maybeboard' },
    { key: 'tokens', label: 'Tokens' },
  ];

  for (const { key } of remainingCategories) {
    const categoryCards = deck[key];
    if (!Array.isArray(categoryCards) || categoryCards.length === 0) continue;

    if (key === 'maindeck') {
      type Bucket = {
        label: string;
        pitchColor: PitchColor;
        cardMap: Map<string, DeckCard>;
        totalCards: number;
      };
      const pitchBuckets: Bucket[] = [
        { label: 'LIBRARY — RED', pitchColor: 'red', cardMap: new Map(), totalCards: 0 },
        { label: 'LIBRARY — YELLOW', pitchColor: 'yellow', cardMap: new Map(), totalCards: 0 },
        { label: 'LIBRARY — BLUE', pitchColor: 'blue', cardMap: new Map(), totalCards: 0 },
        { label: 'Other', pitchColor: null, cardMap: new Map(), totalCards: 0 },
      ];

      for (const card of categoryCards) {
        const pitch = card.printingDetails?.pitch;
        const bucketIndex = pitch === 1 ? 0 : pitch === 2 ? 1 : pitch === 3 ? 2 : 3;
        const bucket = pitchBuckets[bucketIndex];
        const printingId = card.printingId;
        const cardName = card.printingDetails?.display_name || card.printingDetails?.name || 'Unknown Card';

        const qty = card.quantity ?? 1;
        bucket.totalCards += qty;
        if (bucket.cardMap.has(printingId)) {
          bucket.cardMap.get(printingId)!.quantity += qty;
        } else {
          bucket.cardMap.set(printingId, {
            cardName,
            printingId,
            quantity: qty,
            foiling: card.printingDetails?.foiling || card.foiling,
            imageUrl: card.printingDetails?.image_url,
            pitch: pitch ?? null,
            cost: card.printingDetails?.cost ?? null,
            power: card.printingDetails?.power ?? null,
            defense: card.printingDetails?.defense ?? null,
            types: card.printingDetails?.types ?? [],
            keywords: card.printingDetails?.keywords ?? [],
          });
        }
      }

      for (const bucket of pitchBuckets) {
        if (bucket.cardMap.size > 0) {
          sections.push({
            label: bucket.label,
            pitchColor: bucket.pitchColor,
            totalCards: bucket.totalCards,
            uniqueCards: bucket.cardMap.size,
            cards: Array.from(bucket.cardMap.values()),
          });
        }
      }
      continue;
    }

    // Non-maindeck sections
    const cardMap = new Map<string, DeckCard>();
    for (const card of categoryCards) {
      const printingId = card.printingId;
      const cardName = card.printingDetails?.display_name || card.printingDetails?.name || 'Unknown Card';
      const qty = card.quantity ?? 1;

      if (cardMap.has(printingId)) {
        cardMap.get(printingId)!.quantity += qty;
      } else {
        cardMap.set(printingId, {
          cardName,
          printingId,
          quantity: qty,
          foiling: card.printingDetails?.foiling || card.foiling,
          imageUrl: card.printingDetails?.image_url,
          pitch: card.printingDetails?.pitch ?? null,
          cost: card.printingDetails?.cost ?? null,
          power: card.printingDetails?.power ?? null,
          defense: card.printingDetails?.defense ?? null,
          types: card.printingDetails?.types ?? [],
          keywords: card.printingDetails?.keywords ?? [],
        });
      }
    }

    const label = key === 'inventory' ? 'Inventory'
      : key === 'maybeboard' ? 'Maybeboard'
      : 'Tokens';

    sections.push({
      label,
      pitchColor: null,
      totalCards: categoryCards.length,
      uniqueCards: cardMap.size,
      cards: Array.from(cardMap.values()),
    });
  }

  return {
    sections,
    title: deck.name || 'Decklist',
    exportUrl: deck.fabraryUrl,
    notes: deck.description,
  };
}

export interface DecklistChange {
  cardName: string;
  pitch: number | null;
  quantity: number;
}

/**
 * Cards added / removed between two decklists (e.g. an article's snapshot vs
 * the deck today), by card name + pitch across every section — swapping one
 * printing for another of the same card is not a change.
 */
export function diffDecklists(before: DeckSection[], after: DeckSection[]): { added: DecklistChange[]; removed: DecklistChange[] } {
  const totals = (sections: DeckSection[]) => {
    const m = new Map<string, DecklistChange>();
    for (const c of sections.flatMap(s => s.cards)) {
      const key = `${c.cardName}|${c.pitch ?? ''}`;
      const cur = m.get(key) ?? { cardName: c.cardName, pitch: c.pitch ?? null, quantity: 0 };
      cur.quantity += c.quantity;
      m.set(key, cur);
    }
    return m;
  };
  const a = totals(before), b = totals(after);
  const added: DecklistChange[] = [], removed: DecklistChange[] = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const was = a.get(key)?.quantity ?? 0, now = b.get(key)?.quantity ?? 0;
    const base = (a.get(key) ?? b.get(key))!;
    if (now > was) added.push({ cardName: base.cardName, pitch: base.pitch, quantity: now - was });
    if (was > now) removed.push({ cardName: base.cardName, pitch: base.pitch, quantity: was - now });
  }
  const order = (x: DecklistChange, y: DecklistChange) => x.cardName.localeCompare(y.cardName) || (x.pitch ?? 0) - (y.pitch ?? 0);
  return { added: added.sort(order), removed: removed.sort(order) };
}
