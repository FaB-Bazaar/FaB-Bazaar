/**
 * Route unit tests for POST /api/decks/coverage — batch collection-coverage
 * summaries for a list of deck publicIds (backs the
 * compare_collection_to_decks_to_beat MCP tool). Mocked service, no DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ deckService: { getDecksCoverageSummary: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

// Import AFTER mocks (vi.mock is hoisted)
import { POST } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockCoverage = vi.mocked(deckService.getDecksCoverageSummary);
const mockAuth = vi.mocked(authenticateRequest);

const makeReq = (body: unknown) =>
  new NextRequest('http://localhost/api/decks/coverage', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/decks/coverage', () => {
  it('401s when authentication fails', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);
    const res = await POST(makeReq({ deckIds: ['abc'] }));
    expect(res.status).toBe(401);
  });

  it('authenticates with allowOAuth (MCP/Volzar callers)', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockCoverage.mockResolvedValue({ success: true, data: [] } as any);
    await POST(makeReq({ deckIds: ['abc'] }));
    expect(mockAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ allowOAuth: true }),
    );
  });

  it('400s on a missing/empty deckIds array', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(mockCoverage).not.toHaveBeenCalled();
  });

  it('passes deckIds + userId through and returns the summaries', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    const rows = [{ publicId: 'abc', deckName: 'D', coveragePct: 80 }];
    mockCoverage.mockResolvedValue({ success: true, data: rows } as any);

    const res = await POST(makeReq({ deckIds: ['abc', 'def'] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: rows });
    expect(mockCoverage).toHaveBeenCalledWith(
      ['abc', 'def'],
      'u1',
      expect.objectContaining({ matchBy: 'card' }),
    );
  });

  it('surfaces service errors as 400 (e.g. too many decks)', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockCoverage.mockResolvedValue({ success: false, error: 'Too many decks (max 30 per call)' } as any);
    const res = await POST(makeReq({ deckIds: ['a'] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Too many/);
  });
});
