// Plain-text deck list for "Copy list" / "Export": equipment, main deck and
// inventory as "N Name (pitch)", printings of the same card merged. Shared by
// the classic deck page and deck v2's Options menu.

import type { DeckDTO, DeckPrintingDTO } from '@/lib/services/contracts/IDeckService'

const PITCH_LABEL: Record<number, string> = { 1: "(red)", 2: "(yel)", 3: "(blu)" };

export function buildDeckExportText(deck: DeckDTO): string {
  const totals = new Map<string, number>();
  const keyOrder: string[] = [];
  for (const category of ["equipment", "maindeck", "inventory"] as const) {
    const cards = (deck[category] ?? []) as DeckPrintingDTO[];
    for (const card of cards) {
      const qty = card.quantity ?? 1;
      const name = card.printingDetails?.display_name || card.printingDetails?.name || card.printingId;
      const pitch = card.printingDetails?.pitch;
      const pitchStr = pitch ? ` ${PITCH_LABEL[pitch]}` : "";
      const key = `${name}${pitchStr}`;
      if (!totals.has(key)) keyOrder.push(key);
      totals.set(key, (totals.get(key) ?? 0) + qty);
    }
  }
  return keyOrder.map(key => `${totals.get(key)} ${key}`).join("\n");
}
