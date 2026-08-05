/**
 * Formats the wants auto-removal report from addCardsToBinder into a
 * user-facing sentence, e.g. "2 copies of Snatch removed from your wants list."
 * Returns null when nothing was removed (callers skip the message entirely).
 */

export interface WantsRemovedEntry {
  printingId: string;
  quantityRemoved: number;
  cardName: string;
}

export function formatWantsRemoved(entries: WantsRemovedEntry[] | undefined): string | null {
  if (!entries || entries.length === 0) return null;

  const parts = entries.map(
    (e) => `${e.quantityRemoved} ${e.quantityRemoved === 1 ? 'copy' : 'copies'} of ${e.cardName}`
  );

  let joined: string;
  if (parts.length === 1) {
    joined = parts[0];
  } else if (parts.length === 2) {
    joined = `${parts[0]} and ${parts[1]}`;
  } else {
    joined = `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  }

  return `${joined} removed from your wants list.`;
}
