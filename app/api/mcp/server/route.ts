// app/api/mcp/server/route.ts - WITH OAUTH 2.1 AND LEGACY MCP TOKEN SUPPORT
import { NextResponse } from "next/server";
import { searchCapabilitiesResource } from '../resource/searchCapabilities';
import { fabConstantsResource } from '../resource/fabConstants';
import { articleFormattingResource } from '../resource/articleFormatting';
import { cardIndexResource } from '../resource/cardIndex';
import { heroIdsResource } from '../resource/heroIds';
import { rateLimit } from '@/lib/rate-limit';
import { authTokenService, userService } from '@/lib/services';

// Import the tools
import { searchPrintingsTool } from '../tool/searchPrintings';
import { extractPrintingIdsTool } from '../tool/extractPrintingIds';
import { updateBinderTool } from '../tool/updateBinder';
import { removeFromBinderTool } from '../tool/removeFromBinder';
import { getBinderTool } from '../tool/getBinder';
import { listBindersTool } from '../tool/listBinders';
import { getWantsTool } from '../tool/getWants';
import { updateWantsTool } from '../tool/updateWants';
import { whoHasTool } from '../tool/whoHas';

// Import curation tools (curator/admin only)
import { listCuratedListsTool } from '../tool/curation/listCuratedLists';
import { getCuratedListTool } from '../tool/curation/getCuratedList';
import { createCuratedListTool } from '../tool/curation/createCuratedList';
import { updateCuratedListTool } from '../tool/curation/updateCuratedList';
import { deleteCuratedListTool } from '../tool/curation/deleteCuratedList';
import { addCardToListTool } from '../tool/curation/addCardToList';
import { removeCardFromListTool } from '../tool/curation/removeCardFromList';

// Import deck tools
import { listDecksTool } from '../tool/listDecks';
import { getDeckTool } from '../tool/getDeck';
import { createDeckTool } from '../tool/createDeck';
import { addCardsToDeckTool } from '../tool/addCardsToDeck';
import { removeCardsFromDeckTool } from '../tool/removeCardsFromDeck';
import { updateDeckTool } from '../tool/updateDeck';
import { saveDeckMatchupTool } from '../tool/saveDeckMatchup';
import { getArticleTool } from '../tool/articles/getArticle';
import { addArticleSectionTool } from '../tool/articles/addArticleSection';
import { updateArticleSectionTool } from '../tool/articles/updateArticleSection';
import { scanPrintingTool } from '../tool/scanPrinting';

// Import the prompts
import { mcpPrompts, getPromptByName } from '../prompt';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  requests: 200,        // 200 requests
  windowMs: 3600000,    // per hour (3600000ms)
  message: "Rate limit exceeded. Please wait before making more requests."
};

// Environment-based debug logging - suppress sensitive logs in production
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DEBUG_MCP = !IS_PRODUCTION;

// OAuth 2.1 Bearer token validation (uses service layer)
async function validateOAuth2Token(token: string): Promise<{ isValid: boolean; user?: any; clientId?: string; scope?: string; error?: string }> {
  if (DEBUG_MCP) {
    console.log('=== OAUTH TOKEN VALIDATION START ===');
    console.log('Token received:', token ? `${token.substring(0, 20)}...` : 'null/undefined');
  }

  try {
    const result = await authTokenService.validateOAuthToken(token);

    if (!result.success) {
      if (DEBUG_MCP) console.log('❌ Token validation error:', result.error);
      return { isValid: false, error: result.error };
    }

    if (DEBUG_MCP) {
      if (result.data.isValid && result.data.user) {
        console.log(`✅ OAuth token validated for user: ${result.data.user.username}`);
      } else if (result.data.isValid && result.data.clientId) {
        console.log(`✅ Client credentials token validated: ${result.data.clientId}`);
      } else {
        console.log('❌ Token invalid:', result.data.error);
      }
    }

    return result.data;
  } catch (error) {
    console.error('💥 General error in validateOAuth2Token:', error);
    return { isValid: false, error: "Token validation error" };
  } finally {
    if (DEBUG_MCP) console.log('=== OAUTH TOKEN VALIDATION END ===');
  }
}

// Helper to get client IP
function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

// Helper to validate query complexity
function validateQueryComplexity(toolInput: any): { isValid: boolean; error?: string } {
  const { filters = {}, options = {} } = toolInput;
  
  // Prevent overly broad searches
  if (filters.searchableText && filters.searchableText.length < 2) {
    return { 
      isValid: false, 
      error: "Search text must be at least 2 characters" 
    };
  }
  
  // Require some filtering for very large result sets
  const hasSpecificFilter = !!(
    filters.name || 
    filters.sets?.length || 
    filters.types?.length ||
    filters.printingCardId ||
    filters.printingIds ||
    filters.text
  );
  
  if (!hasSpecificFilter && (options.limit > 50 || !options.limit)) {
    return { 
      isValid: false, 
      error: "Large queries require at least one specific filter (name, set, type, or text)" 
    };
  }
  
  // Cap limits
  if (options.limit > 100) {
    return { 
      isValid: false, 
      error: "Maximum limit is 100 results per request" 
    };
  }
  
  if (options.page > 1000) {
    return { 
      isValid: false, 
      error: "Maximum page number is 1000" 
    };
  }
  
  return { isValid: true };
}

// Check if required resources have been confirmed
function validateResourceRequirement(toolInput: any, toolName: string): { isValid: boolean; error?: string } {
  // Only enforce for search-related tools
  if (!['search_printings', 'extract_printing_ids'].includes(toolName)) {
    return { isValid: true };
  }

  if (!toolInput._resourcesConfirmed) {
    return {
      isValid: false,
      error: `🚨 ${toolName.toUpperCase()} BLOCKED - MISSING REQUIRED SETUP 🚨

This tool is BLOCKED until you complete the mandatory setup:

REQUIRED STEPS (in order):
1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})
3️⃣ Then retry with: ${toolName}({..., "_resourcesConfirmed": true})

🔴 Why this is required:
• Without constants: Wrong set codes, foiling types, edition codes
• Without capabilities: Missing filters, wrong parameters, failed queries
• Result: Inaccurate or failed searches

📚 The setup takes 30 seconds and prevents hours of frustration!

❌ Blocked: ${toolName} until setup complete`
    };
  }

  return { isValid: true };
}

