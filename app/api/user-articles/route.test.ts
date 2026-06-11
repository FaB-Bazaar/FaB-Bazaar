/**
 * Unit tests for POST /api/user-articles
 *
 * Uses mocked articleService and auth — tests HTTP concerns:
 * validation, contentType defaulting, error mapping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mocks must be declared before importing the module under test.
// vi.mock is hoisted, so factories cannot reference outer variables.
vi.mock('@/lib/services', () => ({
  articleService: {
    createUserArticle: vi.fn(),
    getUserArticles: vi.fn(),
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
import { POST } from './route';
import { articleService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockCreate = vi.mocked(articleService.createUserArticle);
const mockAuth = vi.mocked(authenticateRequest);

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/user-articles', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const setAuth = (userId = 'user-123') =>
  mockAuth.mockResolvedValue({ success: true, userId } as any);

const serviceSuccess = (overrides?: Record<string, unknown>) => ({
  success: true as const,
  data: {
    _id: 'art-1',
    publicId: 'pub1234567',
    title: 'My Article',
    contentType: 'strategy',
    status: 'draft',
    sections: [],
    ...overrides,
  } as any,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('auth', () => {
  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as any);

    const res = await POST(makeRequest({ title: 'Hi' }));

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('validation', () => {
  it('returns 400 when title is missing', async () => {
    setAuth();

    const res = await POST(makeRequest({ contentType: 'strategy' }));

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid contentType', async () => {
    setAuth();

    const res = await POST(makeRequest({ title: 'Hi', contentType: 'news' }));

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('contentType defaulting (quick-write flow)', () => {
  it('creates the article with contentType "strategy" when contentType is omitted', async () => {
    setAuth();
    mockCreate.mockResolvedValue(serviceSuccess());

    const res = await POST(
      makeRequest({ title: 'Quick write', sections: [{ type: 'text', content: 'Hello' }] })
    );

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ title: 'Quick write', contentType: 'strategy' })
    );
  });

  it('passes through an explicitly provided contentType', async () => {
    setAuth();
    mockCreate.mockResolvedValue(serviceSuccess({ contentType: 'tournament' }));

    const res = await POST(makeRequest({ title: 'Report', contentType: 'tournament' }));

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({ contentType: 'tournament' })
    );
  });
});

describe('error mapping', () => {
  it('returns 429 when the daily article limit is reached', async () => {
    setAuth();
    mockCreate.mockResolvedValue({
      success: false,
      error: 'Daily article limit reached (3 per day)',
    } as any);

    const res = await POST(makeRequest({ title: 'Hi' }));

    expect(res.status).toBe(429);
  });
});
