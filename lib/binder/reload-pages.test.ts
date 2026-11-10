/**
 * After an add / edit / delete the binder page reloads what is on screen. It
 * used to reload page 1 only, so in a binder over 200 cards every page the
 * viewer had scrolled through was dropped and the list jumped. It now reloads
 * every page that was loaded and stitches them back together.
 */
import { describe, it, expect, vi } from 'vitest';
import { reloadLoadedPages } from './reload-pages';

const page = (n: number, ids: string[], totalPages = 3) => ({
  cards: ids.map(id => ({ _id: id })),
  pagination: { page: n, totalPages, totalCards: 450, limit: 200 },
  metadata: { stats: { marker: n } },
});

describe('reloadLoadedPages', () => {
  it('fetches every page that was loaded, in order', async () => {
    const fetchPage = vi.fn(async (n: number) => page(n, [`c${n}a`, `c${n}b`]));
    const out = await reloadLoadedPages(fetchPage, 3);
    expect(fetchPage.mock.calls.map(c => c[0])).toEqual([1, 2, 3]);
    expect(out.cards.map(c => c._id)).toEqual(['c1a', 'c1b', 'c2a', 'c2b', 'c3a', 'c3b']);
  });

  it('keeps the viewer on the last page they had loaded', async () => {
    const out = await reloadLoadedPages(async n => page(n, [`c${n}`]), 2);
    expect(out.pagination.page).toBe(2);
    expect(out.pagination.totalPages).toBe(3);
  });

  it('takes the counts and stats from page 1 (every page carries the same)', async () => {
    const out = await reloadLoadedPages(async n => page(n, [`c${n}`]), 2);
    expect(out.metadata).toEqual({ stats: { marker: 1 } });
  });

  it('drops a card that shows up twice when a change shifts a page boundary', async () => {
    const pages = [page(1, ['a', 'b']), page(2, ['b', 'c'])];
    const out = await reloadLoadedPages(async n => pages[n - 1], 2);
    expect(out.cards.map(c => c._id)).toEqual(['a', 'b', 'c']);
  });

  it('stops at the last page that still exists (a delete can remove one)', async () => {
    const out = await reloadLoadedPages(async n => page(n, [`c${n}`], 2), 3);
    expect(out.pagination.page).toBe(2);
    expect(out.cards.map(c => c._id)).toEqual(['c1', 'c2']);
  });

  it('loads just page 1 when that is all there was', async () => {
    const fetchPage = vi.fn(async (n: number) => page(n, ['a'], 1));
    await reloadLoadedPages(fetchPage, 1);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