// Enhanced tools/call handler
export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  console.log('[API TRACK] /api/mcp/server called at', timestamp);

  if (DEBUG_MCP) {
    console.log('🚨 MCP SERVER POST FUNCTION HIT!');
    console.log('Request URL:', req.url);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
  }
  if (DEBUG_MCP) {
    console.log('=== MCP SERVER ENDPOINT HIT ===');
    console.log('Timestamp:', timestamp);
  }

  // Get client IP first
  const clientIP = getClientIP(req);
  if (DEBUG_MCP) console.log('Client IP:', clientIP);

  // OAuth 2.1 Bearer Token Authentication
  const authHeader = req.headers.get('Authorization');
  let authenticatedUser = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const oauthValidation = await validateOAuth2Token(token);

    if (oauthValidation.isValid) {
      authenticatedUser = oauthValidation.user;
      if (DEBUG_MCP) console.log(`✅ OAuth 2.1 authenticated: ${authenticatedUser ? authenticatedUser.username : 'Client Credentials'} from IP: ${clientIP}`);
    } else {
      if (DEBUG_MCP) console.log(`❌ OAuth token validation failed: ${oauthValidation.error}`);
      return NextResponse.json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32001,
          message: `OAuth 2.1 authentication failed: ${oauthValidation.error}`
        }
      }, { status: 401, headers: unauthenticatedHeaders(req) });
    }
  } else {
    if (DEBUG_MCP) console.log(`❌ Authentication failed: No Authorization header from IP: ${clientIP}`);
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32001,
        message: "Authentication required. Provide Authorization: Bearer <oauth_token>.",
        data: {
          hint: "Obtain an OAuth 2.1 token via the client credentials or authorization code flow"
        }
      }
    }, { status: 401, headers: unauthenticatedHeaders(req) });
  }

  // Bearer token for downstream tool calls (auth already validated above)
  const bearerToken = authHeader.substring(7);
  const authMethod = 'oauth2';

  // Rate limiting check (with higher limits for authenticated users)
  try {
    // Higher rate limits for authenticated token users
    const authenticatedLimits = {
      requests: 500,      // 500 requests/hour for token users
      windowMs: 3600000
    };

    const rateLimitResult = await rateLimit({
      key: `mcp:${clientIP}:${authenticatedUser ? authenticatedUser._id : 'client_credentials'}`, // Handle both user-specific and general tokens
      limit: authenticatedLimits.requests,
      window: authenticatedLimits.windowMs
    });

    if (!rateLimitResult.success) {
      if (DEBUG_MCP) console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return NextResponse.json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32003,
          message: "Rate limit exceeded for authenticated users. Please wait before making more requests.",
          data: {
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime,
            limit: 500 // Show the higher limit for token users
          }
        }
      }, {
        status: 429,
        headers: {
          ...corsHeaders(),
          'X-RateLimit-Limit': '500', // Updated for token users
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime?.toString() || '',
          'Retry-After': '3600' // 1 hour
        }
      });
    }

    if (DEBUG_MCP) console.log(`Rate limit OK - Remaining: ${rateLimitResult.remaining}`);
  } catch (rateLimitError) {
    console.error('Rate limiting error:', rateLimitError);
    // Continue without rate limiting if there's an error (fail open)
  }

  let bodyText = '';
  try {
    bodyText = await req.text();
    if (DEBUG_MCP) console.log('Raw Body:', bodyText);
  } catch (e) {
    if (DEBUG_MCP) console.log('Error reading body:', e);
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" }
    }, { status: 400, headers: corsHeaders() });
  }

  let body: any = {};
  try {
    body = JSON.parse(bodyText);
  } catch (e) {
    if (DEBUG_MCP) console.log('Error parsing JSON body:', e);
    return NextResponse.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" }
    }, { status: 400, headers: corsHeaders() });
  }

  const method = body.method || undefined;
  const params = body.params || undefined;
  const id = body.id;

  if (DEBUG_MCP) {
    console.log('=== MCP REQUEST ===');
    console.log('Method:', method);
    console.log('Params:', JSON.stringify(params, null, 2));
    console.log('Auth Method:', authMethod);
    console.log('User:', authenticatedUser ? authenticatedUser.username : 'Client Credentials');
    console.log('===============================');
  }

  try {
    switch (method) {
      case 'notifications/initialized':
        // MCP handshake notification — no response body required
        return new NextResponse(null, { status: 200, headers: corsHeaders() });

      case 'initialize':
        return NextResponse.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            protocolVersion: '2025-06-18',
            capabilities: {
              tools: {
                available: ['read_mandatory_constants_first', 'search_printings', 'extract_printing_ids', 'list_binders', 'get_binder', 'update_binder', 'get_wants', 'update_wants', 'who_has', 'get_article', 'add_article_section', 'update_article_section', 'list_decks', 'get_deck']
              },
              resources: {
                available: ['searchable://card/fields', 'fab://constants', 'article://formatting', 'fab://hero-ids']
              }
            },
            serverInfo: {
              name: 'FabBazaar MCP [DEV]',
              version: '4.1.0',
              user: authenticatedUser ? authenticatedUser.username : 'Client Credentials'
            }
          }          
        }, { headers: corsHeaders() });

      case 'tools/list': {
        // Check if user has curator/admin role for conditional tool visibility
        let isCurator = false;
        if (authenticatedUser?._id) {
          const [curatorCheck, adminCheck] = await Promise.all([
            userService.hasRole(authenticatedUser._id, 'isCurator'),
            userService.hasRole(authenticatedUser._id, 'isSuperAdmin'),
          ]);
          isCurator = !!(curatorCheck.success && curatorCheck.data) || !!(adminCheck.success && adminCheck.data);
        }

        const curatorTools = isCurator ? [
          {
            name: listCuratedListsTool.name,
            description: listCuratedListsTool.description,
            inputSchema: listCuratedListsTool.parameters
          },
          {
            name: getCuratedListTool.name,
            description: getCuratedListTool.description,
            inputSchema: getCuratedListTool.parameters
          },
          {
            name: createCuratedListTool.name,
            description: createCuratedListTool.description,
            inputSchema: createCuratedListTool.parameters
          },
          {
            name: updateCuratedListTool.name,
            description: updateCuratedListTool.description,
            inputSchema: updateCuratedListTool.parameters
          },
          {
            name: deleteCuratedListTool.name,
            description: deleteCuratedListTool.description,
            inputSchema: deleteCuratedListTool.parameters
          },
          {
            name: addCardToListTool.name,
            description: addCardToListTool.description,
            inputSchema: addCardToListTool.parameters
          },
          {
            name: removeCardFromListTool.name,
            description: removeCardFromListTool.description,
            inputSchema: removeCardFromListTool.parameters
          }
        ] : [];

        return NextResponse.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            tools: [
              // PRIORITY TOOL - Listed first with MAXIMUM emphasis
              {
                name: 'read_mandatory_constants_first',
                description: `🚨 STEP 1: MANDATORY SETUP (99% of users need this first!) 🚨

⭐ CRITICAL: Run this TWICE with different URIs ⭐

REQUIRED SEQUENCE:
1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})  
2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})

📋 What this provides:
• Step 1: Set codes (wtr=Welcome to Rathe, arc=Arcane Rising, etc.)
• Step 1: Foiling types (r=Rainbow Foil, c=Cold Foil, s=Standard, g=Gold)
• Step 1: Edition codes (a=Alpha, f=First Edition, u=Unlimited, n=Normal)
• Step 1: Rarity codes (m=Majestic, l=Legendary, r=Rare, c=Common, f=Fabled)
• Step 2: Complete API documentation and search field reference

⚡ Takes 30 seconds, saves hours of debugging!
🔒 OTHER TOOLS ARE BLOCKED until you complete this setup!

⚠️ WORKFLOW: read_mandatory_constants_first (2x) → search_printings → extract_printing_ids → update_binder

✅ Always run this tool FIRST in any session!`,
                inputSchema: {
                  type: 'object',
                  properties: {
                    uri: { 
                      type: 'string', 
                      description: 'Resource URI to read: "fab://constants" for abbreviations or "searchable://card/fields" for search capabilities',
                      enum: ['fab://constants', 'searchable://card/fields'],
                      default: 'fab://constants'
                    }
                  },
                  required: ['uri']
                }
              },
              
              // SECONDARY TOOLS - Enhanced with BLOCKED warnings
              {
                  name: searchPrintingsTool.name,
                  description: `🔍 CARD SEARCH AND DISCOVERY TOOL

                Use this tool when users want to:
                - Search for cards by name, type, set, etc.
                - Verify cards exist before adding to binder/wants
                - Explore different printings/versions of a card
                - Find cards with specific criteria

                PERFECT FOR: "add 3 nf enlightened strike" - search first to verify the card exists and show options

                ${searchPrintingsTool.description}

                🎯 TYPICAL WORKFLOW:
                1. User: "add X to my binder" 
                2. YOU: Call search_printings to find and verify the card
                3. Show user what was found
                4. User confirms or refines search
                5. Then use extract_printing_ids → update_binder

                🔒 This tool is BLOCKED until setup complete!`,
                  inputSchema: searchPrintingsTool.parameters
                },
                {
                  name: extractPrintingIdsTool.name,
                  description: `🆔 PRINTING ID EXTRACTION - For confirmed card selections

                Use this tool AFTER search_printings when:
                - User has confirmed which cards they want
                - Ready to prepare for binder/wants updates
                - Need selection interface for multiple printings

                NOT for initial searches - use search_printings first!

                ${extractPrintingIdsTool.description}

                🎯 WORKFLOW POSITION:
                search_printings (explore) → extract_printing_ids (select) → update_binder (commit)

                🔒 This tool is BLOCKED until setup complete!`,
                  inputSchema: extractPrintingIdsTool.parameters
                },
                    {
                name: updateBinderTool.name,
                description: updateBinderTool.description,
                inputSchema: updateBinderTool.parameters
              },
              {
                name: removeFromBinderTool.name,
                description: removeFromBinderTool.description,
                inputSchema: removeFromBinderTool.parameters
              },
              {
                name: scanPrintingTool.name,
                description: scanPrintingTool.description,
                inputSchema: scanPrintingTool.parameters
              },
              {
                name: updateWantsTool.name,
                description: `📝 WANTS LIST MANAGEMENT TOOL (Works independently)
              
              ${updateWantsTool.description}
              
              💡 Note: This tool works independently and doesn't require the search setup steps.
              
              📚 Perfect companion to get_wants:
              Step 1: get_wants (view current wants)
              Step 2: search_printings (find new cards) [optional]
              Step 3: update_wants (add cards to wants list)
              Step 4: get_wants (verify additions)
              
              ✅ This tool works without any setup requirements!`,
                inputSchema: updateWantsTool.parameters
              },
              {
                name: listBindersTool.name,
                description: listBindersTool.description,
                inputSchema: listBindersTool.parameters
              },
              {
                name: getBinderTool.name,
                description: `📋 VIEW BINDER CONTENTS (Works independently)

${getBinderTool.description}

💡 Note: This tool works independently and doesn't require the search setup steps.

📚 Recommended workflow:
Step 1: list_binders (see all your binders)
Step 2: get_binder (view specific binder contents using slug from step 1)
Step 3: search_printings (find new cards) [optional]
Step 4: update_binder (add cards to collection)
Step 5: get_binder (verify additions)

✅ This tool works without any setup requirements!`,
                inputSchema: getBinderTool.parameters
              },
              {
                name: listDecksTool.name,
                description: listDecksTool.description,
                inputSchema: listDecksTool.parameters
              },
              {
                name: getDeckTool.name,
                description: getDeckTool.description,
                inputSchema: getDeckTool.parameters
              },
              {
                name: createDeckTool.name,
                description: createDeckTool.description,
                inputSchema: createDeckTool.parameters
              },
              {
                name: addCardsToDeckTool.name,
                description: addCardsToDeckTool.description,
                inputSchema: addCardsToDeckTool.parameters
              },
              {
                name: removeCardsFromDeckTool.name,
                description: removeCardsFromDeckTool.description,
                inputSchema: removeCardsFromDeckTool.parameters
              },
              {
                name: updateDeckTool.name,
                description: updateDeckTool.description,
                inputSchema: updateDeckTool.parameters
              },
              {
                name: saveDeckMatchupTool.name,
                description: saveDeckMatchupTool.description,
                inputSchema: saveDeckMatchupTool.parameters
              },
              {
                name: getWantsTool.name,
                description: `📋 WANTS LIST RETRIEVAL TOOL (Works independently)
              
              ${getWantsTool.description}
              
              💡 Note: This tool works independently and doesn't require the search setup steps.
              
              📚 Perfect companion to update_wants:
              Step 1: get_wants (view current wants)
              Step 2: search_printings (find new cards) [optional]
              Step 3: update_wants (add cards to wants list)
              Step 4: get_wants (verify additions)
              
              ✅ This tool works without any setup requirements!`,
                inputSchema: getWantsTool.parameters
              },
              {
                name: whoHasTool.name,
                description: `🔍 FIND CARD OWNERS (Works with setup)
      
      ${whoHasTool.description}
      
      🔴 HARD REQUIREMENT: Complete the 2-step setup first!
         1. read_mandatory_constants_first({"uri": "fab://constants"})
         2. read_mandatory_constants_first({"uri": "searchable://card/fields"})
      
      ❌ Without setup: Tool will be BLOCKED
      ✅ With setup: Accurate owner matching with proper card identification
      
      📚 WORKFLOW INTEGRATION: 
         Step 1-2: Complete setup (see read_mandatory_constants_first)
         Step 3: search_printings (find cards)
         Step 4: extract_printing_ids (get IDs)
         Step 5: who_has (find owners)
      
      🔒 This tool is BLOCKED until setup complete!`,
                inputSchema: whoHasTool.parameters
              },

              // ARTICLE MANAGEMENT TOOLS
              {
                name: getArticleTool.name,
                description: getArticleTool.description,
                inputSchema: getArticleTool.parameters
              },
              {
                name: addArticleSectionTool.name,
                description: addArticleSectionTool.description,
                inputSchema: addArticleSectionTool.parameters
              },
              {
                name: updateArticleSectionTool.name,
                description: updateArticleSectionTool.description,
                inputSchema: updateArticleSectionTool.parameters
              },

              // CURATION TOOLS (only visible to curators/admins)
              ...curatorTools
            ]
          }
        }, { headers: corsHeaders() });
      }

        case 'tools/call':
          if (DEBUG_MCP) console.log('✅ Handling tools/call request');
          const toolName = params?.name;
          const toolInput = params?.arguments || {};

          if (DEBUG_MCP) {
            console.log('🔧 Tool name:', toolName);
            console.log('🔧 Tool input:', JSON.stringify(toolInput, null, 2));
          }

        // Handle the priority resource reading tool
        if (toolName === 'read_mandatory_constants_first') {
          if (DEBUG_MCP) console.log('📚 PRIORITY: Reading mandatory resource first');
          const uri = toolInput.uri || 'fab://constants';
          
          if (uri === 'fab://constants') {
            const resourceData = await fabConstantsResource.handler();
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ 
                  type: 'text', 
                  text: `✅ STEP 1/2 COMPLETE - FAB Constants Loaded!

You now have access to essential abbreviations and search terms:

${JSON.stringify(resourceData, null, 2)}

🎯 NEXT REQUIRED STEP: 
read_mandatory_constants_first({"uri": "searchable://card/fields"})

⚠️ Do NOT use search_printings yet! Complete step 2 first.

💡 After completing both steps, add "_resourcesConfirmed": true to your search_printings calls.

🔄 Progress: [✅ Constants] [❌ Capabilities] → Complete step 2 next!`
                }],
                _step1Complete: true,
                _nextStep: 'read_mandatory_constants_first({"uri": "searchable://card/fields"})',
                _progress: "Step 1/2 complete"
              }
            }, { headers: corsHeaders() });
          }
          
          if (uri === 'searchable://card/fields') {
            const resourceData = await searchCapabilitiesResource.handler();
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ 
                  type: 'text', 
                  text: `✅ STEP 2/2 COMPLETE - Search Capabilities Loaded!

You now understand available search fields and capabilities:

${JSON.stringify(resourceData, null, 2)}

🎉 SETUP COMPLETE! You can now use search tools.

🔥 IMPORTANT: Add "_resourcesConfirmed": true to your search_printings calls!

Example:
search_printings({
  "filters": {"name": "Head Jab"},
  "options": {"show": "summary"},
  "_resourcesConfirmed": true
})

🔄 Progress: [✅ Constants] [✅ Capabilities] → Ready for search!

✅ All systems ready for accurate card searches!`
                }],
                _step2Complete: true,
                _setupComplete: true,
                _readyForSearch: true,
                _progress: "Setup complete - ready for search!"
              }
            }, { headers: corsHeaders() });
          }
          
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Unknown resource URI: ${uri}. Use "fab://constants" or "searchable://card/fields"`
            }
          }, { headers: corsHeaders() });
        }

        // Legacy support for old read_resource calls (redirect to new tool)
        if (toolName === 'read_resource') {
          if (DEBUG_MCP) console.log('📚 Legacy read_resource call - redirecting to mandatory tool');
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{
                type: 'text',
                text: `🔄 Please use the "read_mandatory_constants_first" tool instead of "read_resource".

