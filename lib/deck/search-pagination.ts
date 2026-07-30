import { sortPrintings } from '@/lib/fab-constants';

/**
 * Pagination helpers for the mobile deck-editor card search.
 *
 * The caller accumulates RAW printings across pages and regroups the full
 * list after each fetch — a card whose printings straddle a page boundary
 * merges into one row instead of appearing twice.
 */

export interface GroupedSearchCard {
  card_unique_id: string;
  allPrintings: any[];
  [key: string]: any;
}

export function groupSearchPrintings(printings: any[]): GroupedSearchCard[] {
  const groups = new Map<string, { base: any; all: any[] }>();
  for (const printing of printings) {
    const uid = printing.card_unique_id;
    if (!groups.has(uid)) groups.set(uid, { base: printing, all: [] });
    groups.get(uid)!.all.push(printing);
  }
  return Array.from(groups.values()).map(g => ({
    ...g.base,
    allPrintings: sortPrintings(g.all),
  }));
}

export function hasMoreSearchPages(page: number | undefined, pages: number | undefined): boolean {
  return typeof page === 'number' && typeof pages === 'number' && page < pages;
}
