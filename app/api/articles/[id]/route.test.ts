/**
 * Unit tests for PATCH /api/articles/[id] — cache revalidation.
 *
 * This is the endpoint the MCP article tools call. A section edit that does not
 * bust the article's real public path leaves the live page serving whatever it
 * cached before, which is how an edited article silently fails to update.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  articleService: {
    getArticleById: vi.fn(),
    getArticleByPublicId: vi.fn(),
    updateSection: vi.fn(),
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
import { revalidatePath } from 'next/cache';

const mockGetByPublicId = vi.mocked(articleService.getArticleByPublicId);
const mockUpdateSections = vi.mocked(articleService.updateSection);
const mockProfile = vi.mocked(userService.findById);
const mockAuth = vi.mocked(authenticateRequest);

const PUBLIC_ID = 'g4zzA4Ev_Q';
const USER_ID = 'user-1';

const callPatch = (body: unknown) =>
  PATCH(
    new NextRequest(`http://localhost/api/articles/${PUBLIC_ID}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: PUBLIC_ID }) }
  );

/** An article that is published, hero-typed, and carries a legacy slug. */
const article = (contentType = 'hero') => ({
  success: true as const,
  data: {
    _id: 'mongo-id-1',
    publicId: PUBLIC_ID,
    // Present but NOT the routing key — the public routes resolve by publicId.
    slug: 'teklovossen-buylist',
    contentType,
    status: 'published',
    authorId: USER_ID,
    sections: [{ type: 'text', content: '' }],
  } as any,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: USER_ID } as any);
  mockProfile.mockResolvedValue({
    success: true,
    data: { roles: { isSuperAdmin: true, isContentCreator: true } },
  } as any);
});

describe('PATCH /api/articles/[id] — revalidation after a section edit', () => {
  const editSection = async (contentType = 'hero') => {
    mockGetByPublicId.mockResolvedValue(article(contentType) as any);
    mockUpdateSections.mockResolvedValue({
      success: true,
      data: { ...article(contentType).data },
    } as any);

    await callPatch({
      operation: 'update_section',
      index: 0,
      section: { type: 'text', content: 'hello' },
    });

    return vi.mocked(revalidatePath).mock.calls.map(c => c[0]);
  };

  it('busts the hero page keyed by publicId, not slug', async () => {
    const paths = await editSection('hero');

    expect(paths).toContain(`/heroes/${PUBLIC_ID}`);
  });

  it('never revalidates a slug-keyed path, which no route serves', async () => {
    const paths = await editSection('hero');

    expect(paths).not.toContain('/heroes/teklovossen-buylist');
  });

  it('busts the articles page for a non-hero article', async () => {
    const paths = await editSection('strategy');

    expect(paths).toContain(`/articles/${PUBLIC_ID}`);
  });
});
