import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  binderService: { bulkRemoveItems: vi.fn() },
  printingsService: { getPrintingsByIds: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
  AuthResult: {},
}));

vi.mock('@/lib/discord/discord-webhooks', () => ({
  DiscordWebhooks: { sendBinderUpdate: vi.fn() },
}));

vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));

import { DELETE } from './route';
import { binderService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockBulkRemoveItems = vi.mocked(binderService.bulkRemoveItems);
const mockAuth = vi.mocked(authenticateRequest);

const BINDER_ID = 'test-binder-id';
const USER_ID = 'test-user-id';

function makeRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/binders/${BINDER_ID}/cards`, {
    method: 'DELETE',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => { vi.clearAllMocks(); });

describe('DELETE /api/binders/[binderId]/cards', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ success: false, error: 'Unauthorized' });

    const res = await DELETE(makeRequest({ cardIds: ['a'] }), { params: Promise.resolve({ binderId: BINDER_ID }) });

    expect(res.status).toBe(401);
  });

  it('returns 403 when auth method is not oauth', async () => {
    mockAuth.mockResolvedValueOnce({ success: true, userId: USER_ID, authMethod: 'session' } as any);

    const res = await DELETE(makeRequest({ cardIds: ['a'] }), { params: Promise.resolve({ binderId: BINDER_ID }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/oauth/i);
  });

  it('returns 400 when cardIds is missing', async () => {
    mockAuth.mockResolvedValueOnce({ success: true, userId: USER_ID, authMethod: 'oauth' } as any);

    const res = await DELETE(makeRequest({}), { params: Promise.resolve({ binderId: BINDER_ID }) });

    expect(res.status).toBe(400);
  });

  it('returns 400 when cardIds is empty array', async () => {
    mockAuth.mockResolvedValueOnce({ success: true, userId: USER_ID, authMethod: 'oauth' } as any);

    const res = await DELETE(makeRequest({ cardIds: [] }), { params: Promise.resolve({ binderId: BINDER_ID }) });

    expect(res.status).toBe(400);
  });

  it('returns 400 when cardIds exceeds 100 items', async () => {
    mockAuth.mockResolvedValueOnce({ success: true, userId: USER_ID, authMethod: 'oauth' } as any);
    const cardIds = Array.from({ length: 101 }, (_, i) => `id-${i}`);

    const res = await DELETE(makeRequest({ cardIds }), { params: Promise.resolve({ binderId: BINDER_ID }) });

    expect(res.status).toBe(400);
  });

  it('calls bulkRemoveItems and returns removed count', async () => {
    mockAuth.mockResolvedValueOnce({ success: true, userId: USER_ID, authMethod: 'oauth' } as any);
    mockBulkRemoveItems.mockResolvedValueOnce({ success: true, data: { removed: 2 } });

    const res = await DELETE(makeRequest({ cardIds: ['id-1', 'id-2'] }), { params: Promise.resolve({ binderId: BINDER_ID }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.removed).toBe(2);
    expect(mockBulkRemoveItems).toHaveBeenCalledWith(BINDER_ID, USER_ID, ['id-1', 'id-2']);
  });

  it('returns 403 when service reports access denied', async () => {
    mockAuth.mockResolvedValueOnce({ success: true, userId: USER_ID, authMethod: 'oauth' } as any);
    mockBulkRemoveItems.mockResolvedValueOnce({ success: false, error: 'Binder not found or access denied' });

    const res = await DELETE(makeRequest({ cardIds: ['id-1'] }), { params: Promise.resolve({ binderId: BINDER_ID }) });

    expect(res.status).toBe(403);
  });
});
