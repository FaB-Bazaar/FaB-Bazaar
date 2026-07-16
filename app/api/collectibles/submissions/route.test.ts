/**
 * Unit tests for POST /api/collectibles/submissions (crowdsourced playmat
 * suggestions — any signed-in user, allowOAuth).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  collectibleService: {
    createSubmission: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { POST } from './route';
import { collectibleService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockCreate = vi.mocked(collectibleService.createSubmission);
const mockAuth = vi.mocked(authenticateRequest);

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/collectibles/submissions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'user-1' } as any);
});

describe('POST /api/collectibles/submissions', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await POST(makeRequest({ name: 'Mat' }));

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('authenticates with allowOAuth so Volzar/OAuth clients work', async () => {
    mockCreate.mockResolvedValue({ success: true, data: { id: 's-1' } } as any);

    await POST(makeRequest({ name: 'Mat' }));

    expect(mockAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ allowOAuth: true }),
    );
  });

  it('returns 400 for a new-entry proposal without a name', async () => {
    const res = await POST(makeRequest({ artist: 'No Name' }));

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates the submission as the caller and returns it', async () => {
    mockCreate.mockResolvedValue({
      success: true,
      data: { id: 's-1', status: 'pending', name: 'Found Mat' },
    } as any);

    const res = await POST(
      makeRequest({ name: 'Found Mat', year: 2024, notes: 'Saw it at an armory' }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('s-1');
    expect(mockCreate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ name: 'Found Mat', year: 2024 }),
    );
  });

  it('allows an edit suggestion without a name when collectibleId is set', async () => {
    mockCreate.mockResolvedValue({ success: true, data: { id: 's-2' } } as any);

    const res = await POST(makeRequest({ collectibleId: 'c-1', artist: 'Fixed Artist' }));

    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ collectibleId: 'c-1', artist: 'Fixed Artist' }),
    );
  });

  it('maps service not-found to 404', async () => {
    mockCreate.mockResolvedValue({ success: false, error: 'Collectible not found' } as any);

    const res = await POST(makeRequest({ collectibleId: 'nope', artist: 'X' }));

    expect(res.status).toBe(404);
  });

  it('maps the pending-cap error to 429', async () => {
    mockCreate.mockResolvedValue({
      success: false,
      error: 'You have too many pending submissions — please wait for review',
    } as any);

    const res = await POST(makeRequest({ name: 'Spam Mat' }));

    expect(res.status).toBe(429);
  });

  it('returns 500 on other service failures', async () => {
    mockCreate.mockResolvedValue({ success: false, error: 'db down' } as any);

    const res = await POST(makeRequest({ name: 'Mat' }));

    expect(res.status).toBe(500);
  });
});
