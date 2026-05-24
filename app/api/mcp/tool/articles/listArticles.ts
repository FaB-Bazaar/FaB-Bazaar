// app/api/mcp/tool/articles/listArticles.ts - MCP tool for listing the current user's articles

export const listArticlesTool = {
  name: 'list_articles',
  description: `📚 LIST YOUR ARTICLES (SuperAdmin/ContentCreator only)

List all articles authored by the currently authenticated user, with optional filtering by status and content type.

🔍 FEATURES:
• Lists only YOUR articles (filtered by authorId of the authenticated user)
• Optional filter by status: 'draft' | 'published'
• Optional filter by contentType: 'hero' | 'article' | 'guide' | 'news' | 'strategy' | 'tournament'
• Returns publicId, title, slug, status, contentType, section count, and last-updated timestamp
• publicId is the canonical identifier — use it for get_article, add_article_section, update_article_section
• slug is display-only (shown to readers in URLs); do NOT use it as an MCP tool argument

📚 USAGE:
• Find an article you want to edit: list_articles({}) → then use get_article({ articleId: "<publicId>" })
• Triage drafts: list_articles({ status: "draft" })
• Browse your hero guides: list_articles({ contentType: "hero" })

🔐 AUTHENTICATION: OAuth 2.1 Bearer token required. Requires SuperAdmin or ContentCreator role.

📖 EXAMPLES:
• list_articles({})
• list_articles({ status: "draft" })
• list_articles({ contentType: "hero", status: "published" })

💡 Follow up with get_article({ articleId: "<publicId>" }) to read or edit a specific article.`,

  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['draft', 'published'],
        description: 'Optional filter by article status',
      },
      contentType: {
        type: 'string',
        enum: ['hero', 'article', 'guide', 'news', 'strategy', 'tournament'],
        description: 'Optional filter by content type',
      },
    },
  },

  async handler(params: any, authenticatedUser?: any, mcpToken?: string) {
    const API_BASE_URL = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://fabbazaar.app');

    const tokenToUse = authenticatedUser?.mcpToken || mcpToken;
    if (!tokenToUse) {
      return { success: false, error: 'Authentication required: no bearer token found.' };
    }

    const authorId = authenticatedUser?._id;
    if (!authorId) {
      return { success: false, error: 'Authentication required: could not determine current user id.' };
    }

    const queryParams = new URLSearchParams();
    queryParams.set('authorId', String(authorId));
    queryParams.set('limit', '100');
    if (params?.status) queryParams.set('status', params.status);
    if (params?.contentType) queryParams.set('contentType', params.contentType);

    const url = `${API_BASE_URL}/api/articles?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ListArticles] HTTP ${response.status}:`, errorText);
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          status: response.status,
        };
      }

      const result = await response.json();

      if (!result.success) {
        return { success: false, error: result.error || 'API returned success: false' };
      }

      const articles: any[] = result.data || [];

      if (articles.length === 0) {
        return {
          success: true,
          message: '📭 No articles found for your account.',
          articles: [],
        };
      }

      let message = `📚 **Your Articles** (${articles.length} total)\n\n`;
      articles.forEach((article: any, index: number) => {
        const updatedAt = article.updatedAt ? new Date(article.updatedAt) : null;
        const diffMs = updatedAt ? Date.now() - updatedAt.getTime() : 0;
        const diffDays = Math.floor(diffMs / 86400000);
        const timeAgo = !updatedAt
          ? '—'
          : diffDays === 0
          ? `${Math.floor(diffMs / 3600000)}h ago`
          : diffDays === 1
          ? 'yesterday'
          : diffDays < 30
          ? `${diffDays} days ago`
          : `${Math.floor(diffDays / 30)} months ago`;

        const sectionCount = Array.isArray(article.sections) ? article.sections.length : 0;
        message += `${index + 1}. **${article.title}** | ${article.contentType} | ${article.status} | ${sectionCount} sections | publicId: \`${article.publicId}\` | slug: \`${article.slug}\` | ${timeAgo}\n`;
      });

      message += `\n💡 Use get_article({ articleId: "<publicId>" }) to view or edit an article. (slug is for human reference only.)`;

      return {
        success: true,
        message,
        articles: articles.map((a: any) => ({
          publicId: a.publicId,
          title: a.title,
          subtitle: a.subtitle,
          slug: a.slug,
          status: a.status,
          contentType: a.contentType,
          sectionsCount: Array.isArray(a.sections) ? a.sections.length : 0,
          updatedAt: a.updatedAt,
          createdAt: a.createdAt,
        })),
      };
    } catch (error) {
      console.error('[ListArticles] Fetch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network or parsing error',
      };
    }
  },
};

export default listArticlesTool;
