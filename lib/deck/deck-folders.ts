/**
 * Deck "folder" helpers for the /decks page.
 *
 * `decks.folder` is a free-form, user-defined string ("Physical decks",
 * "Brewing", …) that acts as a single-level folder system. These helpers back
 * the folder filter dropdown: the sentinel values are what the <select> holds
 * alongside real folder names.
 */

/** Filter value: show every deck regardless of folder. */
export const ALL_FOLDERS = 'all';
/** Filter value: show only decks with no folder. */
export const NO_FOLDER = '__none__';

export type DeckFolderFilter = typeof ALL_FOLDERS | typeof NO_FOLDER | (string & {});

/** Distinct folder names across the given decks, sorted case-insensitively. */
export function collectDeckFolders(decks: ReadonlyArray<{ folder?: string | null }>): string[] {
  const set = new Set<string>();
  for (const d of decks) {
    if (d.folder) set.add(d.folder);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function matchesFolderFilter(
  deck: { folder?: string | null },
  filter: DeckFolderFilter,
): boolean {
  if (filter === ALL_FOLDERS) return true;
  if (filter === NO_FOLDER) return !deck.folder;
  return deck.folder === filter;
}
