// app/api/mcp/server/route.ts - OAuth 2.1 Bearer token authentication
import { NextResponse } from "next/server";
import { searchCapabilitiesResource } from '../resource/searchCapabilities';
import { fabConstantsResource } from '../resource/fabConstants';
import { articleFormattingResource } from '../resource/articleFormatting';
import { cardIndexResource } from '../resource/cardIndex';
import { heroIdsResource } from '../resource/heroIds';
import { heroesByFormatResource } from '../resource/heroesByFormat';
import { cardGridViewerResource } from '../resource/cardGridViewer';
import { deckViewerResource } from '../resource/deckViewer';
import { rateLimit } from '@/lib/rate-limit';
import { authTokenService, userService, mcpUsageService } from '@/lib/services';
import { filterToolsForToolset, resolveToolset } from './toolsets';

// Import the tools
import { searchPrintingsTool } from '../tool/searchPrintings';
import { updateBinderTool } from '../tool/updateBinder';
import { removeFromBinderTool } from '../tool/removeFromBinder';
import { removeFromWantsTool } from '../tool/removeFromWants';
import { getBinderTool, shapeForMcpApp } from '../tool/getBinder';
import { listBindersTool } from '../tool/listBinders';
import { getWantsTool, shapeWantsForMcp } from '../tool/getWants';
import { updateWantsTool } from '../tool/updateWants';
import { whoHasTool } from '../tool/whoHas';

// Import curation tools (curator/admin only)
import { listCuratedListsTool } from '../tool/curation/listCuratedLists';
import { getCuratedListTool, shapeCuratedListForMcp } from '../tool/curation/getCuratedList';
import { createCuratedListTool } from '../tool/curation/createCuratedList';
import { updateCuratedListTool } from '../tool/curation/updateCuratedList';
import { deleteCuratedListTool } from '../tool/curation/deleteCuratedList';
import { addCardToListTool } from '../tool/curation/addCardToList';
import { removeCardFromListTool } from '../tool/curation/removeCardFromList';

// Import banned-cards registry tools (superadmin only)
import { manageCardRestrictionTool } from '../tool/bannedCards/manageCardRestriction';
import { listCardRestrictionsTool } from '../tool/bannedCards/listCardRestrictions';

// Import event tools (superadmin only)
import { createEventTool } from '../tool/events/createEvent';

// Import store/location tools (create_store is superadmin only)
import { listStoresTool, getStoreTool, createStoreTool } from '../tool/stores/stores';

// Import deck tools
import { getDecksToBeatTool } from '../tool/getDecksToBeat';
import { listDecksTool } from '../tool/listDecks';
import { listResultsTool } from '../tool/listResults';
import { getResultsTool } from '../tool/getResults';
import { getDeckTool, shapeDeckForMcp } from '../tool/getDeck';
import { createDeckTool } from '../tool/createDeck';
import { addCardsToDeckTool } from '../tool/addCardsToDeck';
import { removeCardsFromDeckTool } from '../tool/removeCardsFromDeck';
import { updateDeckTool } from '../tool/updateDeck';
import { saveDeckMatchupTool } from '../tool/saveDeckMatchup';
import { getArticleTool } from '../tool/articles/getArticle';
import { listArticlesTool } from '../tool/articles/listArticles';
import { addArticleSectionTool } from '../tool/articles/addArticleSection';
import { updateArticleSectionTool } from '../tool/articles/updateArticleSection';
// import { scanPrintingTool } from '../tool/scanPrinting'; // removed — image scanning unreliable

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
  const options = toolInput.options || {};

  // New schema: cards[] array — each entry carries its own filters/query
  if (toolInput.cards?.length > 0) {
    if (options.limit > 100) {
      return { isValid: false, error: "Maximum limit is 100 results per request" };
    }
    return { isValid: true };
  }

  // Legacy schema: top-level filters/query (backwards-compat path)
  const filters = toolInput.filters || {};

  if (filters.searchableText && filters.searchableText.length < 2) {
    return { isValid: false, error: "Search text must be at least 2 characters" };
  }

  const hasSpecificFilter = !!(
    filters.name || filters.sets?.length || filters.types?.length ||
    filters.classes?.length || filters.talents?.length || filters.rarities?.length ||
    filters.foilings?.length || filters.editions?.length || filters.color ||
    filters.collectorNumber || filters.printingIds || filters.cardUniqueId ||
    filters.cardUniqueIds || filters.text || filters.searchableText ||
    filters.heroLegal || filters.heroClasses?.length || filters.heroTalents?.length ||
    filters.format
  );
  const hasQuery = !!(toolInput.query?.trim());
  const effectiveLimit = options.limit || 12;

  if (!hasSpecificFilter && !hasQuery && effectiveLimit > 50) {
    return { isValid: false, error: "Large queries require at least one specific filter (name, set, type, talent, class, rarity, etc.)" };
  }
  if (options.limit > 100) {
    return { isValid: false, error: "Maximum limit is 100 results per request" };
  }
  if (options.page > 1000) {
    return { isValid: false, error: "Maximum page number is 1000" };
  }

  return { isValid: true };
}

