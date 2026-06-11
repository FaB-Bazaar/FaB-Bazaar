/**
 * Unit tests for PATCH /api/user-articles/[publicId]
 *
 * Uses mocked articleService and auth — tests HTTP concerns:
 * contentType forwarding + validation (publish-time metadata), error mapping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  articleService: {
    getArticleByPublicId: vi.fn(),
    updateUserArticle: vi.fn(),
    deleteUserArticle: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Import after mocks are declared so we can use vi.mocked()
import { PATCH } from './route';
import { articleService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockGet = vi.mocked(articleService.getArticleByPublicId);
const mockUpdate = vi.mocked(articleService.updateUserArticle);
const mockAuth = vi.mocked(authenticateRequest);

const PUBLIC_ID = 'pub1234567';

const makeRequest = (body: unknown) =>
  new NextRequest(`http://localhost/api/user-articles/${PUBLIC_ID}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const callPatch = (body: unknown) =>
  PATCH(makeRequest(body), { params: Promise.resolve({ publicId: PUBLIC_ID }) });

const setAuth = (userId = 'user-123') =>
  mockAuth.mockResolvedValue({ success: true, userId } as any);

const existingArticle = (overrides?: Record<string, unknown>) => ({
  success: true as const,
  data: {
    _id: 'art-1',
    publicId: PUBLIC_ID,
    title: 'My Article',
    contentType: 'strategy',
    status: 'draft',
    authorId: 'user-123',
    isUserArticle: true,
    sections: [],
    ...overrides,
  } as any,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('contentType updates (publish-time metadata)', () => {
  it('forwards contentType to updateUserArticle when provided', async () => {
    setAuth();
    mockGet.mockResolvedValue(existingArticle());
    mockUpdate.mockResolvedValue(existingArticle({ contentType: 'tournament' }));

    const res = await callPatch({ contentType: 'tournament', status: 'published' });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      'art-1',
      'user-123',
      expect.objectContaining({ contentType: 'tournament', status: 'published' })
    );
  });

  it('returns 400 for an invalid contentType without calling the service', async () => {
    setAuth();
    mockGet.mockResolvedValue(existingArticle());

    const res = await callPatch({ contentType: 'news' });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('leaves contentType undefined when not provided', async () => {
    setAuth();
    mockGet.mockResolvedValue(existingArticle());
    mockUpdate.mockResolvedValue(existingArticle({ title: 'Renamed' }));

    const res = await callPatch({ title: 'Renamed' });

    expect(res.status).toBe(200);
    const updates = mockUpdate.mock.calls[0][2];
    expect(updates.contentType).toBeUndefined();
  });
});

describe('error mapping', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await callPatch({ title: 'x' });

    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the article does not exist', async () => {
    setAuth();
    mockGet.mockResolvedValue({ success: true, data: null } as any);

    const res = await callPatch({ title: 'x' });

    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