This ensures you get the essential setup data needed for accurate searches.

The new tool provides the same functionality with better guidance for proper workflow.

📚 Run these in order:
1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})`
              }]
            }
          }, { headers: corsHeaders() });
        }

        // RESOURCE REQUIREMENT VALIDATION for search tools
        const resourceCheck = validateResourceRequirement(toolInput, toolName);
        if (!resourceCheck.isValid) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: resourceCheck.error
                }
              ],
              isError: true,
              errorType: 'MISSING_REQUIRED_RESOURCES',
              requiredSteps: [
                'read_mandatory_constants_first({"uri": "fab://constants"})',
                'read_mandatory_constants_first({"uri": "searchable://card/fields"})'
              ]
            }
          }, { headers: corsHeaders() });
        }

        if (toolName === 'list_binders') {
          if (DEBUG_MCP) console.log('📚 Executing list binders');

          try {
            const userWithToken = { ...authenticatedUser, mcpToken: bearerToken };
            const result = await listBindersTool.handler(toolInput, userWithToken, bearerToken);

            if (!result.success) {
              console.error('💥 list_binders tool returned an error:', result.error);
              return NextResponse.json({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [
                    {
                      type: 'text',
                      text: `❌ Error listing binders: ${result.error}`
                    }
                  ],
                  isError: true,
                  errorDetails: result
                }
              }, { headers: corsHeaders() });
            }

            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: result.message || 'Binders listed successfully'
                  }
                ],
                isError: false,
                ...result
              }
            }, { headers: corsHeaders() });

          } catch (err) {
            console.error('💥 Error in list_binders:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `💥 Error listing binders: ${err instanceof Error ? err.message : 'Unknown error'}`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'get_binder') {
  if (DEBUG_MCP) console.log('📋 Executing binder retrieval');

  try {
    const userWithToken = { ...authenticatedUser, mcpToken: bearerToken };
    const result = await getBinderTool.handler(toolInput, userWithToken, bearerToken);

    // Check for tool failure
    if (!result.success) {
      console.error('💥 get_binder tool returned an error:', result.error);
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `❌ Error retrieving binder: ${result.error}`
            }
          ],
          isError: true,
          errorDetails: result
        }
      }, { headers: corsHeaders() });
    }
    
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: result.message || 'Binder retrieval completed'
          }
        ],
        isError: false,
        ...result
      }
    }, { headers: corsHeaders() });
    
            
          } catch (err) {
            console.error('💥 Error in get_binder:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `💥 Error retrieving binder: ${err instanceof Error ? err.message : 'Unknown error'}
        
        This tool works independently and doesn't require setup. Please check your binder name and permissions.`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'create_deck') {
          if (DEBUG_MCP) console.log('🆕 Executing create deck');
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const result = await createDeckTool.handler(toolInput, userWithToken, tokenToPass);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Deck created.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error('💥 Error in create_deck:', err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: { content: [{ type: 'text', text: `💥 Error creating deck: ${err instanceof Error ? err.message : 'Unknown error'}` }], isError: true }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'list_decks') {
          if (DEBUG_MCP) console.log('🃏 Executing list decks');
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const result = await listDecksTool.handler(toolInput, userWithToken, tokenToPass);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Decks listed.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error('💥 Error in list_decks:', err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: { content: [{ type: 'text', text: `💥 Error listing decks: ${err instanceof Error ? err.message : 'Unknown error'}` }], isError: true }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'get_deck') {
          if (DEBUG_MCP) console.log('🃏 Executing get deck');
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const result = await getDeckTool.handler(toolInput, userWithToken, tokenToPass);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Deck retrieved.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error('💥 Error in get_deck:', err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: { content: [{ type: 'text', text: `💥 Error getting deck: ${err instanceof Error ? err.message : 'Unknown error'}` }], isError: true }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'add_cards_to_deck') {
          if (DEBUG_MCP) console.log('🃏 Executing add_cards_to_deck');
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const result = await addCardsToDeckTool.handler(toolInput, userWithToken, tokenToPass);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Cards added.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error('💥 Error in add_cards_to_deck:', err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: { content: [{ type: 'text', text: `💥 Error adding cards: ${err instanceof Error ? err.message : 'Unknown error'}` }], isError: true }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'remove_cards_from_deck') {
          if (DEBUG_MCP) console.log('🃏 Executing remove_cards_from_deck');
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const result = await removeCardsFromDeckTool.handler(toolInput, userWithToken, tokenToPass);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Cards removed.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error('💥 Error in remove_cards_from_deck:', err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: { content: [{ type: 'text', text: `💥 Error removing cards: ${err instanceof Error ? err.message : 'Unknown error'}` }], isError: true }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'update_deck') {
          if (DEBUG_MCP) console.log('✏️ Executing update_deck');
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const result = await updateDeckTool.handler(toolInput, userWithToken, tokenToPass);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Deck updated.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error('💥 Error in update_deck:', err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: { content: [{ type: 'text', text: `💥 Error updating deck: ${err instanceof Error ? err.message : 'Unknown error'}` }], isError: true }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'save_deck_matchup') {
          if (DEBUG_MCP) console.log('⚔️ Executing save_deck_matchup');
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const result = await saveDeckMatchupTool.handler(toolInput, userWithToken, tokenToPass);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Matchup saved.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error('💥 Error in save_deck_matchup:', err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: { content: [{ type: 'text', text: `💥 Error saving matchup: ${err instanceof Error ? err.message : 'Unknown error'}` }], isError: true }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'get_wants') {
          if (DEBUG_MCP) console.log('📋 Executing wants list retrieval');

          try {
            const result = await getWantsTool.handler(toolInput, authenticatedUser, bearerToken);
            
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: result.message || 'Wants list retrieval completed'
                  }
                ],
                isError: false,
                ...result
              }
            }, { headers: corsHeaders() });
            
          } catch (err) {
            console.error('💥 Error in get_wants:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `💥 Error retrieving wants list: ${err instanceof Error ? err.message : 'Unknown error'}
        
        This tool supports both OAuth 2.1 Bearer token and MCP token authentication.`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'update_binder') {
  if (DEBUG_MCP) console.log('📋 Executing binder update');

  try {
    const userWithToken = { ...authenticatedUser, mcpToken: bearerToken };
    const result = await updateBinderTool.handler(toolInput, userWithToken, bearerToken);
    
    // Build detailed response message
    let responseText = '';
    
    if (result.success) {
      responseText = `✅ Binder Update Successful\n`;
      responseText += `📁 Binder: ${result.binderSlug} → ${result.actualBinderId}\n`;
      responseText += `🔐 Auth: ${result.authMethod}\n`;
      
      if (result.summary) {
        // Batch operation
        responseText += `📊 Summary: ${result.summary.total} total, ${result.summary.added} added, ${result.summary.updated} updated, ${result.summary.failed} failed\n`;
        
        if (result.details && result.details.length > 0) {
          responseText += `\n📋 Details:\n`;
          result.details.forEach((detail, i) => {
            responseText += `  ${i+1}. ${detail.printingId}: ${detail.success ? '✅' : '❌'} ${detail.action || detail.error}\n`;
          });
        }
      } else {
        // Single operation
        responseText += `📦 Single card added successfully\n`;
      }
    } else {
      responseText = `❌ Binder Update Failed\n`;
      responseText += `🚨 Error: ${result.error}\n`;
      
      if (result.step) {
        responseText += `📍 Failed at: ${result.step}\n`;
      }
      
      if (result.debug) {
        responseText += `🔍 Debug Info:\n`;
        responseText += `  - URL: ${result.debug.url}\n`;
        responseText += `  - Binder ID: ${result.debug.actualBinderId || 'Not resolved'}\n`;
        responseText += `  - Auth User: ${result.debug.authenticatedUser}\n`;
        responseText += `  - Token Provided: ${result.debug.tokenProvided}\n`;
      }
    }
    
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: responseText
          }
        ],
        isError: !result.success,
        ...result
      }
    }, { headers: corsHeaders() });
    
  } catch (err) {
    // Handle unexpected errors
    console.error('💥 Error in update_binder:', err);
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: `💥 Unexpected Error: ${err instanceof Error ? err.message : 'Unknown error'}\n\n🔧 This suggests a code-level issue, not a user error.`
          }
        ],
        isError: true,
        error: err instanceof Error ? err.message : 'Unknown error'
      }
    }, { headers: corsHeaders() });
  }
}

        if (toolName === 'remove_from_binder') {
          if (DEBUG_MCP) console.log('🗑️ Executing remove from binder');

          try {
            const authHeader = req.headers.get('Authorization');
            const tokenToPass = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const result = await removeFromBinderTool.handler(toolInput, userWithToken, tokenToPass);

            let responseText = '';
            if (result.success) {
              responseText = `✅ ${result.message}\n`;
              responseText += `📊 Summary: ${result.summary.removed} removed of ${result.summary.total} requested\n`;
            } else {
              responseText = `❌ Remove Failed\n`;
              responseText += `🚨 Error: ${result.error}\n`;
              if (result.step) responseText += `📍 Failed at: ${result.step}\n`;
              if (result.failures?.length) {
                responseText += `\n⚠️ Failed cards:\n`;
                result.failures.forEach((f: any) => {
                  responseText += `  - ${f.cardId}: ${f.error}\n`;
                });
              }
            }

            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: responseText }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });

          } catch (err) {
            console.error('💥 Error in remove_from_binder:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: `💥 Unexpected Error: ${err instanceof Error ? err.message : 'Unknown error'}` }],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'scan_printing') {
          if (DEBUG_MCP) console.log('🔍 Executing scan_printing');

          try {
            const result = await scanPrintingTool.handler(toolInput);

            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });

          } catch (err) {
            console.error('💥 Error in scan_printing:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: `💥 Unexpected Error: ${err instanceof Error ? err.message : 'Unknown error'}` }],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'who_has') {
          if (DEBUG_MCP) console.log('🔍 Executing who has search');

          try {
            const userWithToken = { ...authenticatedUser, mcpToken: bearerToken };
            const result = await whoHasTool.handler(toolInput, userWithToken, bearerToken);
            
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: result.message || 'Who has search completed'
                  }
                ],
                isError: false,
                ...result
              }
            }, { headers: corsHeaders() });
            
          } catch (err) {
            console.error('💥 Error in who_has:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `💥 Error searching for card owners: ${err instanceof Error ? err.message : 'Unknown error'}

        🔄 Did you complete the required setup? Run these first:
        1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
        2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})

        💡 Make sure you have valid printing IDs from search_printings or extract_printing_ids tools.`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'update_wants') {
          if (DEBUG_MCP) console.log('📝 Executing wants list update');

          try {
            const result = await updateWantsTool.handler(toolInput, authenticatedUser, bearerToken);
            
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: result.message || 'Wants list update completed'
                  }
                ],
                isError: false,
                ...result
              }
            }, { headers: corsHeaders() });
            
          } catch (err) {
            console.error('💥 Error in update_wants:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `💥 Error updating wants list: ${err instanceof Error ? err.message : 'Unknown error'}
        
        This tool supports both OAuth 2.1 Bearer token and MCP token authentication.`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'search_printings') {
          if (DEBUG_MCP) console.log('🔍 Executing database printings search');

          // Validate query complexity
          const complexityCheck = validateQueryComplexity(toolInput);
          if (!complexityCheck.isValid) {
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{
                  type: 'text',
                  text: `❌ Query validation failed: ${complexityCheck.error}

        🔄 Did you complete the required setup? Run these first:
        1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
        2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})

        Then add "_resourcesConfirmed": true to your search calls.`
                }],
                isError: true,
                error: complexityCheck.error
              }
            }, { headers: corsHeaders() });
          }

          // Execute the search when validation passes
          try {
            if (DEBUG_MCP) console.log('🚀 About to call search handler');
            const result = await searchPrintingsTool.handler(toolInput);

            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                ...result,
                isError: false
              }
            }, { headers: corsHeaders() });
            
          } catch (err) {
            console.error('💥 Error in search_printings:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{
                  type: 'text',
                  text: `💥 Error executing search: ${err instanceof Error ? err.message : 'Unknown error'}

        🔄 This might be a database connection issue or invalid search parameters.`
                }],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'extract_printing_ids') {
          if (DEBUG_MCP) console.log('🆔 Executing database printing ID extraction');
          
          // Validate query complexity for ID extraction too
          const complexityCheck = validateQueryComplexity(toolInput);
          if (!complexityCheck.isValid) {
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `❌ Query validation failed: ${complexityCheck.error}

