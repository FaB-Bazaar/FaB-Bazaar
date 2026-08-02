/**
 * Unit tests for POST /api/sets/[setCode]/binder
 *
 * Uses mocked binderService, printingsService and auth — tests HTTP concerns:
 * auth, foiling/edition validation, name-conflict 409, create + batch-add flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks must be declared before importing the module under test.
// vi.mock is hoisted, so factories cannot reference outer variables.
vi.mock('@/lib/services', () => ({
  binderService: {
    listUserBindersSummary: vi.fn(),
    createBinder: vi.fn(),
    addCardsToBinder: vi.fn(),
  },
  printingsService: {
    searchPrintings: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

// Import after mocks are declared so we can use vi.mocked()
import { POST } from './route';
import { binderService, printingsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockList = vi.mocked(binderService.listUserBindersSummary);
const mockCreate = vi.mocked(binderService.createBinder);
const mockAddCards = vi.mocked(binderService.addCardsToBinder);
const mockSearch = vi.mocked(printingsService.searchPrintings);

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const makeRequest = (setCode: string, body: unknown) =>
  new NextRequest(`http://localhost/api/sets/${setCode}/binder`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const params = (setCode: string) => ({ params: Promise.resolve({ setCode }) });

const setAuth = (userId = 'user-123', username = 'mistercakes') =>
  mockAuth.mockResolvedValue({ success: true, userId, username } as any);

const printing = (
  printing_id: string,
  collector_number: string,
  foiling: string,
  art_variations: string[] = []
) => ({ printing_id, collector_number, foiling, art_variations });

const setSearchResults = (printings: unknown[]) =>
  mockSearch.mockResolvedValue({
    success: true,
    data: { printings, total: printings.length },
  } as any);

const setHappyPath = () => {
  setAuth();
  mockList.mockResolvedValue({ success: true, data: [] } as any);
  setSearchResults([
    printing('p-1', 'SEA001', 's'),
    printing('p-2', 'SEA002', 's'),
  ]);
  mockCreate.mockResolvedValue({
    success: true,
    data: { _id: 'binder-1', name: 'mistercakes - SEA', slug: 'mistercakes-sea' },
  } as any);
  mockAddCards.mockResolvedValue({
    success: true,
    data: { summary: { total: 2, added: 2, updated: 0, failed: 0, filtered: 0 }, results: [] },
  } as any);
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────

describe('auth', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await POST(makeRequest('sea', { foilings: ['s'] }), params('sea'));

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────

describe('validation', () => {
  it('returns 400 when foilings is missing or empty', async () => {
    setAuth();

    const resMissing = await POST(makeRequest('sea', {}), params('sea'));
    const resEmpty = await POST(makeRequest('sea', { foilings: [] }), params('sea'));

    expect(resMissing.status).toBe(400);
    expect(resEmpty.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for a foiling code outside s/r/c', async () => {
    setAuth();

    const res = await POST(makeRequest('sea', { foilings: ['s', 'g'] }), params('sea'));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/foiling/i);
  });

  it('returns 400 for an invalid edition code', async () => {
    setAuth();

    const res = await POST(
      makeRequest('sea', { foilings: ['s'], edition: 'x' }),
      params('sea')
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/edition/i);
  });

  it('returns 400 on invalid JSON body', async () => {
    setAuth();
    const req = new NextRequest('http://localhost/api/sets/sea/binder', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req, params('sea'));

    expect(res.status).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────
// Name conflict
// ────────────────────────────────────────────────────────────

describe('existing binder conflict', () => {
  it('returns 409 with the existing binder when "{username} - {SET}" already exists (case-insensitive)', async () => {
    setAuth();
    mockList.mockResolvedValue({
      success: true,
      data: [{ _id: 'binder-9', name: 'Mistercakes - SEA', slug: 'mistercakes-sea' }],
    } as any);

    const res = await POST(makeRequest('sea', { foilings: ['s'] }), params('sea'));

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/already exists/i);
    expect(json.data).toMatchObject({ binderId: 'binder-9', slug: 'mistercakes-sea' });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAddCards).not.toHaveBeenCalled();
  });

  it('strips the OAuth-provisional prefix when building the name', async () => {
    setAuth('user-123', 'dc_bob');
    mockList.mockResolvedValue({
      success: true,
      data: [{ _id: 'binder-9', name: 'bob - SEA', slug: 'bob-sea' }],
    } as any);

    const res = await POST(makeRequest('sea', { foilings: ['s'] }), params('sea'));

    expect(res.status).toBe(409);
  });
});

// ────────────────────────────────────────────────────────────
// Success flow
// ────────────────────────────────────────────────────────────

describe('success', () => {
  it('creates the binder and batch-adds 1 NM/EN copy of each printing', async () => {
    setHappyPath();

    const res = await POST(
      makeRequest('sea', { foilings: ['s'], edition: 'n' }),
      params('sea')
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toMatchObject({
      binderId: 'binder-1',
      binderName: 'mistercakes - SEA',
      slug: 'mistercakes-sea',
      summary: { total: 2, added: 2, failed: 0 },
    });

    expect(mockCreate).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ name: 'mistercakes - SEA' })
    );
    expect(mockAddCards).toHaveBeenCalledWith('binder-1', 'user-123', [
      { printingId: 'p-1', quantity: 1, condition: 'NM', language: 'EN' },
      { printingId: 'p-2', quantity: 1, condition: 'NM', language: 'EN' },
    ]);
  });

  it('searches English printings of the set filtered by foilings and edition', async () => {
    setHappyPath();

    await POST(makeRequest('sea', { foilings: ['s', 'r'], edition: 'f' }), params('sea'));

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        sets: ['SEA'],
        foilings: ['s', 'r'],
        editions: ['f'],
        languages: ['en'],
      }),
      expect.objectContaining({ sortBy: 'collector_number', sortOrder: 'asc' })
    );
  });

  it('omits the editions filter when no edition is given', async () => {
    setHappyPath();

    await POST(makeRequest('sea', { foilings: ['s'] }), params('sea'));

    const filters = mockSearch.mock.calls[0][0] as Record<string, unknown>;
    expect(filters.editions).toBeUndefined();
  });

  it('dedupes art variants down to one printing per card+foiling', async () => {
    setHappyPath();
    setSearchResults([
      printing('reg-1', 'SEA001', 'r'),
      printing('aa-1', 'SEA001', 'r', ['AA']),
      printing('reg-2', 'SEA002', 'r'),
    ]);

    await POST(makeRequest('sea', { foilings: ['r'] }), params('sea'));

    const items = mockAddCards.mock.calls[0][2] as Array<{ printingId: string }>;
    expect(items.map(i => i.printingId)).toEqual(['reg-1', 'reg-2']);
  });

  it('returns 404 when the set has no printings for the selected filters', async () => {
    setHappyPath();
    setSearchResults([]);

    const res = await POST(makeRequest('zzz', { foilings: ['c'] }), params('zzz'));

    expect(res.status).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────
// Service failures
// ────────────────────────────────────────────────────────────

describe('service failures', () => {
  it('returns 500 when binder creation fails', async () => {
    setHappyPath();
    mockCreate.mockResolvedValue({ success: false, error: 'db down' } as any);

    const res = await POST(makeRequest('sea', { foilings: ['s'] }), params('sea'));

    expect(res.status).toBe(500);
    expect(mockAddCards).not.toHaveBeenCalled();
  });

  it('returns 500 when the batch add fails outright', async () => {
    setHappyPath();
    mockAddCards.mockResolvedValue({ success: false, error: 'insert failed' } as any);

    const res = await POST(makeRequest('sea', { foilings: ['s'] }), params('sea'));

    expect(res.status).toBe(500);
  });
});
