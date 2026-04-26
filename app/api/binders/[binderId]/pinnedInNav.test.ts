/**
 * Unit test for PUT /api/binders/[binderId] — confirms pinnedInNav is forwarded
 * to the service layer like other allowed update fields.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  binderService: { updateBinder: vi.fn() },
  userService: {},
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
  verifyDiscordBotToken: vi.fn(),
}));

import { PUT } from './route';
import { binderService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockUpdate = vi.mocked(binderService.updateBinder);
const mockAuth = vi.mocked(authenticateRequest);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-123' } as any);
  mockUpdate.mockResolvedValue({ success: true, data: { _id: 'b1' } } as any);
});

describe('PUT /api/binders/[binderId] — pinnedInNav', () => {
  it('forwards pinnedInNav to binderService.updateBinder', async () => {
    const req = new NextRequest('http://localhost/api/binders/b1', {
      method: 'PUT',
      body: JSON.stringify({ pinnedInNav: true }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await PUT(req, { params: Promise.resolve({ binderId: 'b1' }) });
    expect(res.status).toBe(200);

    expect(mockUpdate).toHaveBeenCalledWith(
      'b1',
      'user-123',
      expect.objectContaining({ pinnedInNav: true }),
    );
  });
});
