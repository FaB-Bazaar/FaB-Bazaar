import type { DeckSectionCounts } from './deck-section-counts';

export interface DeckStatsRow {
  label: string;
  /** Pre-formatted for display — avg cost carries one decimal, counts are integers. */
  value: string;
}

export interface DeckStatsRowInput {
  noPitch: number;
  averageCost: number | null;
  sectionCounts: DeckSectionCounts;
}

/**
 * Secondary deck stats, in display order. These live inline on desktop but
 * collapse into the mobile "Stats" popover — the pitch chips and the decklist
 * itself earn the vertical space on a phone.
 */
export function buildDeckStatsRows({ noPitch, averageCost, sectionCounts }: DeckStatsRowInput): DeckStatsRow[] {
  const rows: DeckStatsRow[] = [];
  if (noPitch > 0) rows.push({ label: 'No Pitch', value: String(noPitch) });
  if (averageCost != null) rows.push({ label: 'Avg Cost', value: averageCost.toFixed(1) });
  const zones: Array<[string, number]> = [
    ['Weapons', sectionCounts.weapon],
    ['Equipment', sectionCounts.equipment],
    ['Maindeck', sectionCounts.maindeck],
    ['Inventory', sectionCounts.inventory],
    ['Bench', sectionCounts.bench],
  ];
  for (const [label, count] of zones) {
    if (count > 0) rows.push({ label, value: String(count) });
  }
  return rows;
}
