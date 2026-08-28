/**
 * Unit tests for POST /api/admin/printings/ingest (superadmin remote set ingest).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  ingestService: {
    ingestSetRows: vi.fn(),
  },
  userService: {
    hasRole: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { POST } from './route';
import { ingestService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockIngest = vi.mocked(ingestService.ingestSetRows);
const mockHasRole = vi.mocked(userService.hasRole);
const mockAuth = vi.mocked(authenticateRequest);

const makePost = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/printings/ingest', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const validBody = {
  set: 'iar',
  cards: [{ card_unique_id: 'local1', name: 'x', display_name: 'X', talishar_card_id: 'x-red' }],
  printings: [{ printing_id: 'lp1', card_unique_id: 'local1', set: 'iar', edition: 'n', foiling: 's', rarity: 'r', language: 'en' }],
};

const counts = {
  dryRun: false,
  cardsCreated: 1, cardsEnriched: 0, cardsMatched: 0,
  printingsCreated: 1, printingsSkipped: 0,
  faceLinksSet: 0, translationsUpserted: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-user' } as any);
  mockHasRole.mockResolvedValue({ success: true, data: true } as any);
  mockIngest.mockResolvedValue({ success: true, data: counts } as any);
});

describe('POST /api/admin/printings/ingest', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(401);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-superadmin', async () => {
    mockHasRole.mockResolvedValue({ success: true, data: false } as any);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(403);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('returns 400 when set is missing', async () => {
    const res = await POST(makePost({ ...validBody, set: undefined }));
    expect(res.status).toBe(400);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('returns 400 when cards or printings are not arrays', async () => {
    const res = await POST(makePost({ set: 'iar', cards: 'nope', printings: [] }));
    expect(res.status).toBe(400);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it('passes the payload through and returns the ingest counts', async () => {
    const res = await POST(makePost({ ...validBody, dryRun: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true, data: counts });
    expect(mockIngest).toHaveBeenCalledWith(expect.objectContaining({
      set: 'iar',
      cards: validBody.cards,
      printings: validBody.printings,
      dryRun: true,
    }));
  });

  it('maps a service failure to 400 with its message', async () => {
    mockIngest.mockResolvedValue({ success: false, error: "unknown cards column 'zz'" } as any);
    const res = await POST(makePost(validBody));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('zz');
  });
});
