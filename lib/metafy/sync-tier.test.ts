/**
 * Unit tests for the lazy supporter-tier refresh. Mocks the service layer,
 * the token helper, and global fetch — no DB, no real HTTP. Asserts the
 * throttling (TTL) and the never-revoke-on-transient-failure guarantees.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  userService: {
    getSupporterSyncContext: vi.fn(),
    saveMetafyCommunities: vi.fn(),
    setMetafySupporterTier: vi.fn(),
  },
}));
vi.mock('./tokens', () => ({ getValidMetafyAccessToken: vi.fn() }));

import { syncSupporterTierIfStale } from './sync-tier';
import { userService } from '@/lib/services';
import { getValidMetafyAccessToken } from './tokens';

const mockCtx = vi.mocked(userService.getSupporterSyncContext);
const mockSaveCommunities = vi.mocked(userService.saveMetafyCommunities);
const mockSetTier = vi.mocked(userService.setMetafySupporterTier);
const mockToken = vi.mocked(getValidMetafyAccessToken);

// Real FaB community + Core Contributor paid tier (matches .env.local test env).
const COMMUNITY_ID = 'd357fde3-bc31-45ef-8744-c2ed9e223d08';
const PAID_TIER_ID = 'ac86e128-327f-4256-9f9d-7625e82fa2d7';
const FREE_TIER_ID = '8b5a24e5-b9a6-4aac-abe6-91ffbac95cc8';

const NOW = 1_700_000_000_000;
const staleAt = new Date(NOW - 2 * 60 * 60 * 1000); // 2h old (> 1h TTL)
const freshAt = new Date(NOW - 5 * 60 * 1000); // 5m old (< 1h TTL)

function mockMemberships(tierId: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      communities: [{ id: COMMUNITY_ID, title: 'FaB Bazaar Community', tiers: [{ id: tierId, name: 'x' }] }],
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mockToken.mockResolvedValue('valid-token');
  mockSaveCommunities.mockResolvedValue({ success: true, data: undefined });
  mockSetTier.mockResolvedValue({ success: true, data: undefined });
});

describe('syncSupporterTierIfStale', () => {
  it('does nothing for a user with no linked Metafy account', async () => {
    mockCtx.mockResolvedValue({ success: true, data: { linked: false, syncedAt: null } });
    const fetchMock = mockMemberships(PAID_TIER_ID);

    await syncSupporterTierIfStale('u1', NOW);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockSetTier).not.toHaveBeenCalled();
  });

  it('skips the Metafy call when the cache is fresh (within TTL)', async () => {
    mockCtx.mockResolvedValue({ success: true, data: { linked: true, syncedAt: freshAt } });
    const fetchMock = mockMemberships(PAID_TIER_ID);

    await syncSupporterTierIfStale('u1', NOW);

    expect(mockToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockSetTier).not.toHaveBeenCalled();
  });

  it('re-syncs and keeps paid when a stale supporter still holds the paid tier', async () => {
    mockCtx.mockResolvedValue({ success: true, data: { linked: true, syncedAt: staleAt } });
    mockMemberships(PAID_TIER_ID);

    await syncSupporterTierIfStale('u1', NOW);

    expect(mockSaveCommunities).toHaveBeenCalledOnce();
    expect(mockSetTier).toHaveBeenCalledWith('u1', 'paid');
  });

  it('downgrades a stale supporter who dropped to the free tier', async () => {
    mockCtx.mockResolvedValue({ success: true, data: { linked: true, syncedAt: staleAt } });
    mockMemberships(FREE_TIER_ID);

    await syncSupporterTierIfStale('u1', NOW);

    expect(mockSetTier).toHaveBeenCalledWith('u1', 'free');
  });

  it('re-syncs when linked but never synced before (syncedAt null)', async () => {
    mockCtx.mockResolvedValue({ success: true, data: { linked: true, syncedAt: null } });
    mockMemberships(PAID_TIER_ID);

    await syncSupporterTierIfStale('u1', NOW);

    expect(mockSetTier).toHaveBeenCalledWith('u1', 'paid');
  });

  it('does NOT revoke when the token cannot be obtained', async () => {
    mockCtx.mockResolvedValue({ success: true, data: { linked: true, syncedAt: staleAt } });
    mockToken.mockResolvedValue(null);
    mockMemberships(PAID_TIER_ID);

    await syncSupporterTierIfStale('u1', NOW);

    expect(mockSetTier).not.toHaveBeenCalled();
  });

  it('does NOT revoke when the Metafy fetch returns a non-2xx', async () => {
    mockCtx.mockResolvedValue({ success: true, data: { linked: true, syncedAt: staleAt } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await syncSupporterTierIfStale('u1', NOW);

    expect(mockSetTier).not.toHaveBeenCalled();
  });

  it('does NOT revoke when the Metafy fetch throws (network error)', async () => {
    mockCtx.mockResolvedValue({ success: true, data: { linked: true, syncedAt: staleAt } });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    await syncSupporterTierIfStale('u1', NOW);

    expect(mockSetTier).not.toHaveBeenCalled();
  });
});
