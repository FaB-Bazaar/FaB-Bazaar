# Talishar Deck Export API

**Endpoint**: `GET /api/decks/[deckId]/talishar`

**Purpose**: Export FaB Bazaar decks in Talishar-compatible JSON format for external integrations.

## Overview

This API allows external applications (like [Talishar](https://talishar.net/)) to import decks created in FaB Bazaar. The endpoint converts FaB Bazaar's deck structure into Talishar's expected JSON format.

## Authentication

### Required: Talishar API Key

All requests require a valid Talishar API key for authentication and rate limiting.

**Methods**:
1. **Header** (recommended): `x-api-key: your_api_key_here`
2. **Query Parameter**: `?api_key=your_api_key_here`

**Rate Limit**: 100 requests/minute per API key

### Optional: User Authentication (for Private Decks)

- **Public Decks**: Only Talishar API key required
- **Private Decks**: Also requires user authentication via one of:
  - NextAuth session cookie
  - Discord Bot Token (`X-Discord-User-Id` + `X-Discord-Bot-Token` headers)
  - MCP Token (`mcp_token` query param)
  - OAuth 2.1 Bearer token (Authorization header)

## Request

### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deckId` | string | Yes | Deck's public ID (21-char nanoid) |

### Query Parameters (Optional Auth)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mcp_token` | string | No | MCP authentication token |

### Example Requests

```bash
# Public deck with API key (header)
GET /api/decks/abc123xyz/talishar
Header: x-api-key: your_talishar_api_key

# Public deck with API key (query param)
GET /api/decks/abc123xyz/talishar?api_key=your_talishar_api_key

# Private deck with both API key and user auth (Discord via headers)
GET /api/decks/abc123xyz/talishar?api_key=your_api_key
Header: X-Discord-User-Id: 123456789
Header: X-Discord-Bot-Token: your_bot_token

# Using curl
curl -H "x-api-key: your_api_key" \
     -H "User-Agent: Talishar" \
     https://fabbazaar.com/api/decks/abc123xyz/talishar
```

## Response Format

### Success Response (200 OK)

Returns deck in Talishar format:

```json
{
  "name": "Dorinthea Control",
  "format": "cc",
  "cards": [
    {
      "total": 1,
      "identifier": "dorinthea_quicksilver_prodigy"
    },
    {
      "total": 3,
      "identifier": "enlightened_strike_red"
    },
    {
      "total": 2,
      "sideboardTotal": 1,
      "identifier": "zealous_belts"
    }
  ]
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Deck name |
| `format` | string | No | Deck format code (cc, blitz, commoner, etc.) |
| `cards` | array | Yes | Array of card objects |
| `cards[].identifier` | string | Yes | Card unique ID in underscore format |
| `cards[].total` | number | Yes | Number of copies in main deck |
| `cards[].sideboardTotal` | number | No | Number of copies in sideboard (omitted if 0) |
| `matchups` | array | No | Matchup sideboard configurations (omitted if empty) |

### Format Codes

FaB Bazaar formats are mapped to Talishar codes:

| FaB Bazaar Format | Talishar Code |
|-------------------|---------------|
| Classic Constructed | `cc` |
| Silver Age | `sage` |
| Blitz | `blitz` |
| Commoner | `commoner` |
| Living Legend | `cc` |
| Limited | `draft` |
| Ultimate Pit Fight | `upf` |
| Casual | `open` |

### Card Categories Mapping

- **Main Deck** (`total`): Hero + Equipment + Main Deck cards
- **Sideboard** (`sideboardTotal`): Inventory cards

**Note**: Maybeboard and tokens are NOT included in the export.

## Matchup Sideboards (Optional)

The API response can include an optional `matchups` array with pre-configured sideboard plans for specific opponent heroes.

### Matchup Object Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `heroId` | string | Yes | Opponent hero identifier (e.g., `"briar_warden_of_thorns"`) |
| `preferredTurnOrder` | string \| null | No | `"First"`, `"Second"`, `"NoPreference"`, or `null` |
| `notes` | string \| null | No | Strategy notes (max 500 characters) |
| `sideboard` | object | Yes | Sideboard swap configuration |
| `sideboard.in` | string[] | Yes | Card identifiers to sideboard IN |
| `sideboard.out` | string[] | Yes | Card identifiers to sideboard OUT |

### Example Response with Matchups

```json
{
  "name": "Dorinthea Control",
  "format": "cc",
  "cards": [
    {
      "total": 1,
      "identifier": "dorinthea_quicksilver_prodigy"
    },
    {
      "total": 3,
      "identifier": "enlightened_strike_red"
    },
    {
      "total": 2,
      "sideboardTotal": 2,
      "identifier": "unmovable_red"
    }
  ],
  "matchups": [
    {
      "heroId": "briar_warden_of_thorns",
      "preferredTurnOrder": "Second",
      "notes": "Defend early aggression, watch for Embodiment of Earth",
      "sideboard": {
        "in": ["unmovable_red", "unmovable_red"],
        "out": ["crippling_crush_red", "pummel_red"]
      }
    },
    {
      "heroId": "fai_rising_rebellion",
      "preferredTurnOrder": "First",
      "notes": null,
      "sideboard": {
        "in": ["sink_below_red"],
        "out": ["pummel_yellow"]
      }
    }
  ]
}
```

### Matchup Validation

On **save** (via matchup API endpoints):
- Equal swap: `in.length` must equal `out.length`
- Cards in `in[]` must exist in deck's sideboard (inventory)
- Cards in `out[]` must exist in main deck (hero + equipment + maindeck)
- Cannot exceed available card quantities
- Hero ID must be valid (from HERO_INFO)
- Turn order must be valid enum or null
- Notes max 500 characters

On **export** (via Talishar endpoint):
- Invalid matchups are silently skipped with console warning
- Only matchups with valid structure are included in response
- Gracefully handles data corruption

### Managing Matchups

To create and manage matchups, use the matchup API endpoints:

- `POST /api/decks/[deckId]/matchups` - Create new matchup
- `GET /api/decks/[deckId]/matchups` - List all matchups
- `PUT /api/decks/[deckId]/matchups/[heroId]` - Update matchup
- `DELETE /api/decks/[deckId]/matchups/[heroId]` - Delete matchup

See `/api/decks/[deckId]/matchups/CLAUDE.md` for full documentation.

## Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Missing API key. Include x-api-key header or api_key query parameter."
}
```

Causes:
- No API key provided in request

### 403 Forbidden

```json
{
  "success": false,
  "error": "Invalid API key"
}
```

Causes:
- Invalid or expired API key
- API key doesn't match any configured keys

### 404 Not Found

```json
{
  "success": false,
  "error": "Deck not found"
}
```

Causes:
- Deck doesn't exist
- Private deck without proper user authentication
- Invalid deck ID

### 429 Too Many Requests

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "retryAfter": 45
}
```

Headers:
```
Retry-After: 45
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1738972800000
```

Causes:
- Exceeded 100 requests/minute per API key

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

## Card Identifiers

The API uses `card_unique_id` from the printings collection for the `identifier` field. This ensures:

1. **Format Compatibility**: Uses underscore format (e.g., `dorinthea_quicksilver_prodigy`)
2. **Card Uniqueness**: Multiple printings of the same card are grouped together
3. **Talishar Compatibility**: Matches Talishar's expected identifier format

**Fallback**: If `card_unique_id` is not available in `printingDetails`, falls back to `printingId`.

## Implementation Details

### Service Layer

Uses `deckService.findByPublicId()` for deck retrieval, following FaB Bazaar's service layer pattern.

### Card Counting Logic

1. Iterate through `hero`, `equipment`, `maindeck` arrays → count as `total`
2. Iterate through `inventory` array → count as `sideboardTotal`
3. Group by `card_unique_id` to handle multiple copies

### Example Deck Structure

**FaB Bazaar Deck**:
```typescript
{
  hero: [{ printingId: "DOR001", printingDetails: { card_unique_id: "dorinthea_quicksilver_prodigy" }}],
  equipment: [
    { printingId: "ARC003", printingDetails: { card_unique_id: "refraction_bolters" }},
    { printingId: "ARC004", printingDetails: { card_unique_id: "refraction_bolters" }}
  ],
  maindeck: [
    { printingId: "WTR001-R", printingDetails: { card_unique_id: "enlightened_strike_red" }},
    { printingId: "WTR001-R", printingDetails: { card_unique_id: "enlightened_strike_red" }},
    { printingId: "WTR001-R", printingDetails: { card_unique_id: "enlightened_strike_red" }}
  ],
  inventory: [
    { printingId: "ARC005", printingDetails: { card_unique_id: "zealous_belts" }}
  ]
}
```

**Talishar Export**:
```json
{
  "name": "My Deck",
  "format": "cc",
  "cards": [
    { "identifier": "dorinthea_quicksilver_prodigy", "total": 1 },
    { "identifier": "refraction_bolters", "total": 2 },
    { "identifier": "enlightened_strike_red", "total": 3 },
    { "identifier": "zealous_belts", "total": 0, "sideboardTotal": 1 }
  ]
}
```

## Testing

### Using curl

```bash
# Test with public deck
curl https://fabbazaar.com/api/decks/YOUR_DECK_ID/talishar

# Test with authentication
curl "https://fabbazaar.com/api/decks/YOUR_DECK_ID/talishar?mcp_token=YOUR_TOKEN"
```

### Using Postman

Import the main FaB Bazaar collection and add a new request:
- Method: GET
- URL: `{{baseUrl}}/api/decks/{{deckId}}/talishar`
- Auth: Inherit from collection or add query params

## Integration Example

### JavaScript/TypeScript

```typescript
async function importDeckToTalishar(deckId: string) {
  const response = await fetch(`https://fabbazaar.com/api/decks/${deckId}/talishar`);

  if (!response.ok) {
    throw new Error('Failed to fetch deck');
  }

  const talisharDeck = await response.json();

  // Use talisharDeck with Talishar API
  console.log(`Importing ${talisharDeck.name} with ${talisharDeck.cards.length} unique cards`);

  return talisharDeck;
}
```

### Python

```python
import requests

def import_deck_to_talishar(deck_id: str):
    response = requests.get(f"https://fabbazaar.com/api/decks/{deck_id}/talishar")
    response.raise_for_status()

    talishar_deck = response.json()
    print(f"Importing {talishar_deck['name']} with {len(talishar_deck['cards'])} unique cards")

    return talishar_deck
```

## Related Documentation

- [Deck Service Documentation](/lib/services/CLAUDE.md#deck-service)
- [Multi-Auth Documentation](/lib/auth/CLAUDE.md)
- [Talishar Format Specification](https://github.com/Talishar/Talishar) (external)
