import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  binderService: {
    bulkUpdateCards: vi.fn(),
    getBinder: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { PATCH } from './route';
import { binderService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockBulkUpdateCards = vi.mocked(binderService.bulkUpdateCards);
const mockGetBinder = vi.mocked(binderService.getBinder);
const mockAuth = vi.mocked(authenticateRequest);

const BINDER_ID = 'test-binder-id';
const USER_ID = 'test-user-id';

function makeRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/binders/${BINDER_ID}/bulk-update`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => { vi.clearAllMocks(); });

describe('PATCH /api/binders/[binderId]/bulk-update', () => {
  it('returns 200 with success when bulk update + getBinder succeed', async () => {
    mockAuth.mockResolvedValueOnce({ success: true, userId: USER_ID, authMethod: 'session' } as any);
    mockBulkUpdateCards.mockResolvedValueOnce({ success: true, data: { modifiedCount: 7 } } as any);
    mockGetBinder.mockResolvedValueOnce({ success: true, data: { name: 'My Binder' } } as any);

    const res = await PATCH(makeRequest({ forTrade: false }), { params: Promise.resolve({ binderId: BINDER_ID }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.modifiedCount).toBe(7);
    expect(data.operation.binderName).toBe('My Binder');

    // Service layer is used with the correct binderId in BOTH calls
    expect(mockBulkUpdateCards).toHaveBeenCalledWith(BINDER_ID, USER_ID, 'forTrade', false);
    expect(mockGetBinder).toHaveBeenCalledWith(BINDER_ID, USER_ID);
  });
});