// Enhanced tools/call handler
// Thin usage-capture wrapper: measures request/response bytes of successful
// tools/call and resources/read, attributed per user × client × tool
// (mcp_usage_daily). Fire-and-forget — a metrics failure never affects the
// request. Quota enforcement (future paid tier) is policy on top of this data.
export async function POST(req: Request) {
  const bodyText = await req.text();
  const response = await handleMcpPost(
    new Request(req.url, { method: 'POST', headers: req.headers, body: bodyText })
  );
  try {
    void recordMcpUsage(req, bodyText, response.clone());
  } catch {
    // observability must never break the request
  }
  return response;
}

async function recordMcpUsage(req: Request, bodyText: string, responseClone: Response): Promise<void> {
  try {
    if (responseClone.status !== 200) return;
    const body = JSON.parse(bodyText);
    if (body?.method !== 'tools/call' && body?.method !== 'resources/read') return;
    const tool = body.method === 'tools/call'
      ? body?.params?.name
      : `resource:${body?.params?.uri ?? 'unknown'}`;
    if (!tool || typeof tool !== 'string') return;

    // Attribution only — cryptographic verification already happened in the
    // handler (only 200 responses are recorded). Client-credentials tokens
    // have no user; skip those.
    const userId = userIdFromBearer(req.headers.get('Authorization'));
    if (!userId) return;

    const client = (req.headers.get('user-agent') || 'unknown').split(/[\s(]/)[0].slice(0, 60) || 'unknown';
    const responseText = await responseClone.text();
    const result = await mcpUsageService.recordCall({
      userId,
      client,
      tool,
      requestBytes: bodyText.length,
      responseBytes: responseText.length,
    });
    if (!result.success) console.error('[MCP usage] record failed (request unaffected):', result.error);
  } catch (error) {
    console.error('[MCP usage] record failed (request unaffected):', error);
  }
}

function userIdFromBearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const payload = authHeader.substring(7).split('.')[1];
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims?.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}

