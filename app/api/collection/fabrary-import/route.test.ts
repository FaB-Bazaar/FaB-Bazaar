/**
 * Route unit tests: POST /api/collection/fabrary-import
 *
 * Regression for the 2026-08-26 prod outage: a user's SECOND CSV import of
 * the same day must create a binder with a fresh slug (≤ 20 chars) instead of
 * spinning forever in slug generation and hanging the whole server.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  binderService: {
    listUserBindersSummary: vi.fn(),
    createBinder: vi.fn(),
    addCardsToBinder: vi.fn(),
  },
  wantsService: { bulkAddWants: vi.fn() },
}));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

// Import AFTER mocks (vi.mock is hoisted)
import { NextRequest } from 'next/server';
import { POST } from './route';
import { binderService, wantsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockList = vi.mocked(binderService.listUserBindersSummary);
const mockCreate = vi.mocked(binderService.createBinder);
const mockAdd = vi.mocked(binderService.addCardsToBinder);
const mockWants = vi.mocked(wantsService.bulkAddWants);

const USER = 'user-1';

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/collection/fabrary-import', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
  );
}

describe('POST /api/collection/fabrary-import', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T12:57:00Z'));
    mockAuth.mockResolvedValue({ success: true, userId: USER } as never);
    mockCreate.mockImplementation(async (_userId, input) =>
      ({ success: true, data: { _id: 'binder-new', name: input.name } }) as never
    );
    mockAdd.mockResolvedValue({ success: true, data: { summary: { added: 1, updated: 0, failed: 0 } } } as never);
    mockWants.mockResolvedValue({ success: true, data: { summary: { added: 0, updated: 0, failed: 0 } } } as never);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('second same-day import gets a distinct ≤20-char slug (2026-08-26 hang regression)', async () => {
    // First import earlier today already claimed the truncated slug + name.
    mockList.mockResolvedValue({
      success: true,
      data: [{ _id: 'binder-old', name: 'CSV Import 2026-08-26', slug: 'csv-import-2026-08-2' }],
    } as never);

    const res = await post({ inventory: [{ printingId: 'p1', quantity: 1, forTrade: false }], wants: [] });

    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const input = mockCreate.mock.calls[0][1];
    expect(input.slug).not.toBe('csv-import-2026-08-2');
    expect(input.slug!.length).toBeLessThanOrEqual(20);
    expect(input.name).toBe('CSV Import 2026-08-26 2');
  });

  it('first import of the day uses the plain truncated slug', async () => {
    mockList.mockResolvedValue({ success: true, data: [] } as never);

    const res = await post({ inventory: [{ printingId: 'p1', quantity: 1, forTrade: false }], wants: [] });

    expect(res.status).toBe(200);
    expect(mockCreate.mock.calls[0][1].slug).toBe('csv-import-2026-08-2');
  });
});
