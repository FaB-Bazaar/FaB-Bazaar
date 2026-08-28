// lib/deck/deck-image.ts
// Pure model + layout for the shareable deck snapshot PNG ("Export image" in
// the deck More menu). Node-safe: the canvas drawing lives in
// `lib/deck/deck-image-render.ts` (browser-only) and consumes the layout
// computed here, so the grouping/merging/placement rules are unit-testable.
import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService';

export interface DeckImageCard {
  name: string;
  /** Stored image url, or null → the renderer draws a named placeholder. */
  imageUrl: string | null;
  quantity: number;
  pitch: number | null;
}

export type DeckImageSectionKey = 'equipment' | 'red' | 'yellow' | 'blue' | 'no-pitch' | 'inventory';

export interface DeckImageSection {
  key: DeckImageSectionKey;
  title: string;
  /** Accent colour for the section heading (hex). */
  accent: string;
  cards: DeckImageCard[];
}

export interface DeckImageModel {
  name: string;
  format: string;
  heroName: string | null;
  heroImageUrl: string | null;
  ownerUsername: string | null;
  deckUrl: string;
  totalCards: number;
  pitch: { red: number; yellow: number; blue: number; none: number };
  sections: DeckImageSection[];
}

export interface BuildDeckImageOptions {
  /** Site origin used for the footer link, e.g. `https://fabbazaar.app`. */
  origin: string;
  /** Include the inventory (sideboard) section. Default true. */
  includeInventory?: boolean;
}

const PITCH_ACCENT = { red: '#f87171', yellow: '#facc15', blue: '#60a5fa', none: '#9ca3af', gray: '#d1d5db' } as const;

/** FaB cards are 63×88mm. */
export const CARD_ASPECT = 88 / 63;

function cardName(p: DeckPrintingDTO['printingDetails']): string {
  return p?.display_name || p?.name || 'Unknown card';
}

function storedImageUrl(p: DeckPrintingDTO['printingDetails']): string | null {
  const url = p?.image_url;
  return typeof url === 'string' && url.startsWith('http') ? url : null;
}

