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
import { QUICK_ACTIONS } from './quick-actions';
import { decksClient } from '@/lib/client';

const mockGetUserDecks = vi.mocked(decksClient.getUserDecks);

beforeEach(() => {
  vi.clearAllMocks();
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