🔄 Did you complete the required setup? Run these first:
1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})

Then add "_resourcesConfirmed": true to your extraction calls.`
                  }
                ],
                isError: true,
                error: complexityCheck.error
              }
            }, { headers: corsHeaders() });
          }
          
          try {
            // Apply safe defaults for ID extraction
            const safeToolInput = {
              ...toolInput,
              options: {
                ...toolInput.options,
                limit: Math.min(toolInput.options?.limit || 100, 500) // Cap at 500 for ID extraction
              }
            };
            
            const result = await extractPrintingIdsTool.handler(safeToolInput);
            
            let responseText = `✅ ${result.message}\n\n`;
            
            if (result.ids) {
              // Single type response
              responseText += `🆔 IDs (${result.ids.length}):\n${result.ids.join('\n')}`;
            } else {
              // Combined response
              if (result.card_ids?.length) {
                responseText += `🎴 Traditional Card IDs (${result.card_ids.length}):\n${result.card_ids.join('\n')}\n\n`;
              }
              if (result.printing_ids?.length) {
                responseText += `🔗 MongoDB Printing IDs (${result.printing_ids.length}):\n${result.printing_ids.join('\n')}\n\n`;
              }
              if (result.combined?.length) {
                responseText += `📋 Combined List:\n${result.combined.map(item => `${item.type}: ${item.id} (${item.name})`).join('\n')}`;
              }
              if (result.selectionList) {
                responseText += `🎯 Selection Interface:\n${result.selectionList.map(item => `${item.letter}. ${item.name} - ${item.details} - ${item.price}`).join('\n')}`;
              }
            }
            
            responseText += `\n\n📊 Data provided by FabBazaar.com`;
            
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: responseText
                  }
                ],
                isError: false,
                ...result
              }
            }, { 
              headers: {
                ...corsHeaders(),
                'X-RateLimit-Limit': '500' // Updated for token users
              }
            });
            
          } catch (err) {
            console.error('💥 Error in extract_printing_ids:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `💥 Error extracting printing IDs: ${err instanceof Error ? err.message : 'Unknown error'}

