// app/api/mcp/tool/articles/updateArticleSection.ts - MCP tool for updating existing article sections

export const updateArticleSectionTool = {
  name: 'update_article_section',
  description: `✏️ UPDATE ARTICLE SECTION TOOL (SuperAdmin/ContentCreator only)

Update an existing section in an article by its index. Replaces the entire section at the specified position.

🔥 FEATURES:
• Update section at specific index position
• Replace entire section content
• Supports all section types (text, card-carousel, video, etc.)
• Preview mode to see what will be changed
• Ownership validation (author or SuperAdmin only)

📝 SECTION TYPES SUPPORTED:
• text: Markdown content sections
• card-carousel: Display multiple cards in a carousel
• video: Embed YouTube videos with metadata
• creator-spotlight: Highlight content creators
• callout: Important notice boxes
• opportunity-card: Trading opportunities
• spotlight-card: Featured card highlights

🔄 TWO-STEP PROCESS:
1. mode: "preview" - Show what will be updated (default)
2. mode: "confirm" - Actually update the section

🔐 AUTHENTICATION: OAuth 2.1 Bearer token required. Requires article ownership or SuperAdmin role.

💡 WORKFLOW:
1. Use get_article to see current sections and their indices
2. Preview the update to verify changes
3. Confirm to apply the update

📖 EXAMPLES:
• By slug: { articleId: "briar-guide", index: 2, section: { type: "text", content: "# Updated content..." } }
• By ObjectId: { articleId: "507f1f77bcf86cd799439011", index: 0, section: { type: "card-carousel", cards: [...] } }
• With preview: { mode: "preview", articleId: "briar-guide", index: 1, section: { type: "video", videoId: "..." } }

⚠️ This replaces the ENTIRE section at the given index - make sure the section structure is complete!`,

  parameters: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['preview', 'confirm'],
        default: 'preview',
        description: 'preview: Show what will be updated, confirm: Actually update section'
      },
      articleId: {
        type: 'string',
        description: 'The article identifier - can be either MongoDB ObjectId (_id) or slug (URL-friendly identifier like "briar-guide")'
      },
      index: {
        type: 'number',
        description: 'The zero-based index of the section to update (0 = first section)'
      },
      section: {
        type: 'object',
        description: 'The complete new section that will replace the existing one',
        properties: {
          type: {
            type: 'string',
            enum: ['text', 'card-carousel', 'video', 'creator-spotlight', 'callout', 'opportunity-card', 'spotlight-card'],
            description: 'Section type'
          }
        },
        required: ['type']
      },
    },
    required: ['articleId', 'index', 'section']
  },

  async handler(params: any, authenticatedUser?: any, mcpToken?: string) {
    const API_BASE_URL = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://fabbazaar.app');

    try {
      const {
        mode = 'preview',
        articleId,
        index,
        section
      } = params;

      // Validate input
      if (!articleId) {
        return {
          success: false,
          error: 'Article ID is required'
        };
      }

      if (typeof index !== 'number') {
        return {
          success: false,
          error: 'Section index is required and must be a number'
        };
      }

      if (index < 0) {
        return {
          success: false,
          error: 'Section index must be 0 or greater'
        };
      }

      if (!section || !section.type) {
        return {
          success: false,
          error: 'Section with type field is required'
        };
      }

      const endpoint = `${API_BASE_URL}/api/articles/${articleId}`;

      const tokenToUse = authenticatedUser?.mcpToken || mcpToken;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no bearer token found.' };
      }

      const url = endpoint;

      // Preview mode - don't make the API call
      if (mode === 'preview') {
        let sectionPreview = `Type: ${section.type}`;

        if (section.type === 'text' && section.content) {
          const preview = section.content.substring(0, 100).replace(/\n/g, ' ');
          sectionPreview += `\nContent preview: "${preview}${section.content.length > 100 ? '...' : ''}"`;
        } else if (section.type === 'card-carousel' && section.cards) {
          sectionPreview += `\nCards: ${section.cards.length} cards`;
        } else if (section.type === 'video' && section.title) {
          sectionPreview += `\nVideo: "${section.title}"`;
        }

        return {
          success: true,
          mode: 'preview',
          operation: 'update_section',
          message: `Preview: Updating section ${index} in article ${articleId}`,
          update: {
            articleId,
            index,
            newSection: sectionPreview
          },
          next_step: "Call again with mode='confirm' to execute"
        };
      }

      // Confirm mode - make the actual API call
      console.log(`[UpdateArticleSection] Updating section ${index} in article: ${articleId}`);
      console.log(`[UpdateArticleSection] Full URL: ${url}`);

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (tokenToUse) {
        headers['Authorization'] = `Bearer ${tokenToUse}`;
      }

      // Prepare request body
      const requestBody = {
        operation: 'update_section',
        index,
        section
      };

      console.log(`[UpdateArticleSection] Request body:`, JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[UpdateArticleSection] HTTP ${response.status}:`, errorText);

        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          status: response.status,
          debug: {
            url,
            articleId,
            index,
            operation: 'update_section',
            authenticatedUser: authenticatedUser?.username || 'None',
            tokenProvided: !!tokenToUse
          }
        };
      }

      const result = await response.json();
      console.log('[UpdateArticleSection] API Response:', result);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'API returned success: false',
          details: result
        };
      }

      // Success! Format the response
      let successMessage = `✅ Successfully updated section ${index} in article`;

      if (result.article?.title) {
        successMessage += ` "${result.article.title}"`;
      }

      successMessage += `. Total sections: ${result.sectionsCount}`;

      return {
        success: true,
        mode: 'confirm',
        operation: 'update_section',
        message: successMessage,
        article: {
          _id: result.article._id,
          title: result.article.title,
          slug: result.article.slug,
          sectionsCount: result.sectionsCount
        },
        updatedSection: {
          index,
          type: section.type
        }
      };

    } catch (error) {
      console.error('[UpdateArticleSection] Fetch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network or parsing error',
        type: 'fetch_error'
      };
    }
  }
};

export default updateArticleSectionTool;
