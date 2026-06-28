import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ gameResultsService: { getRecentGameResultsForUser: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET } from './route';
import { gameResultsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockRecent = vi.mocked(gameResultsService.getRecentGameResultsForUser);
const req = (url = 'http://t/api/results/recent') => ({ url } as Parameters<typeof GET>[0]);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as never);
});

describe('GET /api/results/recent', () => {
  it('401s when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as never);
    expect((await GET(req())).status).toBe(401);
  });

  it('returns the caller’s recent games across all their decks (clamped limit)', async () => {
    mockRecent.mockResolvedValue({ success: true, data: [{ id: 'g1', deckName: 'Teklosaucen' }] } as never);
    const res = await GET(req('http://t/api/results/recent?limit=5'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data[0].deckName).toBe('Teklosaucen');
    expect(mockRecent).toHaveBeenCalledWith('u1', 5);
  });
});
