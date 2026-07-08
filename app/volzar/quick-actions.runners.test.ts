// Runner-level tests for the quick actions (client services mocked).
// The formatter tests live in quick-actions.test.ts; these cover the thin
// wiring — specifically that fetches can never truncate before the
// client-side featured/system partition hides personal decks.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/client', () => ({
  bindersClient: { getUserBinders: vi.fn(), getBinderCards: vi.fn() },
  wantsClient: { getUserWants: vi.fn() },
  decksClient: { getUserDecks: vi.fn(), getDeck: vi.fn(), getInventoryComparison: vi.fn() },
}));

// Import AFTER mocks (vi.mock is hoisted)
import { QUICK_ACTIONS, runHeroKit, fetchToBeatHeroes } from './quick-actions';
import { decksClient } from '@/lib/client';

const mockGetUserDecks = vi.mocked(decksClient.getUserDecks);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runHeroKit', () => {
  it('requests the PUBLIC view — the authenticated superadmin/curator branches return lists without cards', async () => {
    // GET /api/curated-lists routes superadmins to getAllLists() and curators
    // to getListsForCurator(), both card-less admin listings — so the kit card
    // rendered empty for exactly those roles. view=public forces the
    // published-lists-with-cards branch for every caller.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as any);

    await runHeroKit('dorinthea ironsong', 'Dorinthea Ironsong', 'Classic Constructed');

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain('view=public');
    expect(url).toContain('heroName=dorinthea%20ironsong');
    fetchSpy.mockRestore();
  });
});

describe('fetchToBeatHeroes', () => {
  it('paginates past the route cap (50/page) so every featured hero reaches the dropdown', async () => {
    // /api/decks/community clamps limit to 50; with 116+ featured decks a
    // single request derives the hero list from under half the decks — heroes
    // whose decks sort later never appear in the picker.
    const deck = (heroName: string) => ({ heroName, heroDisplayName: heroName, format: 'Classic Constructed' });
    const pages: Record<string, any> = {
      '1': { decks: Array.from({ length: 50 }, (_, i) => deck(`hero_page1_${i}`)), total: 60 },
      '2': { decks: Array.from({ length: 10 }, (_, i) => deck(`hero_page2_${i}`)), total: 60 },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => ({
      ok: true,
      json: async () => ({ success: true, data: pages[new URL(String(url), 'http://x').searchParams.get('page') ?? '1'] }),
    }) as any);

    const heroes = await fetchToBeatHeroes();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(heroes).toHaveLength(60);
    expect(heroes.some((h) => h.heroName === 'hero_page2_3')).toBe(true);
    fetchSpy.mockRestore();
  });
});

describe('decks quick action', () => {
  it('requests ALL decks — a page-size cap would fill with featured/system decks and hide personal ones', async () => {
    // A curator's /api/decks response interleaves featured + system decks with
    // personal ones; summarizeDecks partitions client-side, so any server-side
    // limit silently truncates the personal list (same bug as the /decks page,
    // fixed in 1fccbc6 by requesting a non-paginating limit).
    mockGetUserDecks.mockResolvedValue({ success: true, data: { decks: [] } } as any);

    const action = QUICK_ACTIONS.find((a) => a.id === 'decks')!;
    await action.run();

    expect(mockGetUserDecks).toHaveBeenCalledTimes(1);
    const pagination = mockGetUserDecks.mock.calls[0][1] as { limit?: number } | undefined;
    expect(pagination?.limit ?? 0).toBeGreaterThanOrEqual(100000);
  });
});
