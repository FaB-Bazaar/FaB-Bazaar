// Plain-text deck list for "Copy list" / "Export", shared by the classic deck
// page and the rail page's Options menu. Laid out like a FaBrary export so it
// pastes back into our own importer (lib/browse/parsers/fabrary-deck-parser):
//
//   Name: …  /  Hero: …  /  Format: …
//   Arena cards   — the equipment zone
//   Deck cards    — the main deck
//   Sideboard     — the inventory zone (FaBrary has no such section)
//
// Each line is "Nx Name (colour)", printings of the same card merged within a
// section. The benched (maybe) pile and tokens are never exported.

import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'

const PITCH_LABEL: Record<number, string> = { 1: '(red)', 2: '(yellow)', 3: '(blue)' };

const SECTIONS = [
  { category: 'equipment', label: 'Arena cards' },
  { category: 'maindeck', label: 'Deck cards' },
  { category: 'inventory', label: 'Sideboard' },
] as const;

const cardName = (card: DeckPrintingDTO): string =>
  card.printingDetails?.display_name || card.printingDetails?.name || card.printingId;

function sectionLines(cards: DeckPrintingDTO[]): string[] {
  const rows = new Map<string, { name: string; pitch: number; quantity: number }>();
  for (const card of cards) {
    const name = cardName(card);
    const pitch = PITCH_LABEL[card.printingDetails?.pitch ?? 0] ? (card.printingDetails!.pitch as number) : 0;
    const key = `${name}|${pitch}`;
    const row = rows.get(key) ?? { name, pitch, quantity: 0 };
    row.quantity += card.quantity ?? 1;
    rows.set(key, row);
  }
  return [...rows.values()]
    .sort((a, b) => a.pitch - b.pitch || a.name.localeCompare(b.name))
    .map(r => `${r.quantity}x ${r.name}${r.pitch ? ` ${PITCH_LABEL[r.pitch]}` : ''}`);
}

export function buildDeckExportText(deck: DeckDTO): string {
  const hero = deck.heroName || (deck.hero?.[0] ? cardName(deck.hero[0]) : '');
  const header = [
    deck.name ? `Name: ${deck.name}` : '',
    hero ? `Hero: ${hero}` : '',
    deck.format ? `Format: ${deck.format}` : '',
  ].filter(Boolean);

  const blocks: string[][] = header.length > 0 ? [header] : [];
  for (const { category, label } of SECTIONS) {
    const lines = sectionLines((deck[category] ?? []) as DeckPrintingDTO[]);
    if (lines.length > 0) blocks.push([label, ...lines]);
  }
  return blocks.map(block => block.join('\n')).join('\n\n');
}
