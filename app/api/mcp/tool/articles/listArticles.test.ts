import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listArticlesTool } from './listArticles';

describe('listArticlesTool', () => {
  const mockUser = { _id: 'user-123', username: 'rob', mcpToken: 'mcp-tok-abc' };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockArticlesResponse(articles: any[], total = articles.length) {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: articles, meta: { count: articles.length, total, limit: 100, skip: 0 } }),
    });
  }

  it('sends authorId, default limit, and bearer token to /api/articles', async () => {
    mockArticlesResponse([]);

    await listArticlesTool.handler({}, mockUser, 'mcp-tok-abc');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/articles?');
    expect(url).toContain('authorId=user-123');
    expect(url).toContain('limit=100');
    expect(init.headers.Authorization).toBe('Bearer mcp-tok-abc');
  });

  it('forwards optional status and contentType filters', async () => {
    mockArticlesResponse([]);

    await listArticlesTool.handler(
      { status: 'draft', contentType: 'hero' },
      mockUser,
      'mcp-tok-abc'
    );

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('status=draft');
    expect(url).toContain('contentType=hero');
  });

  it('returns a formatted message listing the articles', async () => {
    mockArticlesResponse([
      {
        publicId: 'pub-1',
        title: 'Briar Guide',
        slug: 'briar-guide',
        contentType: 'hero',
        status: 'published',
        sections: [{}, {}, {}],
        updatedAt: new Date().toISOString(),
      },
      {
        publicId: 'pub-2',
        title: 'Tournament Recap',
        slug: 'recap',
        contentType: 'tournament',
        status: 'draft',
        sections: [{}],
        updatedAt: new Date().toISOString(),
      },
    ]);

    const result = await listArticlesTool.handler({}, mockUser, 'mcp-tok-abc');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Briar Guide');
    expect(result.message).toContain('Tournament Recap');
    expect(result.message).toContain('hero');
    expect(result.message).toContain('published');
    expect(result.message).toContain('draft');
    expect(result.articles).toHaveLength(2);
    expect(result.articles![0]).toMatchObject({ publicId: 'pub-1', title: 'Briar Guide' });
  });

  it('returns an empty-state message when the user has no articles', async () => {
    mockArticlesResponse([]);

    const result = await listArticlesTool.handler({}, mockUser, 'mcp-tok-abc');

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/no articles/i);
    expect(result.articles).toEqual([]);
  });

  it('returns an auth error when no token is provided', async () => {
    const result = await listArticlesTool.handler({}, null as any, undefined);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth/i);
  });

  it('surfaces HTTP errors from the API', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    const result = await listArticlesTool.handler({}, mockUser, 'mcp-tok-abc');

    expect(result.success).toBe(false);
    expect(result.error).toContain('403');
  });
});
