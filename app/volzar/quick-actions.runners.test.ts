// Runner-level tests for the quick actions (client services mocked).
// The formatter tests live in quick-actions.test.ts; these cover the thin
// wiring — specifically that fetches can never truncate before the
// client-side featured/system partition hides personal decks.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/client', () => ({
  bindersClient: { getUserBinders: vi.fn(), getBinderCards: vi.fn(), addCardsToBinder: vi.fn() },
  wantsClient: { getUserWants: vi.fn(), addWantsItem: vi.fn() },
  decksClient: { getUserDecks: vi.fn(), getDeck: vi.fn(), getInventoryComparison: vi.fn(), addPrintings: vi.fn() },
}));

// Import AFTER mocks (vi.mock is hoisted)
import {
  QUICK_ACTIONS, runHeroKit, fetchToBeatHeroes,
  addSearchSelectionToBinder, addSearchSelectionToWants, addSearchSelectionToDeck,
} from './quick-actions';
import { bindersClient, decksClient, wantsClient } from '@/lib/client';

const mockGetUserDecks = vi.mocked(decksClient.getUserDecks);
const mockAddCardsToBinder = vi.mocked(bindersClient.addCardsToBinder);
const mockAddWantsItem = vi.mocked(wantsClient.addWantsItem);
const mockAddPrintings = vi.mocked(decksClient.addPrintings);

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

// Payload shape produced by CardSearchDialog's onSelectCard.
const selection = (over: Record<string, unknown> = {}) => ({
  card: { unique_id: 'cu1', name: 'Enlightened Strike' },
  printing: { printing_id: 'pr1', display_name: 'Enlightened Strike (Red)' },
  quantity: 2,
  forTrade: true,
  ...over,
});

describe('addSearchSelectionToBinder', () => {
  it('passes printingId, quantity, and forTrade through to addCardsToBinder for the chosen binder', async () => {
    mockAddCardsToBinder.mockResolvedValue({ success: true, data: {} } as any);

    const result = await addSearchSelectionToBinder('binder-9', selection() as any);

    expect(mockAddCardsToBinder).toHaveBeenCalledWith('binder-9', [
      { printingId: 'pr1', quantity: 2, forTrade: true },
    ]);
    expect(result).toEqual({ ok: true, name: 'Enlightened Strike (Red)' });
  });

  it('preserves forTrade=false — server/service defaults elsewhere coerce ?? true', async () => {
    mockAddCardsToBinder.mockResolvedValue({ success: true, data: {} } as any);

    await addSearchSelectionToBinder('binder-9', selection({ forTrade: false }) as any);

    expect(mockAddCardsToBinder.mock.calls[0][1][0].forTrade).toBe(false);
  });

  it('returns an error without calling the client when the selection has no printing id', async () => {
    const result = await addSearchSelectionToBinder('binder-9', selection({ printing: {} }) as any);

    expect(mockAddCardsToBinder).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it('surfaces the client error on failure', async () => {
    mockAddCardsToBinder.mockResolvedValue({ success: false, error: 'nope' } as any);

    const result = await addSearchSelectionToBinder('binder-9', selection() as any);

    expect(result).toEqual({ ok: false, error: 'nope' });
  });
});

describe('addSearchSelectionToWants', () => {
  it('adds the selected printing and quantity to the wants list', async () => {
    mockAddWantsItem.mockResolvedValue({ success: true, data: {} } as any);

    const result = await addSearchSelectionToWants(selection() as any);

    expect(mockAddWantsItem).toHaveBeenCalledWith('pr1', 2);
    expect(result).toEqual({ ok: true, name: 'Enlightened Strike (Red)' });
  });

  it('falls back to printing.unique_id — the dialog maps printing_id onto unique_id in its grouped shape', async () => {
    mockAddWantsItem.mockResolvedValue({ success: true, data: {} } as any);

    await addSearchSelectionToWants(selection({ printing: { unique_id: 'pr2', display_name: 'X' } }) as any);

    expect(mockAddWantsItem).toHaveBeenCalledWith('pr2', 2);
  });

  it('surfaces the client error on failure', async () => {
    mockAddWantsItem.mockResolvedValue({ success: false, error: 'wants down' } as any);

    const result = await addSearchSelectionToWants(selection() as any);

    expect(result).toEqual({ ok: false, error: 'wants down' });
  });
});

describe('addSearchSelectionToDeck', () => {
  it('adds a non-equipment card to the maindeck of the deck (by public id)', async () => {
    mockAddPrintings.mockResolvedValue({ success: true, data: {} } as any);

    const result = await addSearchSelectionToDeck('pub-1', selection() as any);

    expect(mockAddPrintings).toHaveBeenCalledWith('pub-1', [
      { printingId: 'pr1', quantity: 2, category: 'maindeck' },
    ]);
    expect(result).toEqual({ ok: true, name: 'Enlightened Strike (Red)' });
  });

  it('routes equipment/weapon-typed cards to the equipment category (same rule as the deck editor)', async () => {
    mockAddPrintings.mockResolvedValue({ success: true, data: {} } as any);

    await addSearchSelectionToDeck('pub-1', selection({
      card: { unique_id: 'cu2', name: 'Fyendal\'s Spring Tunic', types: ['Generic', 'Equipment'] },
    }) as any);

    expect(mockAddPrintings.mock.calls[0][1][0].category).toBe('equipment');
  });

  it('routes hero-typed cards to the hero category', async () => {
    mockAddPrintings.mockResolvedValue({ success: true, data: {} } as any);

    await addSearchSelectionToDeck('pub-1', selection({
      card: { unique_id: 'cu3', name: 'Dorinthea', types: ['Hero', 'Young'] },
    }) as any);

    expect(mockAddPrintings.mock.calls[0][1][0].category).toBe('hero');
  });

  it('falls back to printing types when the grouped card has none', async () => {
    mockAddPrintings.mockResolvedValue({ success: true, data: {} } as any);

    await addSearchSelectionToDeck('pub-1', selection({
      card: { unique_id: 'cu4', name: 'Sword' },
      printing: { printing_id: 'pr4', display_name: 'Sword', types: ['Warrior', 'Weapon'] },
    }) as any);

    expect(mockAddPrintings.mock.calls[0][1][0].category).toBe('equipment');
  });

  it('returns an error without calling the client when the selection has no printing id', async () => {
    const result = await addSearchSelectionToDeck('pub-1', selection({ printing: {} }) as any);

    expect(mockAddPrintings).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it('surfaces the client error on failure', async () => {
    mockAddPrintings.mockResolvedValue({ success: false, error: 'deck locked' } as any);

    const result = await addSearchSelectionToDeck('pub-1', selection() as any);

    expect(result).toEqual({ ok: false, error: 'deck locked' });
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
