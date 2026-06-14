import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/services', () => ({
  inventoryService: { getWhoHasPrintings: vi.fn(), getWhoHasCards: vi.fn() },
  locationService: { getUserFollowedStores: vi.fn() },
}));
vi.mock('@/auth', () => ({ auth: vi.fn() }));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { inventoryService, locationService } from '@/lib/services';
import { auth } from '@/auth';

const mockGetWhoHasPrintings = vi.mocked(inventoryService.getWhoHasPrintings);
const mockGetUserFollowedStores = vi.mocked(locationService.getUserFollowedStores);
const mockAuth = vi.mocked(auth);

const OK_RESULT = {
  success: true as const,
  data: {
    requested_ids: ['p1'],
    search_mode: 'specific_printings' as const,
    summary: {} as any,
    metadata: {} as any,
    owners: [],
  },
};

function req(qs: string) {
  return { url: `http://localhost/api/whohas?${qs}` } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetWhoHasPrintings.mockResolvedValue(OK_RESULT);
});

describe('GET /api/whohas — followedStoresOnly', () => {
  it('passes the viewer\'s followed store IDs to the service when authenticated with stores', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockGetUserFollowedStores.mockResolvedValue({
      success: true,
      data: [{ id: 'store-a' }, { id: 'store-b' }] as any,
    });

    const res = await GET(req('printingIds=p1&followedStoresOnly=true'));
    expect(res.status).toBe(200);
    expect(mockGetWhoHasPrintings).toHaveBeenCalledTimes(1);
    const filters = mockGetWhoHasPrintings.mock.calls[0][1]!;
    expect(filters.followedStoreIds).toEqual(['store-a', 'store-b']);
  });

  it('falls back to everyone (no filter) when the viewer follows no stores', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    mockGetUserFollowedStores.mockResolvedValue({ success: true, data: [] });

    const res = await GET(req('printingIds=p1&followedStoresOnly=true'));
    expect(res.status).toBe(200);
    const filters = mockGetWhoHasPrintings.mock.calls[0][1]!;
    expect(filters.followedStoreIds).toBeUndefined();
  });

  it('falls back to everyone (no 401) when logged out', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET(req('printingIds=p1&followedStoresOnly=true'));
    expect(res.status).toBe(200);
    expect(mockGetUserFollowedStores).not.toHaveBeenCalled();
    const filters = mockGetWhoHasPrintings.mock.calls[0][1]!;
    expect(filters.followedStoreIds).toBeUndefined();
  });

  it('does not filter by stores when followedStoresOnly is absent', async () => {
    const res = await GET(req('printingIds=p1'));
    expect(res.status).toBe(200);
    expect(mockAuth).not.toHaveBeenCalled();
    const filters = mockGetWhoHasPrintings.mock.calls[0][1]!;
    expect(filters.followedStoreIds).toBeUndefined();
  });
});
