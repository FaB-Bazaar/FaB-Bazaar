// app/api/mcp/tool/articles/getArticle.ts - MCP tool for retrieving article by publicId

export const getArticleTool = {
  name: 'get_article',
  description: `📄 ARTICLE RETRIEVAL TOOL (SuperAdmin/ContentCreator only)

Retrieve a full article by its publicId, including all sections and metadata.

🔍 FEATURES:
• Get article by publicId for reading/editing
• Returns complete article structure with all sections
• View section count and metadata
• Optional full content display (includeFullContent: true)
• Role-based access (SuperAdmin or ContentCreator)

📚 USAGE:
• Call list_articles({}) first to look up the publicId of the article you want
• Then call get_article({ articleId: "<publicId>" })
• Set includeFullContent: true to see FULL section text (not just previews)
• Slugs are NOT accepted — they are display-only identifiers shown to readers

🔐 AUTHENTICATION: OAuth 2.1 Bearer token required. Requires SuperAdmin or ContentCreator role.

📖 EXAMPLES:
• Preview mode: get_article({ articleId: "abc123XYZ" })
• Full content mode: get_article({ articleId: "abc123XYZ", includeFullContent: true })
• Debug mode (raw JSON): get_article({ articleId: "abc123XYZ", showRawJson: true })

💡 Use includeFullContent: true when you need to read/edit the complete text of sections.
💡 Use showRawJson: true when debugging section structure or checking exact JSON format.`,

  parameters: {
    type: 'object',
    properties: {
      articleId: {
        type: 'string',
        description: 'The article publicId (from list_articles). Slugs are not accepted.'
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
    },
    required: ['articleId']
  },

  async handler(params: any, authenticatedUser?: any, mcpToken?: string) {
    const API_BASE_URL = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://fabbazaar.app');

    try {
      const { articleId, includeFullContent = false, showRawJson = false } = params;

      if (!articleId) {
        return {
          success: false,
          error: 'articleId is required (get the publicId from list_articles)'
        };
      }

      const tokenToUse = authenticatedUser?.mcpToken || mcpToken;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no bearer token found.' };
      }

      const url = `${API_BASE_URL}/api/articles/${encodeURIComponent(articleId)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenToUse}`,
        },
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
            articleId,
            authenticatedUser: authenticatedUser?.username || 'None',
            tokenProvided: !!tokenToUse
          }
        };
      }

      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'API returned success: false',
          details: result
        };
      }

      const article = result.data;

      if (!article) {
        return {
          success: false,
          error: `Article not found with publicId: ${articleId}`,
          articleId
        };
      }

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
          message += `\n📋 RAW JSON Structure:\n\n`;
          message += JSON.stringify(article.sections, null, 2);
        } else {
          message += `\n📋 Section ${includeFullContent ? 'Content' : 'Structure'}:\n`;
          article.sections.forEach((section: any, index: number) => {
            message += `\n  ${index}. ${section.type}`;

            if (includeFullContent) {
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
          publicId: article.publicId,
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
