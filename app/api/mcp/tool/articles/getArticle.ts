// app/api/mcp/tool/articles/getArticle.ts - MCP tool for retrieving article by slug

export const getArticleTool = {
  name: 'get_article',
  description: `📄 ARTICLE RETRIEVAL TOOL (SuperAdmin/ContentCreator only)

Retrieve a full article by its slug, including all sections and metadata.

🔍 FEATURES:
• Get article by slug for reading/editing
• Returns complete article structure with all sections
• View section count and metadata
• Optional full content display (includeFullContent: true)
• Role-based access (SuperAdmin or ContentCreator)

📚 USAGE:
• View article before editing
• Get context for section updates
• Review article structure and content
• Prepare for section modifications
• Set includeFullContent: true to see FULL section text (not just previews)

🔐 AUTHENTICATION:
• MCP token via query parameter
• OAuth 2.1 Bearer token
• Requires SuperAdmin or ContentCreator role

📖 EXAMPLES:
• Preview mode: get_article({ slug: "briar-guide" })
• Full content mode: get_article({ slug: "briar-guide", includeFullContent: true })
• Debug mode (raw JSON): get_article({ slug: "briar-guide", showRawJson: true })
• With auth: get_article({ slug: "iyslander-strategy", includeFullContent: true, authParams: { mcpToken: "..." } })

💡 Use includeFullContent: true when you need to read/edit the complete text of sections.
💡 Use showRawJson: true when debugging section structure or checking exact JSON format.`,

  parameters: {
    type: 'object',
    properties: {
      slug: {
        type: 'string',
        description: 'The article slug (URL-friendly identifier)'
      },
      includeFullContent: {
        type: 'boolean',
        default: false,
        description: 'Include full section content in message (not just 50-char previews). Set to true to see complete section text.'
      },
      showRawJson: {
        type: 'boolean',
        default: false,
        description: 'Show raw JSON structure of sections instead of formatted display. Useful for debugging exact section structure.'
      },
      authParams: {
        type: 'object',
        description: 'Optional authentication parameters',
        properties: {
          mcpToken: {
            type: 'string',
            description: 'MCP authentication token'
          },
          discordId: {
            type: 'string',
            description: 'Discord user ID for authentication'
          }
        }
      }
    },
    required: ['slug']
  },

  async handler(params: any, authenticatedUser?: any, mcpToken?: string) {
    const API_BASE_URL = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://fabbazaar.app');

    const endpoint = `${API_BASE_URL}/api/articles`;

    console.log(`[GetArticle] Environment: ${process.env.NODE_ENV}, Using API base: ${API_BASE_URL}`);

    try {
      const { slug, includeFullContent = false, showRawJson = false, authParams = {} } = params;

      if (!slug) {
        return {
          success: false,
          error: 'Article slug is required'
        };
      }

      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('slug', slug);

      // Add authentication
      const tokenToUse = authenticatedUser?.mcpToken || mcpToken || authParams.mcpToken;
      if (authParams.discordId) {
        queryParams.append('discordId', authParams.discordId);
        console.log(`[GetArticle] Using Discord ID: ${authParams.discordId}`);
      }

      const url = `${endpoint}?${queryParams.toString()}`;

      console.log(`[GetArticle] Fetching article: ${slug}`);
      console.log(`[GetArticle] Full URL: ${url}`);

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (tokenToUse) {
        headers['Authorization'] = `Bearer ${tokenToUse}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GetArticle] HTTP ${response.status}:`, errorText);

        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          status: response.status,
          debug: {
            url,
            slug,
            authenticatedUser: authenticatedUser?.username || 'None',
            tokenProvided: !!tokenToUse
          }
        };
      }

      const result = await response.json();
      console.log(`[GetArticle] Retrieved article: ${slug}`);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'API returned success: false',
          details: result
        };
      }

      // Format the response
      const articles = result.data;

      if (!articles || articles.length === 0) {
        return {
          success: false,
          error: `Article not found with slug: ${slug}`,
          slug
        };
      }

      const article = articles[0]; // Get first matching article

      // Build detailed message
      let message = `📄 Article Retrieved: "${article.title}"\n\n`;

      if (article.subtitle) {
        message += `📝 Subtitle: ${article.subtitle}\n`;
      }

      message += `🔗 Slug: ${article.slug}\n`;
      message += `📁 Type: ${article.contentType}\n`;
      message += `📊 Status: ${article.status}\n`;
      message += `📦 Sections: ${article.sections?.length || 0}\n`;

      if (article.sections && article.sections.length > 0) {
        if (showRawJson) {
          // Show RAW JSON structure for debugging
          message += `\n📋 RAW JSON Structure:\n\n`;
          message += JSON.stringify(article.sections, null, 2);
        } else {
          message += `\n📋 Section ${includeFullContent ? 'Content' : 'Structure'}:\n`;
          article.sections.forEach((section: any, index: number) => {
            message += `\n  ${index}. ${section.type}`;

            if (includeFullContent) {
            // Include FULL content when requested
            if (section.type === 'text' && section.content) {
              message += `\n     Content:\n${section.content}\n`;
            } else if (section.type === 'card-carousel' && section.cards) {
              message += ` (${section.cards.length} cards)\n`;
              section.cards.forEach((card: any, cardIdx: number) => {
                message += `     ${cardIdx + 1}. printingId: ${card.printingId}`;
                if (card.caption) message += ` - ${card.caption}`;
                message += `\n`;
              });
            } else if (section.type === 'video') {
              message += `\n     Video ID: ${section.videoId}`;
              if (section.title) message += `\n     Title: ${section.title}`;
              if (section.description) message += `\n     Description: ${section.description}`;
              if (section.creatorName) message += `\n     Creator: ${section.creatorName}`;
              message += `\n`;
            } else if (section.type === 'creator-spotlight') {
              if (section.name) message += `\n     Name: ${section.name}`;
              if (section.imageUrl) message += `\n     Image: ${section.imageUrl}`;
              message += `\n`;
            } else if (section.type === 'callout') {
              if (section.text) message += `\n     Text: ${section.text}`;
              if (section.linkText) message += `\n     Link: ${section.linkText} (${section.linkHref})`;
              message += `\n`;
            } else {
              message += ` (${JSON.stringify(section, null, 2)})\n`;
            }
          } else {
            // Show PREVIEW only (original behavior)
            if (section.type === 'text' && section.content) {
              const preview = section.content.substring(0, 50).replace(/\n/g, ' ');
              message += ` - "${preview}${section.content.length > 50 ? '...' : ''}"`;
            } else if (section.type === 'card-carousel' && section.cards) {
              message += ` (${section.cards.length} cards)`;
            } else if (section.type === 'video' && section.title) {
              message += ` - "${section.title}"`;
            }
            message += `\n`;
          }
          });
        }
      }

      message += `\n✏️ Author ID: ${article.authorId}`;
      message += `\n📅 Created: ${new Date(article.createdAt).toLocaleDateString()}`;
      message += `\n🔄 Updated: ${new Date(article.updatedAt).toLocaleDateString()}`;

      return {
        success: true,
        article: {
          _id: article._id,
          title: article.title,
          subtitle: article.subtitle,
          slug: article.slug,
          contentType: article.contentType,
          status: article.status,
          authorId: article.authorId,
          image: article.image,
          sections: article.sections,
          sectionsCount: article.sections?.length || 0,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt
        },
        message,
        authMethod: result.authMethod || 'mcp_token'
      };

    } catch (error) {
      console.error('[GetArticle] Fetch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network or parsing error',
        type: 'fetch_error'
      };
    }
  }
};

export default getArticleTool;
