/**
 * Unit tests for GET /api/collectibles
 *
 * Mocked service + auth. The list is PUBLIC: an unauthenticated caller gets
 * 200 with no viewer marks; an authenticated caller's userId is forwarded so
 * the service can resolve viewerStatus.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  collectibleService: {
    listCollectibles: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { GET } from './route';
import { collectibleService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockList = vi.mocked(collectibleService.listCollectibles);
const mockAuth = vi.mocked(authenticateRequest);

const makeRequest = (query = '') =>
  new NextRequest(`http://localhost/api/collectibles${query}`);

const sampleItem = {
  id: 'c-1',
  kind: 'playmat',
  name: 'Prism Worlds Mat',
  description: null,
  imageUrl: null,
  artist: 'Artist',
  source: 'Worlds 2026',
  year: 2026,
  haveCount: 3,
  wantCount: 1,
  viewerStatus: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/collectibles', () => {
  it('returns 200 for an anonymous caller (public route, no viewer)', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    mockList.mockResolvedValue({ success: true, data: [sampleItem] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(mockList).toHaveBeenCalledWith(expect.anything(), null);
  });

  it('forwards the authenticated viewer id to the service', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'user-42' } as any);
    mockList.mockResolvedValue({ success: true, data: [] } as any);

    await GET(makeRequest());

    expect(mockList).toHaveBeenCalledWith(expect.anything(), 'user-42');
  });

  it('parses kind/year/search query params into filters', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    mockList.mockResolvedValue({ success: true, data: [] } as any);

    await GET(makeRequest('?kind=playmat&year=2026&search=prism'));

    expect(mockList).toHaveBeenCalledWith(
      { kind: 'playmat', year: 2026, search: 'prism' },
      null,
    );
  });

  it('returns 500 when the service fails', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    mockList.mockResolvedValue({ success: false, error: 'boom' } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('boom');
  });
});
