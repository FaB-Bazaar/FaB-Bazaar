/**
 * Unit tests for POST /api/collection/transfer
 *
 * Uses mocked binderService and auth — tests HTTP concerns:
 * validation, grouping by sourceBinderId, aggregation, error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks must be declared before importing the module under test.
// vi.mock is hoisted, so factories cannot reference outer variables.
vi.mock('@/lib/services', () => ({
  binderService: {
    transferSelectedCards: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

// Import after mocks are declared so we can use vi.mocked()
import { POST } from './route';
import { binderService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockTransfer = vi.mocked(binderService.transferSelectedCards);
const mockAuth = vi.mocked(authenticateRequest);

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/collection/transfer', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const setAuth = (userId = 'user-123') =>
  mockAuth.mockResolvedValue({ success: true, userId } as any);

const makeServiceSuccess = (overrides?: {
  successful?: number; failed?: number; fullyTransferred?: number;
  partiallyTransferred?: number; mergedInTarget?: number; totalQuantityTransferred?: number;
}) => ({
  success: true as const,
  data: {
    summary: {
      totalRequested: 1,
      successful: 1,
      failed: 0,
      fullyTransferred: 1,
      partiallyTransferred: 0,
      mergedInTarget: 0,
      totalQuantityTransferred: 2,
      ...overrides,
    },
    results: [],
    message: 'ok',
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

describe('auth', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await POST(makeRequest({ targetBinderId: 'b-1', cards: [] }));

    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────

describe('validation', () => {
  beforeEach(() => setAuth());

  it('returns 400 when targetBinderId is missing', async () => {
    const res = await POST(makeRequest({ cards: [{ cardId: 'c1', sourceBinderId: 's1', quantity: 1 }] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/targetBinderId/i);
  });

  it('returns 400 when cards array is empty', async () => {
    const res = await POST(makeRequest({ targetBinderId: 'b-target', cards: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when cards is not an array', async () => {
    const res = await POST(makeRequest({ targetBinderId: 'b-target', cards: null }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when a card entry is missing cardId', async () => {
    const res = await POST(makeRequest({
      targetBinderId: 'b-target',
      cards: [{ sourceBinderId: 's1', quantity: 1 }],
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when a card entry has quantity <= 0', async () => {
    const res = await POST(makeRequest({
      targetBinderId: 'b-target',
      cards: [{ cardId: 'c1', sourceBinderId: 's1', quantity: 0 }],
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when sourceBinderId equals targetBinderId', async () => {
    const res = await POST(makeRequest({
      targetBinderId: 'same-binder',
      cards: [{ cardId: 'c1', sourceBinderId: 'same-binder', quantity: 1 }],
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/same/i);
  });
});

// ────────────────────────────────────────────────────────────
// Grouping + aggregation
// ────────────────────────────────────────────────────────────

describe('grouping and aggregation', () => {
  beforeEach(() => setAuth());

  it('calls transferSelectedCards once per unique sourceBinderId', async () => {
    mockTransfer.mockResolvedValue(makeServiceSuccess() as any);

    await POST(makeRequest({
      targetBinderId: 'b-target',
      cards: [
        { cardId: 'c1', sourceBinderId: 'src-A', quantity: 1 },
        { cardId: 'c2', sourceBinderId: 'src-B', quantity: 2 },
        { cardId: 'c3', sourceBinderId: 'src-A', quantity: 1 }, // same source as c1
      ],
    }));

    expect(mockTransfer).toHaveBeenCalledTimes(2);

    const calls = mockTransfer.mock.calls;
    const srcACall = calls.find(([src]) => src === 'src-A');
    expect(srcACall).toBeDefined();
    expect(srcACall![2]).toBe('user-123'); // userId arg
    expect(srcACall![3]).toHaveLength(2);
    expect(srcACall![3].map((c: { cardId: string }) => c.cardId)).toContain('c1');
    expect(srcACall![3].map((c: { cardId: string }) => c.cardId)).toContain('c3');

    const srcBCall = calls.find(([src]) => src === 'src-B');
    expect(srcBCall![3]).toHaveLength(1);
    expect(srcBCall![3][0].cardId).toBe('c2');
    expect(srcBCall![3][0].quantity).toBe(2);
  });

  it('aggregates summary totals from multiple source groups', async () => {
    mockTransfer
      .mockResolvedValueOnce(makeServiceSuccess({ successful: 1, totalQuantityTransferred: 3 }) as any)
      .mockResolvedValueOnce(makeServiceSuccess({ successful: 2, mergedInTarget: 1, totalQuantityTransferred: 5 }) as any);

    const res = await POST(makeRequest({
      targetBinderId: 'b-target',
      cards: [
        { cardId: 'c1', sourceBinderId: 'src-A', quantity: 3 },
        { cardId: 'c2', sourceBinderId: 'src-B', quantity: 2 },
        { cardId: 'c3', sourceBinderId: 'src-B', quantity: 3 },
      ],
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.summary.successful).toBe(3);
    expect(json.summary.mergedInTarget).toBe(1);
    expect(json.summary.totalQuantityTransferred).toBe(8);
  });
});

// ────────────────────────────────────────────────────────────
// Error handling
// ────────────────────────────────────────────────────────────

describe('error handling', () => {
  beforeEach(() => setAuth());

  it('returns 500 when the service returns an error', async () => {
    mockTransfer.mockResolvedValue({ success: false, error: 'Binder not found' } as any);

    const res = await POST(makeRequest({
      targetBinderId: 'b-target',
      cards: [{ cardId: 'c1', sourceBinderId: 'src-A', quantity: 1 }],
    }));

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/binder not found/i);
  });

  it('returns 500 when the service throws unexpectedly', async () => {
    mockTransfer.mockRejectedValue(new Error('DB connection lost'));

    const res = await POST(makeRequest({
      targetBinderId: 'b-target',
      cards: [{ cardId: 'c1', sourceBinderId: 'src-A', quantity: 1 }],
    }));

    expect(res.status).toBe(500);
  });
});