/** Merge printings of the same card (any printing) into one entry, sorted by name. */
function mergeCards(rows: DeckPrintingDTO[]): DeckImageCard[] {
  const merged = new Map<string, DeckImageCard>();
  for (const r of rows) {
    const d = r.printingDetails;
    const key = d?.card_unique_id || cardName(d).toLowerCase();
    const qty = r.quantity ?? 1;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += qty;
      if (!existing.imageUrl) existing.imageUrl = storedImageUrl(d);
    } else {
      merged.set(key, {
        name: cardName(d),
        imageUrl: storedImageUrl(d),
        quantity: qty,
        pitch: typeof d?.pitch === 'number' ? d.pitch : null,
      });
    }
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildDeckImageModel(deck: DeckDTO, opts: BuildDeckImageOptions): DeckImageModel {
  const includeInventory = opts.includeInventory !== false;
  const equipment = deck.equipment ?? [];
  const maindeck = deck.maindeck ?? [];
  const inventory = deck.inventory ?? [];

  // Stat strip covers the whole box (equipment + maindeck + inventory), like
  // the editor header — equipment has no pitch, so it lands in `none`.
  const pitch = { red: 0, yellow: 0, blue: 0, none: 0 };
  let totalCards = 0;
  for (const r of [...equipment, ...maindeck, ...inventory]) {
    const qty = r.quantity ?? 1;
    totalCards += qty;
    const p = r.printingDetails?.pitch;
    if (p === 1) pitch.red += qty;
    else if (p === 2) pitch.yellow += qty;
    else if (p === 3) pitch.blue += qty;
    else pitch.none += qty;
  }

  const byPitch = (p: number | null) =>
    maindeck.filter(r => (p === null ? !r.printingDetails?.pitch : r.printingDetails?.pitch === p));

  const sections: DeckImageSection[] = [
    { key: 'equipment', title: 'Equipment & Weapons', accent: PITCH_ACCENT.gray, cards: mergeCards(equipment) },
    { key: 'red', title: 'Red', accent: PITCH_ACCENT.red, cards: mergeCards(byPitch(1)) },
    { key: 'yellow', title: 'Yellow', accent: PITCH_ACCENT.yellow, cards: mergeCards(byPitch(2)) },
    { key: 'blue', title: 'Blue', accent: PITCH_ACCENT.blue, cards: mergeCards(byPitch(3)) },
    { key: 'no-pitch', title: 'No Pitch', accent: PITCH_ACCENT.none, cards: mergeCards(byPitch(null)) },
  ];
  if (includeInventory) {
    sections.push({ key: 'inventory', title: 'Inventory', accent: PITCH_ACCENT.gray, cards: mergeCards(inventory) });
  }

  const heroCard = deck.hero?.[0]?.printingDetails;
  const heroName = heroCard ? cardName(heroCard) : deck.heroName || null;

  return {
    name: deck.name,
    format: deck.format,
    heroName,
    heroImageUrl: heroCard ? storedImageUrl(heroCard) : null,
    ownerUsername: (deck as DeckDTO & { ownerUsername?: string }).ownerUsername ?? null,
    deckUrl: `${opts.origin.replace(/\/$/, '')}/decks/${deck.publicId}`,
    totalCards,
    pitch,
    sections: sections.filter(s => s.cards.length > 0),
  };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface DeckImageLayoutOptions {
  /** Canvas width in CSS px. Default 1600. */
  width?: number;
  /** Cards per row. Default 8. */
  columns?: number;
}

export interface PlacedCard {
  x: number;
  y: number;
  w: number;
  h: number;
  card: DeckImageCard;
}

export interface PlacedSection {
  key: DeckImageSectionKey;
  title: string;
  accent: string;
  count: number;
  /** Baseline y of the section title. */
  titleY: number;
  cards: PlacedCard[];
}

export interface DeckImageLayout {
  width: number;
  height: number;
  padding: number;
  header: { x: number; y: number; height: number; heroW: number; heroH: number };
  sections: PlacedSection[];
  /** Footer baseline y. */
  footerY: number;
  cardRadius: number;
}

export function layoutDeckImage(model: DeckImageModel, opts: DeckImageLayoutOptions = {}): DeckImageLayout {
  const width = opts.width ?? 1600;
  const columns = Math.max(1, opts.columns ?? 8);
  const padding = Math.round(width * 0.025);
  const gap = Math.round(width * 0.008);
  const cardW = Math.floor((width - padding * 2 - gap * (columns - 1)) / columns);
  const cardH = Math.round(cardW * CARD_ASPECT);

  const heroW = Math.round(cardW * 0.9);
  const heroH = Math.round(heroW * CARD_ASPECT);
  const header = { x: padding, y: padding, height: heroH, heroW, heroH };

  const titleSize = Math.round(width * 0.016);
  const sectionGap = Math.round(width * 0.02);

  let y = padding + heroH + sectionGap;
  const sections: PlacedSection[] = model.sections.map(section => {
    const titleY = y + titleSize;
    const gridTop = titleY + Math.round(titleSize * 0.7);
    const cards: PlacedCard[] = section.cards.map((card, i) => {
      const col = i % columns;
      const rowIdx = Math.floor(i / columns);
      return {
        x: padding + col * (cardW + gap),
        y: gridTop + rowIdx * (cardH + gap),
        w: cardW,
        h: cardH,
        card,
      };
    });
    const rows = Math.ceil(section.cards.length / columns);
    y = gridTop + rows * (cardH + gap) - gap + sectionGap;
    return {
      key: section.key,
      title: section.title,
      accent: section.accent,
      count: section.cards.reduce((n, c) => n + c.quantity, 0),
      titleY,
      cards,
    };
  });

  const footerSize = Math.round(width * 0.012);
  const footerY = y + footerSize;
  const height = footerY + padding;

  return { width, height, padding, header, sections, footerY, cardRadius: Math.round(cardW * 0.045) };
}
