import type { DeckDTO } from '@/lib/services/contracts/IDeckService';

export interface UniqueCard {
  key: string;
  name: string;
  pitch: number;
}

// One note per UNIQUE card (name+pitch), not per copy. Key matches the
// convention used by the notes API and get_results so notes thread through.
export function cardKey(name: string, pitch: number): string {
  return `${name.trim().toLowerCase()}|${pitch}`;
}

// Every unique card across the whole deck — maindeck, equipment, hero, AND the
// inventory (sideboard pool) — deduped by name+pitch and sorted.
export function collectUniqueCards(
  deck?: Partial<Pick<DeckDTO, 'maindeck' | 'equipment' | 'hero' | 'inventory'>> | null
): UniqueCard[] {
  const map = new Map<string, UniqueCard>();
  const all = [
    ...(deck?.maindeck ?? []),
    ...(deck?.equipment ?? []),
    ...(deck?.hero ?? []),
    ...(deck?.inventory ?? []),
  ];
  for (const c of all) {
    const name = c.printingDetails?.display_name;
    if (!name) continue;
    const pitch = c.printingDetails?.pitch ?? 0;
    const k = cardKey(name, pitch);
    if (!map.has(k)) map.set(k, { key: k, name, pitch });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name) || a.pitch - b.pitch);
}
