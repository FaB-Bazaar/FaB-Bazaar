/**
 * Route unit tests for POST /api/wants/acquire — mark wants cards as acquired
 * into a binder. Auth, validation, and status-code mapping; service is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ wantsService: { acquireWantsToBinder: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

// Import AFTER mocks (vi.mock is hoisted)
import { POST } from './route';
import { wantsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAcquire = vi.mocked(wantsService.acquireWantsToBinder);
const mockAuth = vi.mocked(authenticateRequest);

const request = (body: unknown) =>
  new Request('http://localhost/api/wants/acquire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any;

const successPayload = {
  success: true as const,
  data: {
    success: true,
    summary: {
      totalRequested: 1,
      successful: 1,
      failed: 0,
      fullyAcquired: 1,
      partiallyAcquired: 0,
      mergedInBinder: 0,
      totalQuantityAcquired: 2,
    },
    results: [
      {
        success: true,
        printingId: 'pr1',
        name: 'Pummel',
        action: 'acquired' as const,
        quantity: 2,
        remainingWanted: 0,
      },
    ],
    message: 'Acquired 2 cards',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'u1', username: 'tester' } as any);
});

describe('POST /api/wants/acquire', () => {
  it('rejects unauthenticated requests with 401', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Authentication failed' } as any);

    const res = await POST(request({ targetBinderId: 'b1', cards: [{ printingId: 'pr1', quantity: 1 }] }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it('rejects a missing targetBinderId with 400', async () => {
    const res = await POST(request({ cards: [{ printingId: 'pr1', quantity: 1 }] }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it('rejects a missing or empty cards array with 400', async () => {
    for (const cards of [undefined, [], 'not-an-array']) {
      const res = await POST(request({ targetBinderId: 'b1', cards }));
      expect(res.status).toBe(400);
    }
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it('rejects card entries without a printingId or with a non-positive quantity', async () => {
    for (const cards of [
      [{ quantity: 1 }],
      [{ printingId: 'pr1', quantity: 0 }],
      [{ printingId: 'pr1', quantity: -2 }],
      [{ printingId: 'pr1' }],
    ]) {
      const res = await POST(request({ targetBinderId: 'b1', cards }));
      expect(res.status).toBe(400);
    }
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it('acquires cards and returns the service summary', async () => {
    mockAcquire.mockResolvedValue(successPayload as any);

    const res = await POST(
      request({ targetBinderId: 'b1', cards: [{ printingId: 'pr1', quantity: 2 }] })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.summary.totalQuantityAcquired).toBe(2);
    expect(json.results[0].printingId).toBe('pr1');
    expect(mockAcquire).toHaveBeenCalledWith('u1', 'b1', [{ printingId: 'pr1', quantity: 2 }]);
  });

  it('maps a binder-not-found service error to 404', async () => {
    mockAcquire.mockResolvedValue({
      success: false,
      error: 'Target binder not found or access denied',
    } as any);

    const res = await POST(
      request({ targetBinderId: 'nope', cards: [{ printingId: 'pr1', quantity: 1 }] })
    );

    expect(res.status).toBe(404);
  });

  it('maps other service errors to 500', async () => {
    mockAcquire.mockResolvedValue({ success: false, error: 'database exploded' } as any);

    const res = await POST(
      request({ targetBinderId: 'b1', cards: [{ printingId: 'pr1', quantity: 1 }] })
    );

    expect(res.status).toBe(500);
  });
});
