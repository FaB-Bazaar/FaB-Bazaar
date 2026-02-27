import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// Mock binderService
const mockBinderService = {
  findBinderByIdOrSlug: vi.fn(),
  getBinderCards: vi.fn(),
  addCardsToBinder: vi.fn(),
  getOrCreateBinderBySlug: vi.fn(),
};

vi.mock('@/lib/services', () => ({
  binderService: mockBinderService,
  printingsService: {
    getPrintingsByIds: vi.fn().mockResolvedValue({ success: true, data: { printings: [] } }),
  },
}));

// Mock next-auth to prevent module resolution issues
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn().mockResolvedValue({ success: false }),
  AuthResult: {},
}));

vi.mock('@/lib/discord/discord-webhooks', () => ({
  DiscordWebhooks: {
    sendBinderUpdate: vi.fn(),
  },
}));

describe('/api/binders/[binderId]/cards API Route', () => {

  const MOCK_BINDER_ID = '68acbd2c27d38b1af2694536';
  const createMockRequest = (url: string) => new NextRequest(`http://localhost${url}`);

  beforeEach(() => { 
    vi.clearAllMocks();
  });

  const mockCards = [ 
    { 
      _id: '1',
      id: 'card-1',
      name: 'Card A', 
      quantity: 2,
      condition: 'mint',
      forTrade: true,
      printingDetails: { 
        rarity: 'common',
        foiling: 'standard',
        set_id: 'set1',
        tcg_market: 10
      } 
    }, 
    { 
      _id: '2',
      id: 'card-2',
      name: 'Card B', 
      quantity: 1,
      condition: 'near-mint',
      forTrade: false,
      printingDetails: { 
        rarity: 'rare',
        foiling: 'foil',
        set_id: 'set2',
        tcg_market: 25
      } 
    }, 
    { 
      _id: '3',
      id: 'card-3',
      name: 'Card C', 
      quantity: 3,
      condition: 'played',
      forTrade: true,
      printingDetails: { 
        rarity: 'legendary',
        foiling: 'standard',
        set_id: 'set1',
        tcg_market: 50
      } 
    } 
  ];

  const mockBeastWithin = { 
    _id: '4',
    id: 'card-4',
    name: 'beast within', 
    quantity: 1,
    condition: 'mint',
    forTrade: false,
    printingDetails: { 
      rarity: 'common',
      foiling: 'standard',
      set_id: 'wtr',
      tcg_market: 5
    } 
  };

  it('should return paginated cards with no filters', async () => {
    // Mock findBinderByIdOrSlug to return a public binder
    mockBinderService.findBinderByIdOrSlug.mockResolvedValueOnce({
      success: true,
      data: {
        _id: MOCK_BINDER_ID,
        name: 'Test Binder',
        userId: 'user123',
        visibility: { level: 'public' },
      },
    });

    // Mock getBinderCards to return cards with pagination/metadata
    mockBinderService.getBinderCards.mockResolvedValueOnce({
      success: true,
      data: {
        cards: mockCards.slice(0, 2),
        pagination: { page: 1, limit: 2, totalPages: 2, totalItems: 3 },
        metadata: {
          counts: { forTrade: 2, notForTrade: 1 },
          rarities: [{ _id: 'common', count: 1 }, { _id: 'rare', count: 1 }],
          foilings: [{ _id: 'standard', count: 2 }],
          sets: [{ _id: 'set1', count: 2 }],
          conditions: [{ _id: 'mint', count: 1 }],
        },
      },
    });

    const request = createMockRequest(`/api/binders/${MOCK_BINDER_ID}/cards?page=1&limit=2`);
    const response = await GET(request, { params: Promise.resolve({ binderId: MOCK_BINDER_ID }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cards.length).toBe(2);
    expect(data.pagination.totalCards).toBe(3);
    expect(data.metadata.counts.forTrade).toBe(2);
    expect(data.metadata.counts.notForTrade).toBe(1);
  });

  it('should pass filters to binderService.getBinderCards', async () => {
    mockBinderService.findBinderByIdOrSlug.mockResolvedValueOnce({
      success: true,
      data: {
        _id: MOCK_BINDER_ID,
        name: 'Test Binder',
        userId: 'user123',
        visibility: { level: 'public' },
      },
    });

    mockBinderService.getBinderCards.mockResolvedValueOnce({
      success: true,
      data: {
        cards: [mockBeastWithin],
        pagination: { page: 1, limit: 48, totalPages: 1, totalItems: 1 },
        metadata: {
          counts: { forTrade: 0, notForTrade: 1 },
          rarities: [{ _id: 'common', count: 1 }],
          foilings: [{ _id: 'r', count: 1 }],
          sets: [{ _id: 'wtr', count: 1 }],
          conditions: [{ _id: 'mint', count: 1 }],
        },
      },
    });

    const request = createMockRequest(`/api/binders/${MOCK_BINDER_ID}/cards?foiling=r&set=wtr`);
    await GET(request, { params: Promise.resolve({ binderId: MOCK_BINDER_ID }) });

    // Verify getBinderCards was called with correct filters
    expect(mockBinderService.getBinderCards).toHaveBeenCalledWith(
      MOCK_BINDER_ID,
      expect.objectContaining({ foiling: 'r', set: 'wtr' }),
      expect.any(Object)
    );
  });

  it('should pass sortBy option to binderService.getBinderCards', async () => {
    mockBinderService.findBinderByIdOrSlug.mockResolvedValueOnce({
      success: true,
      data: {
        _id: MOCK_BINDER_ID,
        name: 'Test Binder',
        userId: 'user123',
        visibility: { level: 'public' },
      },
    });

    mockBinderService.getBinderCards.mockResolvedValueOnce({
      success: true,
      data: {
        cards: mockCards,
        pagination: { page: 1, limit: 48, totalPages: 1, totalItems: 3 },
        metadata: { counts: { forTrade: 2, notForTrade: 1 }, rarities: [], foilings: [], sets: [], conditions: [] },
      },
    });

    const request = createMockRequest(`/api/binders/${MOCK_BINDER_ID}/cards?sortBy=name`);
    await GET(request, { params: Promise.resolve({ binderId: MOCK_BINDER_ID }) });

    expect(mockBinderService.getBinderCards).toHaveBeenCalledWith(
      MOCK_BINDER_ID,
      expect.any(Object),
      expect.objectContaining({ sortBy: 'name' })
    );
  });

  it('should pass search filter to binderService.getBinderCards', async () => {
    mockBinderService.findBinderByIdOrSlug.mockResolvedValueOnce({
      success: true,
      data: {
        _id: MOCK_BINDER_ID,
        name: 'Test Binder',
        userId: 'user123',
        visibility: { level: 'public' },
      },
    });

    mockBinderService.getBinderCards.mockResolvedValueOnce({
      success: true,
      data: {
        cards: [mockBeastWithin],
        pagination: { page: 1, limit: 48, totalPages: 1, totalItems: 1 },
        metadata: { counts: { forTrade: 0, notForTrade: 1 }, rarities: [], foilings: [], sets: [], conditions: [] },
      },
    });

    const request = createMockRequest(`/api/binders/${MOCK_BINDER_ID}/cards?search=beast`);
    const response = await GET(request, { params: Promise.resolve({ binderId: MOCK_BINDER_ID }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cards.length).toBe(1);
    expect(mockBinderService.getBinderCards).toHaveBeenCalledWith(
      MOCK_BINDER_ID,
      expect.objectContaining({ search: 'beast' }),
      expect.any(Object)
    );
  });

  it('should pass forTrade filter to binderService.getBinderCards', async () => {
    mockBinderService.findBinderByIdOrSlug.mockResolvedValueOnce({
      success: true,
      data: {
        _id: MOCK_BINDER_ID,
        name: 'Test Binder',
        userId: 'user123',
        visibility: { level: 'public' },
      },
    });

    const forTradeCards = mockCards.filter(c => c.forTrade);
    mockBinderService.getBinderCards.mockResolvedValueOnce({
      success: true,
      data: {
        cards: forTradeCards,
        pagination: { page: 1, limit: 48, totalPages: 1, totalItems: 2 },
        metadata: { counts: { forTrade: 2, notForTrade: 0 }, rarities: [], foilings: [], sets: [], conditions: [] },
      },
    });

    const request = createMockRequest(`/api/binders/${MOCK_BINDER_ID}/cards?forTrade=true`);
    const response = await GET(request, { params: Promise.resolve({ binderId: MOCK_BINDER_ID }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cards.length).toBe(2);
    expect(mockBinderService.getBinderCards).toHaveBeenCalledWith(
      MOCK_BINDER_ID,
      expect.objectContaining({ forTrade: true }),
      expect.any(Object)
    );
  });

  it('should handle slug-based binder lookup (non-ObjectId treated as slug)', async () => {
    // Non-ObjectId identifiers are now treated as slugs, not rejected
    mockBinderService.findBinderByIdOrSlug.mockResolvedValueOnce({
      success: true,
      data: null, // Binder not found by slug
    });

    const request = createMockRequest(`/api/binders/my-binder-slug/cards`);
    const response = await GET(request, { params: Promise.resolve({ binderId: 'my-binder-slug' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Binder not found');
    expect(mockBinderService.findBinderByIdOrSlug).toHaveBeenCalledWith('my-binder-slug');
  });

  it('should handle empty results gracefully', async () => {
    mockBinderService.findBinderByIdOrSlug.mockResolvedValueOnce({
      success: true,
      data: {
        _id: MOCK_BINDER_ID,
        name: 'Test Binder',
        userId: 'user123',
        visibility: { level: 'public' },
      },
    });

    mockBinderService.getBinderCards.mockResolvedValueOnce({
      success: true,
      data: {
        cards: [],
        pagination: { page: 1, limit: 48, totalPages: 0, totalItems: 0 },
        metadata: { counts: { forTrade: 0, notForTrade: 0 }, rarities: [], foilings: [], sets: [], conditions: [] },
      },
    });

    const request = createMockRequest(`/api/binders/${MOCK_BINDER_ID}/cards?search=nonexistent`);
    const response = await GET(request, { params: Promise.resolve({ binderId: MOCK_BINDER_ID }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cards).toEqual([]);
    expect(data.pagination.totalCards).toBe(0);
    expect(data.metadata.counts.forTrade).toBe(0);
    expect(data.metadata.counts.notForTrade).toBe(0);
  });

  it('should deny access to private binders for non-owners', async () => {
    mockBinderService.findBinderByIdOrSlug.mockResolvedValueOnce({
      success: true,
      data: {
        _id: MOCK_BINDER_ID,
        name: 'Private Binder',
        userId: 'other-user-id',
        visibility: { level: 'private' },
        isPublic: false,
      },
    });

    const request = createMockRequest(`/api/binders/${MOCK_BINDER_ID}/cards`);
    const response = await GET(request, { params: Promise.resolve({ binderId: MOCK_BINDER_ID }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Access denied: This binder is private');
  });
});