🔄 Did you complete the required setup? Run these first:
1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})

Then add "_resourcesConfirmed": true to your extraction calls.`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        // ARTICLE TOOLS HANDLERS
        if (toolName === 'get_article') {
          if (DEBUG_MCP) console.log('📄 Executing get article');

          try {
            const result = await getArticleTool.handler(toolInput, authenticatedUser, bearerToken);

            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: result.message || 'Article retrieval completed'
                  }
                ],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });

          } catch (err) {
            console.error('💥 Error in get_article:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `💥 Error retrieving article: ${err instanceof Error ? err.message : 'Unknown error'}

        This tool requires SuperAdmin or ContentCreator role.`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'add_article_section') {
          if (DEBUG_MCP) console.log('➕ Executing add article section');

          try {
            const result = await addArticleSectionTool.handler(toolInput, authenticatedUser, bearerToken);

            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: result.message || 'Section addition completed'
                  }
                ],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });

          } catch (err) {
            console.error('💥 Error in add_article_section:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `💥 Error adding section: ${err instanceof Error ? err.message : 'Unknown error'}

        This tool requires article ownership or SuperAdmin role.`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'update_article_section') {
          if (DEBUG_MCP) console.log('✏️ Executing update article section');

          try {
            const result = await updateArticleSectionTool.handler(toolInput, authenticatedUser, bearerToken);

            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: result.message || 'Section update completed'
                  }
                ],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });

          } catch (err) {
            console.error('💥 Error in update_article_section:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `💥 Error updating section: ${err instanceof Error ? err.message : 'Unknown error'}

        This tool requires article ownership or SuperAdmin role.`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        // CURATION TOOLS HANDLERS
        if (toolName === 'list_curated_lists' || toolName === 'get_curated_list' ||
            toolName === 'create_curated_list' || toolName === 'update_curated_list' ||
            toolName === 'delete_curated_list' || toolName === 'add_card_to_list' ||
            toolName === 'remove_card_from_list') {
          if (DEBUG_MCP) console.log(`📋 Executing curation tool: ${toolName}`);
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };

            const toolMap: Record<string, any> = {
              list_curated_lists: listCuratedListsTool,
              get_curated_list: getCuratedListTool,
              create_curated_list: createCuratedListTool,
              update_curated_list: updateCuratedListTool,
              delete_curated_list: deleteCuratedListTool,
              add_card_to_list: addCardToListTool,
              remove_card_from_list: removeCardFromListTool,
            };
            const result = await toolMap[toolName].handler(toolInput, userWithToken, tokenToPass);

            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Done.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error(`💥 Error in ${toolName}:`, err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: `💥 Error in ${toolName}: ${err instanceof Error ? err.message : 'Unknown error'}` }],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `❌ Unknown tool: ${toolName}
      
      Available tools:
      • read_mandatory_constants_first (🚨 USE THIS FIRST! Run twice with different URIs)
      - search_printings (🔍 START HERE for "add X to binder" requests)
      - extract_printing_ids (after confirming search results)
      - update_binder (final step to add cards)
      - get_binder (view current collection)
      - get_wants / update_wants (wants list management)
      - who_has (find card owners)
      - get_article (retrieve article by slug)
      - add_article_section (append sections to article)
      - update_article_section (update existing section)
      - list_decks (view all your decks)
      - get_deck (view full decklist by name)

      💡 Always start with "read_mandatory_constants_first" for best results.
      💡 For "add cards" requests: search_printings → extract_printing_ids → update_binder
      💡 For article editing: get_article → add_article_section / update_article_section
      
      📚 Required sequence:
      1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
      2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})`
        }
      }, { headers: corsHeaders() });

      case 'resources/list':
        return NextResponse.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            resources: [
              {
                uri: 'fab://constants',
                name: fabConstantsResource.name,
                description: `🚨 ESSENTIAL: ${fabConstantsResource.description} - Use read_mandatory_constants_first tool to access this!`,
                mimeType: 'application/json'
              },
              {
                uri: 'searchable://card/fields',
                name: searchCapabilitiesResource.name,
                description: `📋 ADVANCED: ${searchCapabilitiesResource.description} - Use read_mandatory_constants_first tool to access this!`,
                mimeType: 'application/json'
              },
              {
                uri: 'article://formatting',
                name: articleFormattingResource.name,
                description: `📝 ARTICLE EDITING: ${articleFormattingResource.description} - Essential for editing articles with inline cards!`,
                mimeType: 'application/json'
              },
              {
                uri: heroIdsResource.uri,
                name: heroIdsResource.name,
                description: `⚔️ MATCHUP PLANNING: ${heroIdsResource.description}`,
                mimeType: 'application/json'
              },
              {
                uri: cardIndexResource.uri,
                name: cardIndexResource.name,
                description: `🃏 DECKLIST IMPORT: ${cardIndexResource.description}`,
                mimeType: 'application/json'
              }
            ]
          }
        }, { headers: corsHeaders() });

      case 'resources/read':
        const uri = params?.uri;
        
        if (uri === 'searchable://card/fields') {
          const resourceData = await searchCapabilitiesResource.handler();
          return NextResponse.json({
            jsonrpc: "2.0",
            id: id,
            result: {
              contents: [
                {
                  uri: uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(resourceData, null, 2)
                }
              ]
            }
          }, { headers: corsHeaders() });
        }

        if (uri === 'fab://constants') {
          const resourceData = await fabConstantsResource.handler();
          return NextResponse.json({
            jsonrpc: "2.0",
            id: id,
            result: {
              contents: [
                {
                  uri: uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(resourceData, null, 2)
                }
              ]
            }
          }, { headers: corsHeaders() });
        }

        if (uri === 'article://formatting') {
          const resourceData = await articleFormattingResource.handler();
          return NextResponse.json({
            jsonrpc: "2.0",
            id: id,
            result: {
              contents: [
                {
                  uri: uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(resourceData, null, 2)
                }
              ]
            }
          }, { headers: corsHeaders() });
        }

        if (uri === heroIdsResource.uri) {
          const resourceData = heroIdsResource.handler();
          return NextResponse.json({
            jsonrpc: "2.0",
            id: id,
            result: {
              contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(resourceData, null, 2) }]
            }
          }, { headers: corsHeaders() });
        }

        if (uri === cardIndexResource.uri) {
          const resourceData = cardIndexResource.handler();
          return NextResponse.json({
            jsonrpc: "2.0",
            id: id,
            result: {
              contents: [
                {
                  uri: uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(resourceData, null, 2)
                }
              ]
            }
          }, { headers: corsHeaders() });
        }

        return NextResponse.json({
          jsonrpc: "2.0",
          id: id,
          error: {
            code: -32602,
            message: `Unknown resource URI: ${uri}. 

