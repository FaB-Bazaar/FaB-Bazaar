import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  binderService: { getUserBindersWithStats: vi.fn() },
  deckService: { listUserDecksBasic: vi.fn() },
  wantsService: { getTotalWantsQuantity: vi.fn() },
  gameResultsService: { getRecentGameResultsForUser: vi.fn() },
}));

import {
  buildSuggestedPrompts,
  getVolzarSuggestedPrompts,
  DEFAULT_SUGGESTED_PROMPTS,
  type VolzarUserState,
} from './volzar-suggestions';
import { binderService, deckService, wantsService, gameResultsService } from '@/lib/services';

const mockBinders = vi.mocked(binderService.getUserBindersWithStats);
const mockDecks = vi.mocked(deckService.listUserDecksBasic);
const mockWants = vi.mocked(wantsService.getTotalWantsQuantity);
const mockRecent = vi.mocked(gameResultsService.getRecentGameResultsForUser);

const emptyState: VolzarUserState = {
  collectionCards: 0,
  deckCount: 0,
  wantsCount: 0,
  recentGames: [],
};

const game = (hero: string | null, result: 'win' | 'loss', deckName = 'My Deck') =>
  ({ hero, result, deckName });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildSuggestedPrompts', () => {
  it('always returns exactly 4 prompts with the meta prompt first', () => {
    const prompts = buildSuggestedPrompts(emptyState);
    expect(prompts).toHaveLength(4);
    expect(prompts[0].text).toMatch(/top decks in the meta/i);
  });

  it('gives a brand-new user onboarding prompts instead of collection-dependent ones', () => {
    const prompts = buildSuggestedPrompts(emptyState);
    const texts = prompts.map((p) => p.text).join(' | ');
    expect(texts).not.toMatch(/my collection/i);
    expect(texts).not.toMatch(/my decks/i);
    expect(texts).not.toMatch(/my wants/i);
    expect(texts).toMatch(/budget hero|new to Flesh and Blood/i);
  });

  it('shows the Decks-to-Beat coverage prompt when the collection is non-trivial', () => {
    const prompts = buildSuggestedPrompts({ ...emptyState, collectionCards: 500 });
    expect(prompts.some((p) => p.text.match(/Decks to Beat.*my collection/i))).toBe(true);
  });

  it('keeps the coverage prompt out for near-empty collections (< 20 cards)', () => {
    const prompts = buildSuggestedPrompts({ ...emptyState, collectionCards: 5 });
    expect(prompts.some((p) => p.text.match(/my collection/i))).toBe(false);
  });

  it('personalizes the results prompt with the recent record of the most-played hero', () => {
    const prompts = buildSuggestedPrompts({
      ...emptyState,
      recentGames: [
        game('Fai', 'win'), game('Fai', 'loss'), game('Fai', 'win'), game('Fai', 'win'),
        game('Kano', 'loss'),
      ],
    });
    const personalized = prompts.find((p) => p.text.includes('3-1'));
    expect(personalized).toBeDefined();
    expect(personalized!.text).toContain('Fai');
  });

  it('breaks most-played-hero ties toward the most recent game (first in the list)', () => {
    const prompts = buildSuggestedPrompts({
      ...emptyState,
      recentGames: [game('Kano', 'win'), game('Fai', 'loss')],
    });
    const personalized = prompts.find((p) => p.text.includes('1-0'));
    expect(personalized).toBeDefined();
    expect(personalized!.text).toContain('Kano');
  });

  it('falls back to the deck name when the top hero is unknown', () => {
    const prompts = buildSuggestedPrompts({
      ...emptyState,
      recentGames: [game(null, 'win', 'Spicy Kayo'), game(null, 'loss', 'Spicy Kayo')],
    });
    const personalized = prompts.find((p) => p.text.includes('1-1'));
    expect(personalized).toBeDefined();
    expect(personalized!.text).toContain('Spicy Kayo');
  });

  it('suggests reviewing decks when the user has decks but no recent games', () => {
    const prompts = buildSuggestedPrompts({ ...emptyState, deckCount: 3 });
    expect(prompts.some((p) => p.text.match(/my decks/i))).toBe(true);
  });

  it('offers the wants-list trade prompt only when the wants list is non-empty', () => {
    const withWants = buildSuggestedPrompts({ ...emptyState, wantsCount: 7 });
    expect(withWants.some((p) => p.text.match(/wants list/i))).toBe(true);
    const withoutWants = buildSuggestedPrompts(emptyState);
    expect(withoutWants.some((p) => p.text.match(/wants list/i))).toBe(false);
  });

  it('never emits duplicate prompt texts', () => {
    for (const state of [
      emptyState,
      { collectionCards: 100, deckCount: 2, wantsCount: 3, recentGames: [game('Fai', 'win')] },
    ] as VolzarUserState[]) {
      const texts = buildSuggestedPrompts(state).map((p) => p.text);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });
});

describe('getVolzarSuggestedPrompts', () => {
  it('aggregates service data into personalized prompts', async () => {
    mockBinders.mockResolvedValue({
      success: true,
      data: [
        { stats: { totalQuantity: 300 } },
        { stats: { totalQuantity: 50 } },
      ],
    } as any);
    mockDecks.mockResolvedValue({ success: true, data: [{}, {}] } as any);
    mockWants.mockResolvedValue({ success: true, data: 9 } as any);
    mockRecent.mockResolvedValue({
      success: true,
      data: [
        { playerHero: 'Fai', result: 'win', deckName: 'Fai Aggro' },
        { playerHero: 'Fai', result: 'loss', deckName: 'Fai Aggro' },
      ],
    } as any);

    const prompts = await getVolzarSuggestedPrompts('user-1');

    expect(prompts).toHaveLength(4);
    expect(prompts.some((p) => p.text.match(/Decks to Beat.*my collection/i))).toBe(true);
    expect(prompts.some((p) => p.text.includes('1-1') && p.text.includes('Fai'))).toBe(true);
    expect(prompts.some((p) => p.text.match(/wants list/i))).toBe(true);
  });

  it('returns the default prompts when every lookup fails (never throws)', async () => {
    mockBinders.mockRejectedValue(new Error('db down'));
    mockDecks.mockResolvedValue({ success: false, error: 'nope' } as any);
    mockWants.mockRejectedValue(new Error('db down'));
    mockRecent.mockResolvedValue({ success: false, error: 'nope' } as any);

    const prompts = await getVolzarSuggestedPrompts('user-1');

    expect(prompts).toEqual(DEFAULT_SUGGESTED_PROMPTS);
  });

  it('treats individual failures as empty state rather than failing the whole build', async () => {
    mockBinders.mockResolvedValue({ success: true, data: [{ stats: { totalQuantity: 100 } }] } as any);
    mockDecks.mockRejectedValue(new Error('db down'));
    mockWants.mockResolvedValue({ success: true, data: 0 } as any);
    mockRecent.mockResolvedValue({ success: true, data: [] } as any);

    const prompts = await getVolzarSuggestedPrompts('user-1');

    expect(prompts.some((p) => p.text.match(/Decks to Beat.*my collection/i))).toBe(true);
    expect(prompts).toHaveLength(4);
  });
});
