/**
 * Unit tests for PATCH /api/articles/[id] update_metadata — contributors field.
 *
 * Co-author credits are edited through update_metadata; the route's
 * allowedFields whitelist must let `contributors` through to
 * articleService.updateArticle (which validates the payload).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  articleService: {
    getArticleById: vi.fn(),
    getArticleByPublicId: vi.fn(),
    updateArticle: vi.fn(),
  },
  userService: { findById: vi.fn() },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { PATCH } from './route';
import { articleService, userService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockGetByPublicId = vi.mocked(articleService.getArticleByPublicId);
const mockUpdateArticle = vi.mocked(articleService.updateArticle);
const mockProfile = vi.mocked(userService.findById);
const mockAuth = vi.mocked(authenticateRequest);

const PUBLIC_ID = 'coauth1234';
const USER_ID = 'user-1';

const CONTRIBUTORS = [{ role: 'Deck by', name: 'John Smith', link: 'https://twitter.com/johnsmith' }];

const callPatch = (body: unknown) =>
  PATCH(
    new NextRequest(`http://localhost/api/articles/${PUBLIC_ID}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: PUBLIC_ID }) }
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: USER_ID } as any);
  mockProfile.mockResolvedValue({
    success: true,
    data: { roles: { isSuperAdmin: true, isContentCreator: true } },
  } as any);
  mockGetByPublicId.mockResolvedValue({
    success: true,
    data: {
      _id: 'article-id-1',
      publicId: PUBLIC_ID,
      contentType: 'strategy',
      status: 'published',
      authorId: USER_ID,
      sections: [],
    } as any,
  });
  mockUpdateArticle.mockResolvedValue({
    success: true,
    data: { publicId: PUBLIC_ID, contentType: 'strategy', status: 'published', sections: [], contributors: CONTRIBUTORS } as any,
  });
});

describe('PATCH /api/articles/[id] update_metadata — contributors', () => {
  it('forwards contributors to articleService.updateArticle', async () => {
    const res = await callPatch({
      operation: 'update_metadata',
      updates: { contributors: CONTRIBUTORS },
    });

    expect(res.status).toBe(200);
    expect(mockUpdateArticle).toHaveBeenCalledWith(
      'article-id-1',
      USER_ID,
      expect.objectContaining({ contributors: CONTRIBUTORS })
    );
  });

  it('still rejects an update with no allowed fields', async () => {
    const res = await callPatch({
      operation: 'update_metadata',
      updates: { evilField: true },
    });

    expect(res.status).toBe(400);
    expect(mockUpdateArticle).not.toHaveBeenCalled();
  });
});
