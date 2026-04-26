/**
 * Unit tests for GET /api/decks/user — focused on the navbar pin flow.
 *
 * - ?pinned=true + user has pinned decks → returns only pinned, hasPinned: true
 * - ?pinned=true + user has no pinned decks → falls back to all, hasPinned: false
 * - hasPinned is always present in the response
 *
 * Service is mocked; this exercises HTTP / response-shape concerns only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({
  deckService: { listUserDecksBasic: vi.fn() },
  userService: { getUsersByIds: vi.fn() },
}));

import { GET } from './route';
import { auth } from '@/auth';
import { deckService } from '@/lib/services';

const mockAuth = vi.mocked(auth);
const mockListDecks = vi.mocked(deckService.listUserDecksBasic);

const makeRequest = (qs = '') =>
  new NextRequest(`http://localhost/api/decks/user${qs}`);

const deckSummary = (overrides: Partial<{ _id: string; pinnedInNav: boolean; availableOnTalishar: boolean }>) => ({
  _id: overrides._id ?? `d-${Math.random()}`,
  publicId: overrides._id ?? `pub-${Math.random()}`,
  userId: 'user-123',
  name: 'Test Deck',
  format: 'Classic Constructed' as const,
  visibility: 'unlisted' as const,
  isPublic: true,
  pinnedInNav: overrides.pinnedInNav ?? false,
  availableOnTalishar: overrides.availableOnTalishar ?? true,
  isCoOwned: false,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-123' } } as any);
});

describe('GET /api/decks/user — pinned flow', () => {
  it('?pinned=true returns only pinned decks and hasPinned:true when user has pinned decks', async () => {
    const pinned1 = deckSummary({ _id: 'pin-1', pinnedInNav: true });
    const pinned2 = deckSummary({ _id: 'pin-2', pinnedInNav: true });
    const unpinned = deckSummary({ _id: 'unp-1', pinnedInNav: false });
    mockListDecks.mockResolvedValue({ success: true, data: [pinned1, unpinned, pinned2] } as any);

    const res = await GET(makeRequest('?pinned=true'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.hasPinned).toBe(true);
    expect(body.decks.map((d: any) => d._id).sort()).toEqual(['pin-1', 'pin-2']);
  });

  it('?pinned=true falls back to all decks and hasPinned:false when user has no pinned decks', async () => {
    const a = deckSummary({ _id: 'a', pinnedInNav: false });
    const b = deckSummary({ _id: 'b', pinnedInNav: false });
    mockListDecks.mockResolvedValue({ success: true, data: [a, b] } as any);

    const res = await GET(makeRequest('?pinned=true'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.hasPinned).toBe(false);
    expect(body.decks).toHaveLength(2);
  });

  it('hasPinned is present even without ?pinned=true', async () => {
    const pinned = deckSummary({ _id: 'pin-1', pinnedInNav: true });
    mockListDecks.mockResolvedValue({ success: true, data: [pinned] } as any);

    const res = await GET(makeRequest(''));
    const body = await res.json();

    expect(body.hasPinned).toBe(true);
  });
});
