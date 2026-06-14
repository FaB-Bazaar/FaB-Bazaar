/**
 * Unit tests for GET (preview) + POST (apply) /api/decks/[deckId]/convert-language.
 * deckService + auth mocked — no DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: {
    convertDeckToLanguage: vi.fn(),
    applyPrintingUpgrades: vi.fn(),
  },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

import { GET, POST } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockConvert = vi.mocked(deckService.convertDeckToLanguage);
const mockApply = vi.mocked(deckService.applyPrintingUpgrades);
const mockAuth = vi.mocked(authenticateRequest);

const DECK_ID = 'deck-123';
const params = () => Promise.resolve({ deckId: DECK_ID });
const getReq = (lang = 'fr') =>
  new NextRequest(`http://localhost/api/decks/${DECK_ID}/convert-language?language=${lang}`);
const postReq = (body: unknown) =>
  new NextRequest(`http://localhost/api/decks/${DECK_ID}/convert-language`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const PLAN = {
  targetLanguage: 'fr',
  swaps: [{ currentPrintingId: 'a', newPrintingId: 'b', category: 'maindeck' }],
  skipped: [{ printingId: 'c', cardName: 'X', reason: 'no matching printing' }],
};

beforeEach(() => vi.clearAllMocks());

describe('GET (preview)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    const res = await GET(getReq(), { params: params() });
    expect(res.status).toBe(401);
  });

  it('returns the conversion plan for the requested language', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockConvert.mockResolvedValue({ success: true, data: PLAN } as any);
    const res = await GET(getReq('fr'), { params: params() });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.swaps).toHaveLength(1);
    expect(json.data.skipped).toHaveLength(1);
    expect(mockConvert).toHaveBeenCalledWith(DECK_ID, 'u1', 'fr');
  });
});

describe('POST (apply)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'no' } as any);
    const res = await POST(postReq({ targetLanguage: 'fr' }), { params: params() });
    expect(res.status).toBe(401);
  });

  it('plans server-side then applies only the swaps', async () => {
    mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as any);
    mockConvert.mockResolvedValue({ success: true, data: PLAN } as any);
    mockApply.mockResolvedValue({ success: true, data: { swapped: 1, errors: [] } } as any);
    const res = await POST(postReq({ targetLanguage: 'fr' }), { params: params() });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.swapped).toBe(1);
    expect(mockApply).toHaveBeenCalledWith(DECK_ID, 'u1', PLAN.swaps);
  });
});
