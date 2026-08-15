/**
 * Unit test for PATCH /api/decks/[deckId] — confirms the user-defined `folder`
 * string is forwarded to the service layer (including an explicit null to clear it).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: {
    updateDeck: vi.fn(),
    findByPublicId: vi.fn(),
  },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
  authenticateSession: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { PATCH } from './route';
import { deckService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockUpdate = vi.mocked(deckService.updateDeck);
const mockFindByPublicId = vi.mocked(deckService.findByPublicId);
const mockAuth = vi.mocked(authenticateRequest);

function patch(body: unknown) {
  const req = new NextRequest('http://localhost/api/decks/pub-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  return PATCH(req, { params: Promise.resolve({ deckId: 'pub-1' }) } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-123' } as any);
  mockFindByPublicId.mockResolvedValue({
    success: true,
    data: { userId: 'user-123', coOwners: [], publicId: 'pub-1' },
  } as any);
  mockUpdate.mockResolvedValue({ success: true, data: { publicId: 'pub-1' } } as any);
});

describe('PATCH /api/decks/[deckId] — folder', () => {
  it('forwards folder to deckService.updateDeck', async () => {
    const res = await patch({ folder: 'Physical decks' });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      'pub-1',
      'user-123',
      expect.objectContaining({ folder: 'Physical decks' }),
    );
  });

  it('forwards an explicit null so the folder can be cleared', async () => {
    const res = await patch({ folder: null });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      'pub-1',
      'user-123',
      expect.objectContaining({ folder: null }),
    );
  });

  it('leaves folder undefined when the body omits it', async () => {
    await patch({ name: 'Renamed' });
    const updates = mockUpdate.mock.calls[0][2];
    expect(updates.folder).toBeUndefined();
  });
});