🚨 RECOMMENDED: Use "read_mandatory_constants_first" tool instead for guided access.

This tool provides better workflow guidance and ensures you read both required resources:
1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})`
          }
        }, { headers: corsHeaders() });

      case 'prompts/list':
        return NextResponse.json({
          jsonrpc: "2.0", 
          id: id,
          result: {
            prompts: mcpPrompts.map(prompt => ({
              name: prompt.name,
              description: prompt.description,
              arguments: prompt.arguments
            }))
          }
        }, { headers: corsHeaders() });

        case 'prompts/get':
          const promptName = params?.name;
          const promptArgs = params?.arguments || {};

          if (DEBUG_MCP) console.log('🎯 Handling prompt request:', promptName, promptArgs);
          
          const selectedPrompt = getPromptByName(promptName);
          
          if (!selectedPrompt) {
            return NextResponse.json({
              jsonrpc: "2.0",
              id: id, 
              error: {
                code: -32602,
                message: `Unknown prompt: ${promptName}. Available prompts: ${mcpPrompts.map(p => p.name).join(', ')}`
              }
            }, { headers: corsHeaders() });
          }
          
          try {
            const promptResult = selectedPrompt.handler(promptArgs);
            
            return NextResponse.json({
              jsonrpc: "2.0",
              id: id,
              result: promptResult
            }, { headers: corsHeaders() });
            
          } catch (error) {
            return NextResponse.json({
              jsonrpc: "2.0", 
              id: id,
              error: {
                code: -32603,
                message: `Error generating prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
              }
            }, { headers: corsHeaders() });
          }

      default:
        return NextResponse.json({
          jsonrpc: "2.0",
          id: id,
          error: {
            code: -32601,
            message: `Method ${method} not found

💡 Start with the setup sequence:
1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})`
          }
        }, { status: 404, headers: corsHeaders() });
    }
  } catch (error) {
    console.error('💥 MCP Server Error:', error);
    return NextResponse.json({
      jsonrpc: "2.0",
      id: id,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500, headers: corsHeaders() });
  }
}

