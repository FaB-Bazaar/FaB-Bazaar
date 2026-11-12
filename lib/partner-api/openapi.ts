// OpenAPI 3.1 description of /api/partner/v1, served at
// /api/partner/v1/openapi.json. openapi.test.ts fails when a route exists
// without an entry here (or the reverse), or when a scope here differs from
// the one the route enforces.
import { MAX_IMPORT_ITEMS } from './resolve-items';
import type { PartnerScope } from './scopes';

const SCOPE_DESCRIPTIONS: Record<PartnerScope, string> = {
  'cards:read': 'Search the card catalog.',
  'collection:read': "Read the user's binders and the cards in them.",
  'collection:write': "Add, change and remove cards in the user's binders. Includes collection:read.",
  'decks:read': "Read the user's decks.",
  'decks:write': "Create decks for the user, and add or remove cards in the user's decks. Includes decks:read.",
};

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ref('Error') } },
});

const envelope = (data: object, extra: Record<string, object> = {}) => ({
  type: 'object',
  required: ['success', 'data', ...Object.keys(extra)],
  properties: { success: { const: true }, data, ...extra },
});

const json = (schema: object) => ({ 'application/json': { schema } });

function operation(
  scope: PartnerScope,
  spec: {
    operationId: string;
    summary: string;
    description?: string;
    tags: string[];
    parameters?: object[];
    requestBody?: object;
    success: { status: string; description: string; schema: object };
    errors?: Record<string, string>;
  },
) {
  const responses: Record<string, object> = {
    [spec.success.status]: { description: spec.success.description, content: json(spec.success.schema) },
    '401': errorResponse('Missing, expired or invalid access token.'),
    '403': errorResponse(`The token lacks the "${scope}" scope.`),
  };
  for (const [status, description] of Object.entries(spec.errors ?? {})) {
    responses[status] = errorResponse(description);
  }
  return {
    operationId: spec.operationId,
    summary: spec.summary,
    ...(spec.description ? { description: spec.description } : {}),
    tags: spec.tags,
    security: [{ oauth2: [scope] }],
    ...(spec.parameters ? { parameters: spec.parameters } : {}),
    ...(spec.requestBody ? { requestBody: spec.requestBody } : {}),
    responses,
  };
}

const pageParams = (defaultLimit: number, maxLimit: number) => [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: maxLimit, default: defaultLimit } },
];

const pathParam = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string' },
});

