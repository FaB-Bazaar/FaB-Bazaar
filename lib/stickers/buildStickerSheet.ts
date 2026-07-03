// lib/stickers/buildStickerSheet.ts
// Expand a deck DTO into ordered, quantity-expanded QR sticker entries.
// One sticker per physical copy; payload is the printing page URL that the
// webcam-play scanner (and any phone camera) resolves a sleeve to.

export interface StickerEntry {
  printingId: string;
  name: string;
  collectorNumber: string;
  pitch: number | null;
  payload: string;
}

export interface StickerSection {
  section: 'Hero' | 'Equipment' | 'Maindeck' | 'Inventory';
  stickers: StickerEntry[];
}

interface DeckEntryLike {
  printingId: string;
  quantity: number;
  printingDetails?: {
    display_name?: string;
    collector_number?: string;
    pitch?: number | null;
  } | null;
}

interface DeckLike {
  hero?: DeckEntryLike[];
  equipment?: DeckEntryLike[];
  maindeck?: DeckEntryLike[];
  inventory?: DeckEntryLike[];
}

export const STICKER_BASE_URL = 'https://fabbazaar.app';

const SECTIONS: Array<[keyof DeckLike, StickerSection['section']]> = [
  ['hero', 'Hero'],
  ['equipment', 'Equipment'],
  ['maindeck', 'Maindeck'],
  ['inventory', 'Inventory'],
];

export function buildStickerSheet(
  deck: DeckLike,
  baseUrl: string = STICKER_BASE_URL
): StickerSection[] {
  const base = baseUrl.replace(/\/+$/, '');
  const sections: StickerSection[] = [];

  for (const [key, section] of SECTIONS) {
    const entries = deck[key];
    if (!entries || entries.length === 0) continue;
    const stickers: StickerEntry[] = [];
    for (const entry of entries) {
      const pd = entry.printingDetails;
      const sticker: StickerEntry = {
        printingId: entry.printingId,
        name: pd?.display_name || 'Unknown card',
        collectorNumber: pd?.collector_number || '',
        pitch: pd?.pitch ?? null,
        payload: `${base}/printing/${entry.printingId}`,
      };
      for (let i = 0; i < Math.max(1, entry.quantity); i++) {
        stickers.push(sticker);
      }
    }
    sections.push({ section, stickers });
  }

  return sections;
}
