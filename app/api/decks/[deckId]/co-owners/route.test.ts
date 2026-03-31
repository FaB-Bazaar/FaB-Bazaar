/**
 * Unit tests for GET + PUT /api/decks/[deckId]/co-owners
 *
 * Tests HTTP concerns: auth, access control, validation, and response shape.
 * deckService and userService are mocked — no database involved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  deckService: {
    findByPublicId: vi.fn(),
    updateCoOwners: vi.fn(),
  },
  userService: {
    getUsersByIds: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('@/lib/utils/display-username', () => ({
  displayUsername: (username: string) => username.replace(/^(dc_|gh_)/, ''),
}));

import { GET, PUT } from './route';
import { deckService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockFindByPublicId = vi.mocked(deckService.findByPublicId);
const mockUpdateCoOwners = vi.mocked(deckService.updateCoOwners);
const mockGetUsersByIds = vi.mocked(userService.getUsersByIds);
const mockAuth = vi.mocked(authenticateRequest);

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const DECK_ID = 'deck-public-123';
const OWNER_ID = 'owner-user-id';
const CO_OWNER_ID = 'co-owner-user-id';

const makeParams = () => Promise.resolve({ deckId: DECK_ID });

const makeRequest = (method = 'GET', body?: unknown) =>
  new NextRequest(`http://localhost/api/decks/${DECK_ID}/co-owners`, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
      : {}),
  });

const setAuth = (userId = OWNER_ID) =>
  mockAuth.mockResolvedValue({ success: true, userId } as any);

const makeDeck = (overrides?: Partial<{ userId: string; coOwners: string[] }>) => ({
  _id: 'internal-deck-id',
  publicId: DECK_ID,
  userId: OWNER_ID,
  coOwners: [] as string[],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────
// GET — auth
// ────────────────────────────────────────────────────────────

describe('GET auth', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────
// GET — access control
// ────────────────────────────────────────────────────────────

describe('GET access control', () => {
  it('returns 404 when deck does not exist', async () => {
    setAuth();
    mockFindByPublicId.mockResolvedValue({ success: true, data: null } as any);

    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is neither owner nor co-owner', async () => {
    setAuth('stranger-id');
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);

    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(403);
  });

  it('allows the primary owner to fetch co-owners', async () => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);
    mockGetUsersByIds.mockResolvedValue({ success: true, data: [] } as any);

    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(200);
  });

  it('allows a co-owner to fetch the co-owners list', async () => {
    setAuth(CO_OWNER_ID);
    mockFindByPublicId.mockResolvedValue({
      success: true,
      data: makeDeck({ coOwners: [CO_OWNER_ID] }),
    } as any);
    mockGetUsersByIds.mockResolvedValue({ success: true, data: [] } as any);

    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(200);
  });
});

// ────────────────────────────────────────────────────────────
// GET — response shape
// ────────────────────────────────────────────────────────────

describe('GET response', () => {
  it('returns empty array when deck has no co-owners', async () => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);

    const res = await GET(makeRequest(), { params: makeParams() });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual([]);
  });

  it('returns co-owner profiles with display username (prefix stripped)', async () => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({
      success: true,
      data: makeDeck({ coOwners: [CO_OWNER_ID] }),
    } as any);
    mockGetUsersByIds.mockResolvedValue({
      success: true,
      data: [{ _id: CO_OWNER_ID, username: 'dc_coowner', avatarUrl: 'https://cdn/avatar.png' }],
    } as any);

    const res = await GET(makeRequest(), { params: makeParams() });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe(CO_OWNER_ID);
    expect(json.data[0].username).toBe('coowner'); // dc_ prefix stripped
    expect(json.data[0].avatar).toBe('https://cdn/avatar.png');
  });

  it('returns 500 when userService.getUsersByIds fails', async () => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({
      success: true,
      data: makeDeck({ coOwners: [CO_OWNER_ID] }),
    } as any);
    mockGetUsersByIds.mockResolvedValue({ success: false, error: 'DB error' } as any);

    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(500);
  });
});

// ────────────────────────────────────────────────────────────
// PUT — auth
// ────────────────────────────────────────────────────────────

describe('PUT auth', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await PUT(makeRequest('PUT', { userIds: [] }), { params: makeParams() });

    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────
// PUT — validation
// ────────────────────────────────────────────────────────────

describe('PUT validation', () => {
  beforeEach(() => setAuth(OWNER_ID));

  it('returns 400 when userIds is not an array', async () => {
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);

    const res = await PUT(makeRequest('PUT', { userIds: 'not-an-array' }), { params: makeParams() });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/userIds/i);
  });

  it('returns 400 when more than 20 co-owners are provided', async () => {
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);
    const tooMany = Array.from({ length: 21 }, (_, i) => `user-${i}`);

    const res = await PUT(makeRequest('PUT', { userIds: tooMany }), { params: makeParams() });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/20/);
  });
});

// ────────────────────────────────────────────────────────────
// PUT — access control
// ────────────────────────────────────────────────────────────

describe('PUT access control', () => {
  it('returns 403 when a co-owner tries to manage co-owners', async () => {
    setAuth(CO_OWNER_ID);
    mockFindByPublicId.mockResolvedValue({
      success: true,
      data: makeDeck({ coOwners: [CO_OWNER_ID] }),
    } as any);

    const res = await PUT(makeRequest('PUT', { userIds: [] }), { params: makeParams() });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/owner/i);
  });

  it('returns 404 when deck does not exist', async () => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({ success: true, data: null } as any);

    const res = await PUT(makeRequest('PUT', { userIds: [] }), { params: makeParams() });

    expect(res.status).toBe(404);
  });
});

// ────────────────────────────────────────────────────────────
// PUT — behaviour
// ────────────────────────────────────────────────────────────

describe('PUT behaviour', () => {
  beforeEach(() => {
    setAuth(OWNER_ID);
    mockFindByPublicId.mockResolvedValue({ success: true, data: makeDeck() } as any);
    mockUpdateCoOwners.mockResolvedValue({ success: true, data: makeDeck() } as any);
  });

  it('calls updateCoOwners with the provided IDs', async () => {
    const res = await PUT(makeRequest('PUT', { userIds: [CO_OWNER_ID] }), { params: makeParams() });

    expect(res.status).toBe(200);
    expect(mockUpdateCoOwners).toHaveBeenCalledWith(DECK_ID, OWNER_ID, [CO_OWNER_ID]);
  });

  it('filters the owner out of userIds before calling updateCoOwners', async () => {
    const res = await PUT(
      makeRequest('PUT', { userIds: [CO_OWNER_ID, OWNER_ID] }),
      { params: makeParams() }
    );

    expect(res.status).toBe(200);
    // OWNER_ID must not appear in the co-owners list
    const [, , passedIds] = mockUpdateCoOwners.mock.calls[0];
    expect(passedIds).not.toContain(OWNER_ID);
    expect(passedIds).toContain(CO_OWNER_ID);
  });

  it('returns coOwnerCount in response', async () => {
    const res = await PUT(makeRequest('PUT', { userIds: [CO_OWNER_ID] }), { params: makeParams() });
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.coOwnerCount).toBe(1);
  });

  it('returns 400 when updateCoOwners service returns an error', async () => {
    mockUpdateCoOwners.mockResolvedValue({ success: false, error: 'Too many co-owners' } as any);

    const res = await PUT(makeRequest('PUT', { userIds: [CO_OWNER_ID] }), { params: makeParams() });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/too many/i);
  });
});
