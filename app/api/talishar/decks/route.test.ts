// Route unit test for GET /api/talishar/decks hero resolution.
//
// Regression: the endpoint resolved the Talishar hero id from the free-text
// decks.heroName column first. Short/lowercase labels ("victor goldmane") or
// young-hero nicknames that collide with the adult printing produced a wrong or
// missing hero. It must resolve from the deck's actual hero CARD (canonical
// display_name) first, falling back to heroName only when no hero card exists.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/middleware/talishar-auth', () => ({
  validateTalisharRequest: vi.fn(async () => ({ valid: true })),
  validateTalisharHmac: vi.fn(() => ({ valid: true })),
}));
vi.mock('@/lib/services', () => ({
  userService: {
    findByMetafyId: vi.fn(),
    getMetafyCommunities: vi.fn(async () => ({ success: true, data: [] })),
  },
  deckService: { listUserDecks: vi.fn() },
}));
vi.mock('@/lib/metafy/communities', () => ({
  hasTalisharMembership: vi.fn(() => true),
  hasFabBazaarMembership: vi.fn(() => true),
}));

import { GET } from './route';
import { userService, deckService } from '@/lib/services';

const mockFindByMetafyId = vi.mocked(userService.findByMetafyId);
const mockListUserDecks = vi.mocked(deckService.listUserDecks);

function req() {
  return new Request('https://x/api/talishar/decks?metafyId=m1') as any;
}

function deckWith(opts: { heroName?: string; heroCardName?: string }) {
  return {
    publicId: 'pub1',
    name: 'Deck 1',
    format: 'Classic Constructed',
    heroName: opts.heroName,
    hero: opts.heroCardName
      ? [{ printingDetails: { display_name: opts.heroCardName, name: opts.heroCardName } }]
      : [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindByMetafyId.mockResolvedValue({ success: true, data: { id: 'u1' } } as any);
});

describe('GET /api/talishar/decks hero resolution', () => {
  it('resolves the hero from the hero card when heroName is a colliding young nickname', async () => {
    // Stored label is the young nickname (maps to HVY048), but the deck's actual
    // hero card is the adult printing → must resolve to the adult id HVY047.
    mockListUserDecks.mockResolvedValue({
      success: true,
      data: { total: 1, decks: [deckWith({ heroName: 'Victor Goldmane', heroCardName: 'Victor Goldmane, High and Mighty' })] },
    } as any);

    const res = await GET(req());
    const body = await res.json();
    expect(body.decks[0].hero).toBe('HVY047');
  });

  it('resolves a hero whose short heroName is not a map key (Ira)', async () => {
    mockListUserDecks.mockResolvedValue({
      success: true,
      data: { total: 1, decks: [deckWith({ heroName: 'Ira', heroCardName: 'Ira, Crimson Haze' })] },
    } as any);

    const res = await GET(req());
    const body = await res.json();
    expect(body.decks[0].hero).toBe('CRU046');
  });

  it('falls back to heroName when the deck has no hero card', async () => {
    mockListUserDecks.mockResolvedValue({
      success: true,
      data: { total: 1, decks: [deckWith({ heroName: 'Verdance' })] },
    } as any);

    const res = await GET(req());
    const body = await res.json();
    expect(body.decks[0].hero).toBe('ROS014');
  });
});