// CORS headers helper
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://claude.ai',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true'
  };
}

function unauthenticatedHeaders(req: Request) {
  const url = new URL(req.url);
  const forwardedHost = (req.headers as Headers).get('x-forwarded-host');
  const forwardedProto = (req.headers as Headers).get('x-forwarded-proto');
  const host = forwardedHost || url.host;
  const protocol = forwardedProto || url.protocol.replace(':', '');
  const baseUrl = `${protocol}://${host}`;
  return {
    ...corsHeaders(),
    'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource", as_uri="${baseUrl}"`,
  };
}

// Handle preflight OPTIONS requests
export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders()
  });
}

export async function GET(req: Request) {
  return NextResponse.json({
    error: "MCP server expects POST requests with JSON-RPC format",
    version: "4.0.0",
    capabilities: ["OAuth 2.1 Bearer tokens", "Legacy MCP tokens", "read_mandatory_constants_first", "search_printings", "extract_printing_ids", "list_binders", "get_binder", "update_binder", "remove_from_binder", "scan_printing", "get_wants", "update_wants", "get_article", "add_article_section", "update_article_section", "list_decks", "get_deck"],
    hint: "Use POST with method/params structure. Always start with 'read_mandatory_constants_first' tool!",
    mode: "OAUTH_AND_LEGACY_SUPPORT",
    authMethods: ["Bearer <oauth_token>"],
    workflow: "🚨 MANDATORY: read_mandatory_constants_first (2x) → search_printings → extract_printing_ids → update_binder",
    setup_sequence: [
      "1️⃣ read_mandatory_constants_first({\"uri\": \"fab://constants\"})",
      "2️⃣ read_mandatory_constants_first({\"uri\": \"searchable://card/fields\"})",
      "3️⃣ search_printings({..., \"_resourcesConfirmed\": true})"
    ]
  }, {
    status: 405,
    headers: corsHeaders()
  });
}