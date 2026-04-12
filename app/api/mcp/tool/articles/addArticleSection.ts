// app/api/mcp/tool/articles/addArticleSection.ts - MCP tool for appending sections to articles

export const addArticleSectionTool = {
  name: 'add_article_section',
  description: `➕ ADD ARTICLE SECTION TOOL (SuperAdmin/ContentCreator only)

Append new sections to the end of an article. Supports all section types including text, card carousels, videos, and more.

🔥 FEATURES:
• Append single or multiple sections to article
• Supports all section types (text, card-carousel, video, creator-spotlight, callout, opportunity-card, spotlight-card)
• Automatic validation of section structure
• Preview mode to see what will be added
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
1. mode: "preview" - Show what will be added (default)
2. mode: "confirm" - Actually add the section(s)

🔐 AUTHENTICATION: OAuth 2.1 Bearer token required. Requires article ownership or SuperAdmin role.

📖 EXAMPLES:
• By slug: { articleId: "briar-guide", section: { type: "text", content: "# Strategy Guide\\n\\nThis is..." } }
• By ObjectId: { articleId: "507f1f77bcf86cd799439011", section: { type: "text", content: "..." } }
• Multiple: { articleId: "briar-guide", sections: [{ type: "text", ... }, { type: "card-carousel", cards: [...] }] }
• Card carousel: { articleId: "briar-guide", section: { type: "card-carousel", cards: [{ printingId: "WTR001", caption: "..." }] } }

💡 Always preview before confirming to verify section structure.`,

  parameters: {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['preview', 'confirm'],
        default: 'preview',
        description: 'preview: Show what will be added, confirm: Actually add sections'
      },
      articleId: {
        type: 'string',
        description: 'The article identifier - can be either MongoDB ObjectId (_id) or slug (URL-friendly identifier like "briar-guide")'
      },
      section: {
        type: 'object',
        description: 'Single section to append (use this OR sections, not both)',
        properties: {
          type: {
            type: 'string',
            enum: ['text', 'card-carousel', 'video', 'creator-spotlight', 'callout', 'opportunity-card', 'spotlight-card'],
            description: 'Section type'
          }
        }
      },
      sections: {
        type: 'array',
        description: 'Multiple sections to append (use this OR section, not both)',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['text', 'card-carousel', 'video', 'creator-spotlight', 'callout', 'opportunity-card', 'spotlight-card']
            }
          }
        }
      },
    },
    required: ['articleId']
  },

  async handler(params: any, authenticatedUser?: any, mcpToken?: string) {
    const API_BASE_URL = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://fabbazaar.app');

    try {
      const {
        mode = 'preview',
        articleId,
        section,
        sections
      } = params;

      // Validate input
      if (!articleId) {
        return {
          success: false,
          error: 'Article ID is required'
        };
      }

      if (!section && !sections) {
        return {
          success: false,
          error: 'Either section or sections array is required'
        };
      }

      if (section && sections) {
        return {
          success: false,
          error: 'Provide either section OR sections, not both'
        };
      }

      // Determine operation type and prepare data
      const isBatch = !!sections;
      const operation = isBatch ? 'append_sections' : 'append_section';
      const sectionsToAdd = isBatch ? sections : [section];

      // Validate section structure
      for (const sec of sectionsToAdd) {
        if (!sec.type) {
          return {
            success: false,
            error: 'Each section must have a type field'
          };
        }
      }

      const endpoint = `${API_BASE_URL}/api/articles/${articleId}`;

      const tokenToUse = authenticatedUser?.mcpToken || mcpToken;
      if (!tokenToUse) {
        return { success: false, error: 'Authentication required: no bearer token found.' };
      }

      const url = endpoint;

      // Preview mode - don't make the API call
      if (mode === 'preview') {
        return {
          success: true,
          mode: 'preview',
          operation,
          message: `Preview: Adding ${sectionsToAdd.length} section(s) to article ${articleId}`,
          sections: sectionsToAdd.map((sec, idx) => ({
            index: `new-${idx}`,
            type: sec.type,
            preview: sec.type === 'text'
              ? (sec.content?.substring(0, 100) || 'No content')
              : `${sec.type} section`
          })),
          next_step: "Call again with mode='confirm' to execute"
        };
      }

      // Confirm mode - make the actual API call
      console.log(`[AddArticleSection] Adding section(s) to article: ${articleId}`);
      console.log(`[AddArticleSection] Full URL: ${url}`);
      console.log(`[AddArticleSection] Operation: ${operation}`);

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (tokenToUse) {
        headers['Authorization'] = `Bearer ${tokenToUse}`;
      }

      // Prepare request body
      const requestBody = isBatch
        ? { operation, sections: sectionsToAdd }
        : { operation, section: sectionsToAdd[0] };

      console.log(`[AddArticleSection] Request body:`, JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AddArticleSection] HTTP ${response.status}:`, errorText);

        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          status: response.status,
          debug: {
            url,
            articleId,
            operation,
            authenticatedUser: authenticatedUser?.username || 'None',
            tokenProvided: !!tokenToUse
          }
        };
      }

      const result = await response.json();
      console.log('[AddArticleSection] API Response:', result);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'API returned success: false',
          details: result
        };
      }

      // Success! Format the response
      return {
        success: true,
        mode: 'confirm',
        operation,
        message: `✅ Successfully added ${sectionsToAdd.length} section(s) to article. Total sections: ${result.sectionsCount}`,
        article: {
          _id: result.article._id,
          title: result.article.title,
          slug: result.article.slug,
          sectionsCount: result.sectionsCount
        },
        addedSections: sectionsToAdd.length,
        totalSections: result.sectionsCount
      };

    } catch (error) {
      console.error('[AddArticleSection] Fetch error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network or parsing error',
        type: 'fetch_error'
      };
    }
  }
};

export default addArticleSectionTool;
