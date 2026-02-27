// app/api/mcp/resource/articleFormatting.ts - Article formatting constants and syntax guide

export const articleFormattingResource = {
  name: 'Article Formatting Guide',
  description: `Essential formatting rules and syntax for FaB Bazaar article content, including inline card syntax and section types`,

  async handler() {
    return {
      version: '1.0.0',
      lastUpdated: '2025-01-26',

      // INLINE CARD SYNTAX
      inlineCardSyntax: {
        description: 'How to reference cards inline within text sections',
        format: '<InlineCard printingId="PRINTING_ID">Card Name</InlineCard>',

        // CRITICAL JSON FORMATTING NOTE
        jsonPayloadNote: '⚠️ IMPORTANT: When providing JSON payloads to update_article_section, use normal quotes in the content string. Do NOT escape quotes with backslashes unless the content itself contains quotes that need escaping. The JSON parser handles quote escaping automatically.',

        rules: [
          'Always use the exact printingId from the database',
          'Card name inside tags must match the actual card name',
          'Use for card references within article text',
          'Renders as an interactive hover card on the website',
          'Bold the entire InlineCard tag with double asterisks: **<InlineCard>...</InlineCard>**'
        ],

        // Template for easy copy-paste
        template: {
          format: '**<InlineCard printingId="PRINTING_ID">CARD_NAME</InlineCard>**',
          note: 'Replace PRINTING_ID with actual ID from search results, CARD_NAME with actual card name'
        },

        examples: [
          {
            description: 'Single card reference',
            markdown: 'I played **<InlineCard printingId="mWc8wqTQgjkhfJ9L7pwqL">Crumble to Eternity</InlineCard>** on his equipment.',
            explanation: 'Card name is bolded and wrapped in InlineCard tags with printingId'
          },
          {
            description: 'Multiple cards in sentence',
            markdown: 'He had **<InlineCard printingId="JrkdqCNm8TWbQzWPJjbTD">Fyendal\'s Spring Tunic</InlineCard>** and **<InlineCard printingId="8kqGPjkF9KWWcDdnqCHDc">Gold-Baited Hook</InlineCard>** equipped.',
            explanation: 'Each card gets its own InlineCard tag with unique printingId'
          },
          {
            description: 'Card with parenthetical pitch',
            markdown: 'I blocked with **<InlineCard printingId="QhnzrhHdbbRG6WztJwrDH">Golden Tipple (Blue)</InlineCard>**.',
            explanation: 'Include pitch color in card name: (Red), (Yellow), (Blue)'
          }
        ],

        commonMistakes: [
          'Missing printingId attribute',
          'Using wrong printingId (must match exact printing)',
          'Not including card name between tags',
          'Forgetting to bold the card name with **',
          'Using card_unique_id instead of printingId',
          'Adding unnecessary backslashes before quotes in JSON payloads'
        ],

        // Good vs Bad Examples for JSON Payloads
        jsonExamples: {
          wrong: {
            description: '❌ WRONG - Do NOT use backslash escaping',
            content: '**<InlineCard printingId=\\"abc123\\">Card Name</InlineCard>**',
            note: 'This will render with literal backslashes in the content'
          },
          correct: {
            description: '✅ CORRECT - Use normal quotes',
            content: '**<InlineCard printingId="abc123">Card Name</InlineCard>**',
            note: 'JSON parser handles quote escaping automatically'
          },
          fullExample: {
            description: '✅ FULL CORRECT PAYLOAD for update_article_section',
            payload: {
              articleId: '507f1f77bcf86cd799439011',
              index: 5,
              section: {
                type: 'text',
                content: 'I played **<InlineCard printingId="mWc8wqTQgjkhfJ9L7pwqL">Crumble to Eternity</InlineCard>** on his **<InlineCard printingId="JrkdqCNm8TWbQzWPJjbTD">Fyendal\'s Spring Tunic</InlineCard>**.'
              },
              mode: 'preview'
            },
            note: 'Notice: normal quotes in content, no backslashes needed'
          }
        }
      },

      // SECTION TYPES
      sectionTypes: {
        description: 'Available section types for article structure',

        types: {
          text: {
            description: 'Markdown text content with inline cards',
            structure: {
              type: 'text',
              content: 'Raw markdown content - use normal quotes, no JSON escaping needed'
            },
            supports: [
              'Markdown formatting (bold, italic, lists, headings)',
              'InlineCard syntax for card references',
              'Code blocks, blockquotes',
              'Links and images'
            ],
            example: {
              type: 'text',
              content: '## Strategy Guide\n\nThis deck focuses on **<InlineCard printingId="xyz">Card Name</InlineCard>**.\n\n- Point 1\n- Point 2'
            },
            important: '⚠️ When sending as JSON: Use normal quotes in content field. Do NOT escape quotes with backslashes.'
          },

          'card-carousel': {
            description: 'Display multiple cards in a carousel/grid',
            structure: {
              type: 'card-carousel',
              cards: [
                { printingId: 'string', caption: 'optional string' }
              ]
            },
            example: {
              type: 'card-carousel',
              cards: [
                { printingId: 'mWc8wqTQgjkhfJ9L7pwqL', caption: 'Key removal card' },
                { printingId: 'JrkdqCNm8TWbQzWPJjbTD', caption: 'Essential equipment' }
              ]
            }
          },

          video: {
            description: 'Embed YouTube video',
            structure: {
              type: 'video',
              videoId: 'YouTube video ID',
              title: 'optional string',
              description: 'optional string',
              creatorName: 'optional string',
              creatorUrl: 'optional string'
            }
          },

          callout: {
            description: 'Important notice or highlight box',
            structure: {
              type: 'callout',
              text: 'string',
              linkHref: 'optional URL',
              linkText: 'optional string'
            }
          },

          'creator-spotlight': {
            description: 'Highlight content creator',
            structure: {
              type: 'creator-spotlight',
              name: 'string',
              imageUrl: 'optional string',
              links: [
                { label: 'string', url: 'string', icon: 'optional string' }
              ]
            }
          },

          'opportunity-card': {
            description: 'Trading opportunity card showcase',
            structure: {
              type: 'opportunity-card',
              printingId: 'string',
              reason: 'underpriced | trending | supply-issue | correction | outlier',
              confidence: 'low | medium | high',
              priceChange: {
                old: 'number',
                new: 'number',
                percentage: 'number'
              },
              note: 'optional string'
            }
          },

          'spotlight-card': {
            description: 'Featured card highlight',
            structure: {
              type: 'spotlight-card',
              printingId: 'string',
              title: 'string',
              commentary: 'string'
            }
          }
        }
      },

      // MARKDOWN SYNTAX
      markdownSyntax: {
        description: 'Supported markdown formatting in text sections',

        headings: {
          h1: '# Heading 1',
          h2: '## Heading 2',
          h3: '### Heading 3',
          h4: '#### Heading 4'
        },

        textFormatting: {
          bold: '**bold text**',
          italic: '*italic text*',
          strikethrough: '~~strikethrough~~',
          code: '`inline code`'
        },

        lists: {
          unordered: '- Item 1\n- Item 2',
          ordered: '1. First\n2. Second',
          nested: '- Parent\n  - Child\n  - Child'
        },

        links: '[Link text](https://url.com)',
        images: '![Alt text](https://image-url.com)',
        blockquote: '> Quote text',
        codeBlock: '```language\ncode here\n```',
        horizontalRule: '---'
      },

      // BEST PRACTICES
      bestPractices: [
        'Always search for cards first using search_printings to get correct printingIds',
        'Use extract_printing_ids to get a list of printingIds for inline cards',
        'Bold card names when using InlineCard syntax: **<InlineCard>...</InlineCard>**',
        'Include pitch color in card name when applicable: (Red), (Yellow), (Blue)',
        'Use card-carousel sections for visual card showcases',
        'Use text sections with InlineCard for narrative card references',
        'Preview updates with mode: "preview" before confirming',
        'Use includeFullContent: true when reading sections to edit'
      ],

      // WORKFLOW
      recommendedWorkflow: [
        '1. Get article structure: get_article({ slug: "...", includeFullContent: true })',
        '2. Search for cards: search_printings({ filters: { name: "Card Name" } })',
        '3. Extract IDs: extract_printing_ids({ filters: { name: "Card Name" } })',
        '4. Update section with InlineCard syntax: update_article_section({ ... })',
        '5. Preview changes: mode: "preview"',
        '6. Confirm changes: mode: "confirm"'
      ]
    };
  }
};

export default articleFormattingResource;