export function buildOpenApiSpec(baseUrl: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'FaB Bazaar Partner API',
      version: '1.0.0',
      description:
        "Read and add to a FaB Bazaar user's collection and decks, and search the card catalog, on the user's behalf.\n\n" +
        'Every call needs an OAuth 2.1 access token (authorization code flow with PKCE) carrying the scope listed on the operation. ' +
        'Request only the scopes you use. All data is scoped to the user who authorized the token.\n\n' +
        'Prices are TCGplayer low in USD (`price_usd`); `null` means we have no price. ' +
        'Within v1, fields are only ever added — never renamed or removed.',
    },
    servers: [{ url: `${baseUrl}/api/partner/v1` }],
    tags: [{ name: 'Cards' }, { name: 'Collection' }, { name: 'Decks' }],
    paths: {
      '/cards/search': {
        get: operation('cards:read', {
          operationId: 'searchCards',
          summary: 'Search printings',
          description:
            'Give at least one filter. A name search returns front faces only; a collector number returns every printing with that number (foilings, editions, languages).',
          tags: ['Cards'],
          parameters: [
            { name: 'q', in: 'query', description: 'Card name (English).', schema: { type: 'string' } },
            { name: 'set', in: 'query', description: 'Set code, e.g. `wtr`.', schema: { type: 'string' } },
            {
              name: 'collector_number',
              in: 'query',
              description: 'Collector number as printed, e.g. `WTR167`.',
              schema: { type: 'string' },
            },
            ...pageParams(50, 100),
          ],
          success: {
            status: '200',
            description: 'Matching printings.',
            schema: envelope({ type: 'array', items: ref('Card') }, { pagination: ref('Pagination') }),
          },
          errors: { '400': 'No filter given.' },
        }),
      },
      '/binders': {
        get: operation('collection:read', {
          operationId: 'listBinders',
          summary: "List the user's binders",
          tags: ['Collection'],
          success: {
            status: '200',
            description: 'Binders with totals.',
            schema: envelope({ type: 'array', items: ref('Binder') }),
          },
        }),
      },
      '/binders/{binderId}/cards': {
        get: operation('collection:read', {
          operationId: 'listBinderCards',
          summary: 'List the cards in a binder',
          tags: ['Collection'],
          parameters: [pathParam('binderId', 'Binder id from `listBinders`.'), ...pageParams(100, 200)],
          success: {
            status: '200',
            description: 'One page of the binder, sorted by name.',
            schema: envelope({ type: 'array', items: ref('BinderItem') }, { pagination: ref('Pagination') }),
          },
          errors: { '404': 'The user has no such binder.' },
        }),
      },
      '/binders/{binderId}/cards/{itemId}': {
        patch: operation('collection:write', {
          operationId: 'updateBinderItem',
          summary: 'Change an item in a binder',
          description:
            'Sets the quantity and/or the for-trade flag of one item. `quantity` must be at least 1; to take copies away use `removeBinderCards`.',
          tags: ['Collection'],
          parameters: [
            pathParam('binderId', 'Binder id from `listBinders`.'),
            pathParam('itemId', '`item_id` from `listBinderCards`.'),
          ],
          requestBody: { required: true, content: json(ref('BinderItemUpdate')) },
          success: { status: '200', description: 'The item after the change.', schema: envelope(ref('BinderItem')) },
          errors: { '400': 'Nothing to change, or a value is not valid.', '404': 'The user has no such binder or item.' },
        }),
      },
      '/binders/{binderId}/cards/remove': {
        post: operation('collection:write', {
          operationId: 'removeBinderCards',
          summary: 'Remove copies of cards from a binder',
          description:
            'Each entry names an item and how many copies to take away (default 1). The count is subtracted in one step and never goes below zero; the item disappears when none are left. ' +
            'Entries are handled independently: one that is not in the binder is reported and the rest still apply. ' +
            'Calling this twice removes the copies twice.',
          tags: ['Collection'],
          parameters: [pathParam('binderId', 'Binder id from `listBinders`.')],
          requestBody: { required: true, content: json(ref('BinderRemoveRequest')) },
          success: { status: '200', description: 'What was removed, per entry.', schema: envelope(ref('BinderRemoveResult')) },
          errors: { '400': 'The body is not valid.', '404': 'The user has no such binder.' },
        }),
      },
      '/collection/import': {
        post: operation('collection:write', {
          operationId: 'importCollection',
          summary: "Add cards to the user's collection",
          description:
            'Adds the cards to a new binder, or to the binder named by `binder_id`. A new binder is public unless `visibility` is `private`. ' +
            'Identify each card by `printing_id`, or by `collector_number` plus `foiling` and `edition` when the number alone is not unique. ' +
            'Cards that cannot be matched to exactly one printing are not added; they come back in `unresolved` by position in `items`. ' +
            'Calling this twice adds the cards twice.',
          tags: ['Collection'],
          requestBody: { required: true, content: json(ref('CollectionImportRequest')) },
          success: {
            status: '200',
            description: 'What was added and what could not be matched.',
            schema: envelope(ref('CollectionImportResult')),
          },
          errors: {
            '400': 'The body is not valid.',
            '404': '`binder_id` is not one of the user\'s binders.',
            '409': 'No free binder name could be found; send a different `binder_name`.',
            '422': 'None of the items matched a card. Nothing was created; `error.details.unresolved` lists why.',
          },
        }),
      },
      '/decks': {
        get: operation('decks:read', {
          operationId: 'listDecks',
          summary: "List the user's decks",
          tags: ['Decks'],
          success: {
            status: '200',
            description: 'Deck summaries.',
            schema: envelope({ type: 'array', items: ref('DeckSummary') }),
          },
        }),
      },
      '/decks/{deckId}': {
        get: operation('decks:read', {
          operationId: 'getDeck',
          summary: 'Get a deck with its cards',
          tags: ['Decks'],
          parameters: [pathParam('deckId', 'Deck id from `listDecks`.')],
          success: { status: '200', description: 'The deck.', schema: envelope(ref('Deck')) },
          errors: { '404': 'The user has no such deck.' },
        }),
      },
      '/decks/{deckId}/cards': {
        post: operation('decks:write', {
          operationId: 'addDeckCards',
          summary: 'Add cards to a deck',
          description:
            "The deck's own rules apply (format legality, banned cards, copy limits, equipment slots). A card they reject is reported with a `message` and the rest are still added. " +
            'Leave `zone` out to let the deck place the card by its type.',
          tags: ['Decks'],
          parameters: [pathParam('deckId', 'Deck id from `listDecks`.')],
          requestBody: { required: true, content: json(ref('DeckCardsRequest')) },
          success: { status: '200', description: 'What was added, per card.', schema: envelope(ref('DeckAddResult')) },
          errors: { '400': 'The body is not valid.', '404': 'The user has no such deck.' },
        }),
      },
      '/decks/{deckId}/cards/remove': {
        post: operation('decks:write', {
          operationId: 'removeDeckCards',
          summary: 'Remove cards from a deck',
          description:
            'Each entry names a printing, the zone it is in (default `maindeck`) and how many copies to take away (default 1). ' +
            "Matchup plans that referred to a removed card are tidied, as in the app.",
          tags: ['Decks'],
          parameters: [pathParam('deckId', 'Deck id from `listDecks`.')],
          requestBody: { required: true, content: json(ref('DeckCardsRequest')) },
          success: { status: '200', description: 'What was removed, per card.', schema: envelope(ref('DeckRemoveResult')) },
          errors: { '400': 'The body is not valid.', '404': 'The user has no such deck.' },
        }),
      },
      '/decks/import': {
        post: operation('decks:write', {
          operationId: 'importDeck',
          summary: 'Create a deck from a decklist',
          description:
            'Takes a decklist in the FaBrary text export format (with its `Name:`, `Hero:` and `Format:` lines). ' +
            'Cards that could not be matched are listed in `unresolved`; the deck is still created.',
          tags: ['Decks'],
          requestBody: { required: true, content: json(ref('DeckImportRequest')) },
          success: { status: '201', description: 'The new deck.', schema: envelope(ref('DeckImportResult')) },
          errors: { '400': 'The body is not valid, or the decklist could not be read.' },
        }),
      },
    },
    components: {
      securitySchemes: {
        oauth2: {
          type: 'oauth2',
          description:
            `Register a client at ${baseUrl}/oauth/register (RFC 7591). Server metadata: ${baseUrl}/.well-known/oauth-authorization-server.`,
          flows: {
            authorizationCode: {
              authorizationUrl: `${baseUrl}/oauth/authorize`,
              tokenUrl: `${baseUrl}/oauth/token`,
              refreshUrl: `${baseUrl}/oauth/token`,
              scopes: SCOPE_DESCRIPTIONS,
            },
          },
        },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { const: false },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  description: 'Stable, machine-readable. Branch on this, not on `message`.',
                  examples: ['unauthorized', 'insufficient_scope', 'invalid_request', 'not_found'],
                },
                message: { type: 'string' },
                details: { type: 'object' },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          required: ['page', 'limit', 'total', 'total_pages'],
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            total_pages: { type: 'integer' },
          },
        },
        Card: {
          type: 'object',
          description: 'One printing of a card.',
          required: [
            'printing_id', 'card_unique_id', 'name', 'pitch', 'set', 'collector_number',
            'edition', 'foiling', 'rarity', 'language', 'image_url', 'price_usd',
          ],
          properties: {
            printing_id: { type: 'string', description: 'Identifies this exact printing. Stable.' },
            card_unique_id: { type: 'string', description: 'Identifies the card (at one pitch) across all its printings.' },
            name: { type: 'string' },
            pitch: { type: ['integer', 'null'], description: '1 red, 2 yellow, 3 blue; null when the card has no pitch.' },
            set: { type: 'string', description: 'Set code, lowercase.' },
            collector_number: { type: 'string', examples: ['WTR167'] },
            edition: { type: 'string', description: '`a` alpha, `f` first, `u` unlimited, `n` no edition.' },
            foiling: { type: 'string', description: '`s` non-foil, `r` rainbow, `c` cold, `g` gold.' },
            rarity: { type: 'string' },
            language: { type: 'string', examples: ['en'] },
            image_url: { type: ['string', 'null'], format: 'uri' },
            price_usd: { type: ['number', 'null'], description: 'TCGplayer low, USD.' },
          },
        },
        Binder: {
          type: 'object',
          required: ['id', 'name', 'slug', 'visibility', 'total_quantity', 'total_value_usd', 'updated_at'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: ['string', 'null'] },
            visibility: { type: 'string', enum: ['public', 'private', 'friends', 'unlisted'] },
            total_quantity: { type: 'integer' },
            total_value_usd: { type: 'number', description: 'Sum of TCGplayer low.' },
            updated_at: { type: ['string', 'null'], format: 'date-time' },
          },
        },
        BinderItem: {
          type: 'object',
          required: ['item_id', 'quantity', 'condition', 'for_trade', 'card'],
          properties: {
            item_id: { type: 'string' },
            quantity: { type: 'integer' },
            condition: { type: 'string', examples: ['NM'] },
            for_trade: { type: 'boolean' },
            card: ref('Card'),
          },
        },
        BinderItemUpdate: {
          type: 'object',
          description: 'Give at least one field.',
          properties: {
            quantity: { type: 'integer', minimum: 1, maximum: 999 },
            for_trade: { type: 'boolean' },
          },
        },
        BinderRemoveRequest: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 500,
              items: {
                type: 'object',
                required: ['item_id'],
                properties: {
                  item_id: { type: 'string', description: '`item_id` from `listBinderCards`.' },
                  quantity: { type: 'integer', minimum: 1, maximum: 999, default: 1 },
                },
              },
            },
          },
        },
        BinderRemoveResult: {
          type: 'object',
          required: ['removed', 'failed', 'results'],
          properties: {
            removed: { type: 'integer', description: 'Entries applied.' },
            failed: { type: 'integer' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                required: ['item_id', 'removed'],
                properties: {
                  item_id: { type: 'string' },
                  removed: { type: 'boolean' },
                  remaining: { type: 'integer', description: 'Copies left; 0 means the item is gone.' },
                  reason: { type: 'string', enum: ['not_found'] },
                },
              },
            },
          },
        },
        CollectionImportItem: {
          type: 'object',
          description: 'Needs `printing_id` or `collector_number`.',
          properties: {
            printing_id: { type: 'string' },
            collector_number: { type: 'string', examples: ['WTR167'] },
            foiling: {
              type: 'string',
              description: 'Code or name: `s`/`standard`, `r`/`rainbow`, `c`/`cold`, `g`/`gold`.',
            },
            edition: {
              type: 'string',
              description: 'Code or name: `a`/`alpha`, `f`/`first`, `u`/`unlimited`, `n`.',
            },
            quantity: { type: 'integer', minimum: 1, maximum: 999, default: 1 },
            for_trade: { type: 'boolean', default: false },
          },
        },
        CollectionImportRequest: {
          type: 'object',
          required: ['items'],
          properties: {
            binder_id: { type: 'string', description: 'Add to this binder instead of creating one.' },
            binder_name: {
              type: 'string',
              description: 'Name for the new binder. A number is appended if the user already has one by that name.',
            },
            visibility: {
              type: 'string',
              enum: ['public', 'private'],
              default: 'public',
              description: 'Who can see the new binder. Ignored when `binder_id` is given.',
            },
            items: { type: 'array', minItems: 1, maxItems: MAX_IMPORT_ITEMS, items: ref('CollectionImportItem') },
          },
        },
        UnresolvedItem: {
          type: 'object',
          required: ['index', 'reason'],
          properties: {
            index: { type: 'integer', description: 'Position in the request `items`.' },
            reason: { type: 'string', enum: ['not_found', 'ambiguous'] },
            candidates: {
              type: 'array',
              items: { type: 'string' },
              description: 'When ambiguous: the printing ids it could be. Resend with one of them.',
            },
          },
        },
        CollectionImportResult: {
          type: 'object',
          required: ['binder', 'imported', 'failed', 'unresolved'],
          properties: {
            binder: {
              type: 'object',
              required: ['id', 'name', 'created'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                created: { type: 'boolean', description: 'true when this call created the binder.' },
              },
            },
            imported: { type: 'integer', description: 'Items added.' },
            failed: { type: 'integer', description: 'Matched items that could not be added.' },
            unresolved: { type: 'array', items: ref('UnresolvedItem') },
          },
        },
        DeckSummary: {
          type: 'object',
          required: ['id', 'name', 'format', 'hero', 'visibility', 'total_cards', 'estimated_value_usd', 'updated_at'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            format: { type: 'string', examples: ['Classic Constructed'] },
            hero: { type: ['string', 'null'] },
            visibility: { type: 'string' },
            total_cards: { type: 'integer' },
            estimated_value_usd: { type: 'number', description: 'Sum of TCGplayer low.' },
            updated_at: { type: ['string', 'null'], format: 'date-time' },
          },
        },
        DeckCard: {
          type: 'object',
          required: ['printing_id', 'quantity', 'card'],
          properties: {
            printing_id: { type: 'string' },
            quantity: { type: 'integer' },
            card: { oneOf: [ref('Card'), { type: 'null' }] },
          },
        },
        Deck: {
          allOf: [
            ref('DeckSummary'),
            {
              type: 'object',
              required: ['zones'],
              properties: {
                zones: {
                  type: 'object',
                  description: '`inventory` is the sideboard. `benched` is a maybe-pile that is not part of the deck.',
                  required: ['hero', 'equipment', 'maindeck', 'inventory', 'benched', 'tokens'],
                  properties: Object.fromEntries(
                    ['hero', 'equipment', 'maindeck', 'inventory', 'benched', 'tokens'].map(zone => [
                      zone,
                      { type: 'array', items: ref('DeckCard') },
                    ]),
                  ),
                },
              },
            },
          ],
        },
        DeckZone: {
          type: 'string',
          enum: ['hero', 'equipment', 'maindeck', 'inventory', 'benched', 'tokens'],
          description: '`inventory` is the sideboard (`sideboard` is accepted for it). `benched` is a maybe-pile outside the deck.',
        },
        DeckCardsRequest: {
          type: 'object',
          required: ['cards'],
          properties: {
            cards: {
              type: 'array',
              minItems: 1,
              maxItems: 200,
              items: {
                type: 'object',
                required: ['printing_id'],
                properties: {
                  printing_id: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1, maximum: 999, default: 1 },
                  zone: ref('DeckZone'),
                },
              },
            },
          },
        },
        DeckAddResult: {
          type: 'object',
          required: ['added', 'failed', 'results'],
          properties: {
            added: { type: 'integer' },
            failed: { type: 'integer' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                required: ['printing_id', 'added'],
                properties: {
                  printing_id: { type: 'string' },
                  added: { type: 'boolean' },
                  name: { type: ['string', 'null'] },
                  zone: { type: ['string', 'null'] },
                  quantity: { type: 'integer' },
                  reason: { type: 'string', enum: ['rejected', 'invalid_zone'] },
                  message: { type: 'string', description: 'Why the card was not added, in words for the user.' },
                },
              },
            },
          },
        },
        DeckRemoveResult: {
          type: 'object',
          required: ['removed', 'failed', 'results'],
          properties: {
            removed: { type: 'integer' },
            failed: { type: 'integer' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                required: ['printing_id', 'removed'],
                properties: {
                  printing_id: { type: 'string' },
                  removed: { type: 'boolean' },
                  zone: { type: 'string' },
                  quantity: { type: 'integer' },
                  reason: { type: 'string', enum: ['not_found', 'invalid_zone'] },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        DeckImportRequest: {
          type: 'object',
          required: ['text'],
          properties: { text: { type: 'string', description: 'Decklist in the FaBrary text export format.' } },
        },
        DeckImportResult: {
          type: 'object',
          required: ['deck', 'cards_requested', 'cards_added', 'unresolved'],
          properties: {
            deck: {
              type: 'object',
              required: ['id', 'name', 'format', 'hero'],
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                format: { type: 'string' },
                hero: { type: 'string' },
              },
            },
            cards_requested: { type: 'integer' },
            cards_added: { type: 'integer' },
            unresolved: { type: 'array', items: { type: 'string' }, description: 'Card names that were not matched.' },
          },
        },
      },
    },
  };
}