async function handleMcpPost(req: Request) {
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
              tools: { listChanged: false },
              resources: { listChanged: false, subscribe: false },
              prompts: { listChanged: false }
            },
            serverInfo: {
              name: 'FabBazaar MCP [DEV]',
              version: '4.1.0',
              user: authenticatedUser ? authenticatedUser.username : 'Client Credentials'
            },
            instructions: [
              'FabBazaar MCP — Flesh and Blood trading card platform.',
              '',
              'READ FIRST (session setup):',
              '  1. Call resources/list to see all available resources.',
              '  2. Read `fab://constants` before any search or list-creation work. It contains:',
              '     - foiling / edition / set / rarity / keyword codes used by search_printings',
              '     - shorthand query syntax',
              '     - hero nicknames and trade-post parsing rules (BB/WB, Treasures, Marvel fallback)',
              '  3. Read `searchable://card/fields` before calling search_printings.',
              '  4. Read `fab://card-index` once per session before working with decklists (card name → printing ID lookup).',
              '  5. Read `fab://heroes-by-format` before building/validating a hero+format deck pool (e.g. "Oldhim in Silver Age"). DB-derived per-format legality, split adult vs young; note many heroes (e.g. Oldhim) exist as BOTH a young hero and an adult hero legal in different formats.',
              '',
              'ERROR CONVENTION:',
              '  All tools return either { success: true, data, message? } or { success: false, error: "..." }.',
              '  On success: false, do NOT retry blindly — the error message states what to fix.',
              '',
              'ID GLOSSARY — which ID goes where (do not mix shapes):',
              '  • `printing_id`       — 21-char nanoid (e.g. `cLHGKMCjPb89zwNPmMFBp`). One specific physical printing (set × edition × foiling × art).',
              '                          Required by: add_to_binder, remove_from_binder, add_to_wants, remove_from_wants, add_cards_to_deck,',
              '                          remove_cards_from_deck, add_card_to_list, remove_card_from_list, who_has (printingIds).',
              '  • `card_unique_id`    — 21-char nanoid. One card at one pitch, across all printings. Use for "does anyone own X?" queries.',
              '                          Required by: who_has (cardUniqueIds).',
              '  • `collector_number`  — human-readable reference (e.g. `WTR171`). Shown to users; not used as a primary key for any write tool.',
              '                          Can be filtered on via search_printings({ filters: { collectorNumber: "WTR171" } }).',
              '  • `set_printing_unique_id` — internal DB field; not accepted by any MCP tool. Ignore.',
              '  • Curated list id     — 21-char nanoid (e.g. `_efFPE1ErJtaRo3H8_Vnq`). Required by: get/update/delete_curated_list,',
              '                          add/remove_card_from_list. Can also target by `listName` + `heroName`.',
              '  • Talishar hero id    — `lowercase_snake_pitch` (e.g. `pummel_red`). Only used for save_deck_matchup sideboard export.',
              '                          Read `fab://hero-ids` before calling save_deck_matchup.',
              '',
              'Every search_printings result row carries printing_id AND card_unique_id — pick whichever the next tool needs.',
              '',
              'HERO NAMES:',
              '  When passing `heroName` to create_curated_list / update_curated_list / create_deck, use the lowercase canonical name from `fab://constants` → `heroes_by_format.*.by_class[*].name` (e.g. `"rhinar, reckless rampage"`, not `"Rhinar"`).',
              '  Show users the `displayName` value from that same structure.',
              '',
              'CURATED LISTS:',
              '  - Lists are targeted by `id` (preferred) OR `listName` + `heroName` (for name disambiguation).',
              '  - If a listName matches multiple heroes, the server returns all candidates — ask the user or pass `heroName` to narrow.',
              '  - `format` is required on create and cannot be cleared on update.',
              '',
              'DEFAULTS:',
              '  - Prefer calling tools/list and resources/list at session start to see what is available to the current user (curator/admin tools are visibility-gated).',
            ].join('\n')
          }
        }, { headers: corsHeaders() });

      case 'tools/list': {
        // Check if user has curator/admin role for conditional tool visibility
        let isCurator = false;
        let isSuperAdmin = false;
        if (authenticatedUser?._id) {
          const [curatorCheck, adminCheck] = await Promise.all([
            userService.hasRole(authenticatedUser._id, 'isCurator'),
            userService.hasRole(authenticatedUser._id, 'isSuperAdmin'),
          ]);
          isSuperAdmin = !!(adminCheck.success && adminCheck.data);
          isCurator = !!(curatorCheck.success && curatorCheck.data) || isSuperAdmin;
        }

        // Banned-cards registry tools are superadmin-only (the API enforces the
        // role too — this just hides them from non-admins in tools/list).
        const adminTools = isSuperAdmin ? [
          {
            name: manageCardRestrictionTool.name,
            description: manageCardRestrictionTool.description,
            inputSchema: manageCardRestrictionTool.parameters,
          },
          {
            name: listCardRestrictionsTool.name,
            description: listCardRestrictionsTool.description,
            inputSchema: listCardRestrictionsTool.parameters,
          },
          {
            name: createEventTool.name,
            description: createEventTool.description,
            inputSchema: createEventTool.parameters,
          },
          {
            name: createStoreTool.name,
            description: createStoreTool.description,
            inputSchema: createStoreTool.parameters,
          },
        ] : [];

        const curatorTools = isCurator ? [
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

        const allTools = [
              // PRIORITY TOOL - Listed first with MAXIMUM emphasis
              {
                name: 'read_mandatory_constants_first',
                description: `🚨 MANDATORY FIRST READ — Run this BEFORE any search, deck, or curation work.

This tool is the gateway to every server resource. Call it multiple times with different URIs.

REQUIRED AT SESSION START:
1️⃣ read_mandatory_constants_first({"uri": "fab://constants"})
2️⃣ read_mandatory_constants_first({"uri": "searchable://card/fields"})

CONDITIONALLY REQUIRED (read these when relevant):
3️⃣ {"uri": "fab://card-index"}        — BEFORE working with decklists (card name → printingId lookup)
4️⃣ {"uri": "fab://hero-ids"}          — BEFORE calling save_deck_matchup
5️⃣ {"uri": "fab://heroes-by-format"}  — BEFORE building/validating a hero+format deck pool (per-format legality, adult vs young)
6️⃣ {"uri": "article://formatting"}    — BEFORE editing articles

═══════════════════════════════════════════════════════════════════
CRITICAL RULES (read these — do not skip):
═══════════════════════════════════════════════════════════════════

ERROR CONVENTION:
  All tools return { success: true, data, message? } OR { success: false, error: "..." }.
  On success: false, do NOT retry blindly — the error message states what to fix.

ID GLOSSARY — which ID goes where (do not mix shapes):
  • printing_id           21-char nanoid (e.g. "cLHGKMCjPb89zwNPmMFBp")
                          → one specific physical printing (set × edition × foiling × art).
                          → Used by: add_to_binder, remove_from_binder, add_to_wants, remove_from_wants,
                            add_cards_to_deck, remove_cards_from_deck, add_card_to_list, remove_card_from_list,
                            who_has (as printingIds).
  • card_unique_id        21-char nanoid. One card at one pitch, across all printings.
                          → Used by: who_has (as cardUniqueIds) — for "does anyone own X?" queries.
  • collector_number      "SET###" e.g. "WTR171". Human-readable reference. Shown to users.
                          → Not a primary key for any write tool. Filter via search_printings filters.collectorNumber.
  • set_printing_unique_id   Internal DB field — not accepted by any MCP tool. Ignore.
  • Curated list id       21-char nanoid (e.g. "_efFPE1ErJtaRo3H8_Vnq").
                          → Used by: get/update/delete_curated_list, add/remove_card_from_list.
                            Can also target by listName + heroName.
  • Talishar hero id      lowercase_snake_pitch (e.g. "pummel_red").
                          → Used by: save_deck_matchup sideboard export. Read fab://hero-ids first.

Every search_printings result row carries both printing_id AND card_unique_id — pick whichever the next tool needs.

HERO NAMES:
  When passing \`heroName\` to create_curated_list / update_curated_list / create_deck,
  use the LOWERCASE CANONICAL name from fab://constants → heroes_by_format.*.by_class[*].name
  (e.g. "rhinar, reckless rampage", NOT "Rhinar").
  Show users the displayName value from that same structure.

CURATED LISTS:
  • Target by \`id\` (preferred) OR \`listName\` + \`heroName\` (for name disambiguation).
  • If listName matches multiple heroes, server returns all candidates — ask user or pass heroName.
  • \`format\` is required on create and cannot be cleared on update.

CURATOR/ADMIN TOOLS:
  Curated-list management tools (list/create/update/delete_curated_list, add/remove_card_from_list)
  are only visible to curator/admin accounts. If you don't see them in tools/list, you don't have access.

⚡ Takes 30 seconds, saves hours of debugging.
✅ Always run the first two in any session.`,
                inputSchema: {
                  type: 'object',
                  properties: {
                    uri: {
                      type: 'string',
                      description: 'Resource URI to read. See the tool description for when to use each.',
                      enum: [
                        'fab://constants',
                        'searchable://card/fields',
                        'fab://card-index',
                        'fab://hero-ids',
                        'fab://heroes-by-format',
                        'article://formatting'
                      ],
                      default: 'fab://constants'
                    }
                  },
                  required: ['uri']
                }
              },
              
              // SECONDARY TOOLS
              {
                name: searchPrintingsTool.name,
                description: searchPrintingsTool.description,
                inputSchema: searchPrintingsTool.parameters
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
                name: updateWantsTool.name,
                description: updateWantsTool.description,
                inputSchema: updateWantsTool.parameters
              },
              {
                name: removeFromWantsTool.name,
                description: removeFromWantsTool.description,
                inputSchema: removeFromWantsTool.parameters
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
Step 4: add_to_binder (add cards to collection)
Step 5: get_binder (verify additions)

✅ This tool works without any setup requirements!`,
                inputSchema: getBinderTool.parameters,
                _meta: (getBinderTool as any)._meta
              },
              {
                name: getDecksToBeatTool.name,
                description: getDecksToBeatTool.description,
                inputSchema: getDecksToBeatTool.parameters
              },
              {
                name: listDecksTool.name,
                description: listDecksTool.description,
                inputSchema: listDecksTool.parameters
              },
              {
                name: getDeckTool.name,
                description: getDeckTool.description,
                inputSchema: getDeckTool.parameters,
                _meta: (getDeckTool as any)._meta
              },
              {
                name: listStoresTool.name,
                description: listStoresTool.description,
                inputSchema: listStoresTool.parameters
              },
              {
                name: getStoreTool.name,
                description: getStoreTool.description,
                inputSchema: getStoreTool.parameters
              },
              {
                name: listResultsTool.name,
                description: listResultsTool.description,
                inputSchema: listResultsTool.parameters
              },
              {
                name: getResultsTool.name,
                description: getResultsTool.description,
                inputSchema: getResultsTool.parameters
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
              
              📚 Perfect companion to add_to_wants:
              Step 1: get_wants (view current wants)
              Step 2: search_printings (find new cards) [optional]
              Step 3: add_to_wants (add cards to wants list)
              Step 4: get_wants (verify additions)
              
              ✅ This tool works without any setup requirements!`,
                inputSchema: getWantsTool.parameters,
                _meta: (getWantsTool as any)._meta
              },
              {
                name: whoHasTool.name,
                description: whoHasTool.description,
                inputSchema: whoHasTool.parameters
              },

              // CURATED LIST READ TOOLS (public — published lists only for non-curators)
              {
                name: listCuratedListsTool.name,
                description: listCuratedListsTool.description,
                inputSchema: listCuratedListsTool.parameters
              },
              {
                name: getCuratedListTool.name,
                description: getCuratedListTool.description,
                inputSchema: getCuratedListTool.parameters,
                _meta: (getCuratedListTool as any)._meta
              },

              // ARTICLE MANAGEMENT TOOLS
              {
                name: getArticleTool.name,
                description: getArticleTool.description,
                inputSchema: getArticleTool.parameters
              },
              {
                name: listArticlesTool.name,
                description: listArticlesTool.description,
                inputSchema: listArticlesTool.parameters
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
              ...curatorTools,

              // BANNED-CARDS REGISTRY TOOLS (only visible to superadmins)
              ...adminTools
        ];

        // ?toolset=lite trims what's ADVERTISED for context-constrained clients
        // (local models — full catalog is ~22k tokens of schema). Default stays
        // the full catalog, byte-identical for existing clients. See toolsets.ts.
        return NextResponse.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            tools: filterToolsForToolset(allTools, resolveToolset(req.url))
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

        // Handle the priority resource reading tool — gateway to all 5 advertised resources
        if (toolName === 'read_mandatory_constants_first') {
          if (DEBUG_MCP) console.log('📚 Resource gateway:', toolInput.uri);
          const uri = toolInput.uri || 'fab://constants';

          const buildResponse = (resourceData: unknown, header: string, nextStep: string, flags: Record<string, unknown>) => NextResponse.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{
                type: 'text',
                text: `${header}\n\n${JSON.stringify(resourceData, null, 2)}\n\n${nextStep}`
              }],
              ...flags,
            }
          }, { headers: corsHeaders() });

          if (uri === 'fab://constants') {
            const resourceData = await fabConstantsResource.handler();
            return buildResponse(
              resourceData,
              `✅ Loaded fab://constants — abbreviations, codes, shorthand syntax, heroes_by_format.`,
              `🎯 NEXT: read_mandatory_constants_first({"uri": "searchable://card/fields"}) before calling search_printings.`,
              { _step1Complete: true, _nextStep: 'read_mandatory_constants_first({"uri": "searchable://card/fields"})' }
            );
          }

          if (uri === 'searchable://card/fields') {
            const resourceData = await searchCapabilitiesResource.handler();
            return buildResponse(
              resourceData,
              `✅ Loaded searchable://card/fields — search API reference and filter fields.`,
              `🎉 Core setup complete. For decklist work, also read fab://card-index. For matchups, fab://hero-ids. For articles, article://formatting.`,
              { _step2Complete: true, _setupComplete: true, _readyForSearch: true }
            );
          }

          if (uri === 'fab://card-index') {
            const resourceData = cardIndexResource.handler();
            return buildResponse(
              resourceData,
              `✅ Loaded fab://card-index — card name + pitch → printingId map. Use this to resolve card names before add_cards_to_deck / add_card_to_list.`,
              `💡 Keep this in context for the rest of the session; you won't need to re-read it.`,
              { _cardIndexLoaded: true }
            );
          }

          if (uri === 'fab://hero-ids') {
            const resourceData = heroIdsResource.handler();
            return buildResponse(
              resourceData,
              `✅ Loaded fab://hero-ids — full list of valid heroId values for save_deck_matchup.`,
              `💡 Use these exact IDs when recording matchups.`,
              { _heroIdsLoaded: true }
            );
          }

          if (uri === 'article://formatting') {
            const resourceData = await articleFormattingResource.handler();
            return buildResponse(
              resourceData,
              `✅ Loaded article://formatting — formatting rules for article editing (inline cards, sections, etc.).`,
              `💡 Required reading before add_article_section / update_article_section.`,
              { _articleFormattingLoaded: true }
            );
          }

          if (uri === 'fab://heroes-by-format') {
            const resourceData = await heroesByFormatResource.handler();
            return buildResponse(
              resourceData,
              `✅ Loaded fab://heroes-by-format — heroes legal per format (cc/blitz/silver_age/commoner/ll), split adult vs young.`,
              `💡 Read before building or validating a hero+format deck pool (e.g. "Oldhim in Silver Age"). Use the lowercase name for heroLegal.`,
              { _heroesByFormatLoaded: true }
            );
          }

          return NextResponse.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Unknown resource URI: ${uri}. Valid URIs: fab://constants, searchable://card/fields, fab://card-index, fab://hero-ids, fab://heroes-by-format, article://formatting.`
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
      result: shapeForMcpApp(result, {
        showDetails: toolInput?.showDetails !== false,
        binderSlug: toolInput?.binderSlug,
        limit: toolInput?.limit,
      })
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

        if (toolName === 'get_decks_to_beat') {
          if (DEBUG_MCP) console.log('🏆 Executing get_decks_to_beat');
          try {
            const result = await getDecksToBeatTool.handler(toolInput);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Decks to Beat retrieved.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error('💥 Error in get_decks_to_beat:', err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: { content: [{ type: 'text', text: `💥 Error fetching Decks to Beat: ${err instanceof Error ? err.message : 'Unknown error'}` }], isError: true }
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

        if (toolName === 'list_results') {
          if (DEBUG_MCP) console.log('📊 Executing list results');
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const result = await listResultsTool.handler(toolInput, userWithToken, tokenToPass);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Results listed.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error('💥 Error in list_results:', err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: { content: [{ type: 'text', text: `💥 Error listing results: ${err instanceof Error ? err.message : 'Unknown error'}` }], isError: true }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'get_results') {
          if (DEBUG_MCP) console.log('📊 Executing get results');
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const result = await getResultsTool.handler(toolInput, userWithToken, tokenToPass);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Game data retrieved.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error('💥 Error in get_results:', err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: { content: [{ type: 'text', text: `💥 Error getting results: ${err instanceof Error ? err.message : 'Unknown error'}` }], isError: true }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'get_deck') {
          if (DEBUG_MCP) console.log('🃏 Executing get deck');
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const result = await getDeckTool.handler(toolInput, userWithToken, tokenToPass);
            if (!result.success) {
              return NextResponse.json({
                jsonrpc: '2.0', id,
                result: {
                  content: [{ type: 'text', text: `❌ ${result.error}` }],
                  isError: true,
                }
              }, { headers: corsHeaders() });
            }
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: shapeDeckForMcp(result, {
                showDetails: toolInput?.showDetails !== false,
              })
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
              result: shapeWantsForMcp(result, {
                showDetails: toolInput?.showDetails !== false,
                limit: toolInput?.limit,
              })
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
        
        This tool requires OAuth 2.1 Bearer token authentication.`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'add_to_binder') {
  if (DEBUG_MCP) console.log('📋 Executing add_to_binder');

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
    console.error('💥 Error in add_to_binder:', err);
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

        💡 Make sure you have valid IDs from search_printings (printing_id for a specific printing, card_unique_id for any version).`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'add_to_wants') {
          if (DEBUG_MCP) console.log('📝 Executing add_to_wants');

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
            console.error('💥 Error in add_to_wants:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `💥 Error updating wants list: ${err instanceof Error ? err.message : 'Unknown error'}
        
        This tool requires OAuth 2.1 Bearer token authentication.`
                  }
                ],
                isError: true,
                error: err instanceof Error ? err.message : 'Unknown error'
              }
            }, { headers: corsHeaders() });
          }
        }

        if (toolName === 'remove_from_wants') {
          if (DEBUG_MCP) console.log('🗑️ Executing remove_from_wants');
          try {
            const result = await removeFromWantsTool.handler(toolInput, authenticatedUser, bearerToken);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: {
                content: [{ type: 'text', text: result.message || (result.success ? 'Removed from wants list.' : result.error) }],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });
          } catch (err) {
            console.error('💥 Error in remove_from_wants:', err);
            return NextResponse.json({
              jsonrpc: '2.0', id,
              result: { content: [{ type: 'text', text: `💥 Error removing from wants: ${err instanceof Error ? err.message : 'Unknown error'}` }], isError: true }
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

        Use the cards[] format: search_printings({ cards: [{ filters: { name: "..." }, query: "..." }] })`
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
                content: [{ type: 'text', text: result.message || (result.success ? 'Search complete.' : 'Search returned no results.') }],
                // Spec-compliant surface: clients that read structuredContent get the
                // FULL per-printing list (every set/edition/foiling), not just the
                // collapsed text representative. See searchPrintings tail note.
                ...(result.success ? { structuredContent: { results: result.results ?? [] } } : {}),
                isError: !result.success,
                ...result,
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

        // ARTICLE TOOLS HANDLERS
        if (toolName === 'get_article') {
          if (DEBUG_MCP) console.log('📄 Executing get article');

          try {
            const result = await getArticleTool.handler(toolInput, authenticatedUser, bearerToken);

            const text = result.success
              ? (result.message || 'Article retrieval completed')
              : `💥 get_article failed: ${result.error || 'Unknown error'}`;

            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text,
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

        if (toolName === 'list_articles') {
          if (DEBUG_MCP) console.log('📚 Executing list articles');

          try {
            const result = await listArticlesTool.handler(toolInput, authenticatedUser, bearerToken);

            const text = result.success
              ? (result.message || 'Article list completed')
              : `💥 list_articles failed: ${result.error || 'Unknown error'}`;

            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text,
                  }
                ],
                isError: !result.success,
                ...result
              }
            }, { headers: corsHeaders() });

          } catch (err) {
            console.error('💥 Error in list_articles:', err);
            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `💥 Error listing articles: ${err instanceof Error ? err.message : 'Unknown error'}

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

            const text = result.success
              ? (result.message || 'Section addition completed')
              : `💥 add_article_section failed: ${result.error || 'Unknown error'}`;

            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text,
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

            const text = result.success
              ? (result.message || 'Section update completed')
              : `💥 update_article_section failed: ${result.error || 'Unknown error'}`;

            return NextResponse.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text,
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

            if (toolName === 'get_curated_list') {
              return NextResponse.json({
                jsonrpc: '2.0', id,
                result: shapeCuratedListForMcp(result, {
                  showDetails: toolInput?.showDetails !== false,
                })
              }, { headers: corsHeaders() });
            }

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

        // BANNED-CARDS REGISTRY TOOLS (superadmin — the API enforces the role)
        if (toolName === 'manage_card_restriction' || toolName === 'list_card_restrictions' || toolName === 'create_event' || toolName === 'create_store' || toolName === 'list_stores' || toolName === 'get_store') {
          if (DEBUG_MCP) console.log(`🚫 Executing location/admin tool: ${toolName}`);
          try {
            const tokenToPass = bearerToken;
            const userWithToken = { ...authenticatedUser, mcpToken: tokenToPass };
            const toolMap: Record<string, any> = {
              manage_card_restriction: manageCardRestrictionTool,
              list_card_restrictions: listCardRestrictionsTool,
              create_event: createEventTool,
              create_store: createStoreTool,
              list_stores: listStoresTool,
              get_store: getStoreTool,
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
      • read_mandatory_constants_first (🚨 Read fab://constants once per session)
      - search_printings (🔍 find cards, look up printings — returns printing_id + card_unique_id)
      - add_to_binder / remove_from_binder / list_binders / get_binder
      - add_to_wants / remove_from_wants / get_wants
      - who_has (find card owners — use card_unique_id for any version, printing_id for a specific version)
      - get_article / add_article_section / update_article_section
      - list_decks / get_deck / create_deck / add_cards_to_deck / remove_cards_from_deck / update_deck / save_deck_matchup
      - get_decks_to_beat
      - list_curated_lists / get_curated_list (public — published lists; 🎯 preferred entry point for deck recommendations)
      - Curator-only tools: create_curated_list, update_curated_list, delete_curated_list, add_card_to_list, remove_card_from_list

      💡 Start with read_mandatory_constants_first({"uri": "fab://constants"}) to load set/foiling/edition/rarity codes and the hero roster.`
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
              },
              {
                uri: heroesByFormatResource.uri,
                name: heroesByFormatResource.name,
                description: `🏆 FORMAT POOLS: ${heroesByFormatResource.description}`,
                mimeType: heroesByFormatResource.mimeType
              },
              {
                uri: cardGridViewerResource.uri,
                name: cardGridViewerResource.name,
                description: cardGridViewerResource.description,
                mimeType: cardGridViewerResource.mimeType,
                _meta: cardGridViewerResource._meta
              },
              {
                uri: deckViewerResource.uri,
                name: deckViewerResource.name,
                description: deckViewerResource.description,
                mimeType: deckViewerResource.mimeType,
                _meta: deckViewerResource._meta
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

        if (uri === cardGridViewerResource.uri) {
          const html = await cardGridViewerResource.handler();
          return NextResponse.json({
            jsonrpc: "2.0",
            id: id,
            result: {
              contents: [
                {
                  uri: uri,
                  mimeType: cardGridViewerResource.mimeType,
                  text: html,
                  _meta: cardGridViewerResource._meta
                }
              ],
              _meta: cardGridViewerResource._meta
            }
          }, { headers: corsHeaders() });
        }

        if (uri === deckViewerResource.uri) {
          const html = await deckViewerResource.handler();
          return NextResponse.json({
            jsonrpc: "2.0",
            id: id,
            result: {
              contents: [
                {
                  uri: uri,
                  mimeType: deckViewerResource.mimeType,
                  text: html,
                  _meta: deckViewerResource._meta
                }
              ],
              _meta: deckViewerResource._meta
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
    capabilities: ["OAuth 2.1 Bearer tokens", "read_mandatory_constants_first", "search_printings", "list_binders", "get_binder", "add_to_binder", "remove_from_binder", "get_wants", "add_to_wants", "remove_from_wants", "who_has", "get_article", "list_articles", "add_article_section", "update_article_section", "get_decks_to_beat", "list_decks", "get_deck", "create_deck", "add_cards_to_deck", "remove_cards_from_deck", "update_deck", "save_deck_matchup"],
    hint: "Use POST with JSON-RPC. Read fab://constants once per session, then use search_printings for all card lookups.",
    authMethods: ["Bearer <oauth_token>"],
    workflow: "read_mandatory_constants_first({uri:'fab://constants'}) → search_printings → add_to_binder / add_to_wants / add_cards_to_deck",
    setup_sequence: [
      "1️⃣ read_mandatory_constants_first({\"uri\": \"fab://constants\"})",
      "2️⃣ search_printings({ \"cards\": [{ \"query\": \"pummel red\" }] })"
    ]
  }, {
    status: 405,
    headers: corsHeaders()
  });
}