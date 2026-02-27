# Matchup Sideboard API

**Base Path**: `/api/decks/[deckId]/matchups`

**Purpose**: Manage matchup-specific sideboard configurations for competitive deck planning and Talishar integration.

## Overview

Matchups enable competitive players to pre-plan sideboard strategies for specific opponent heroes. When exported to Talishar, these configurations allow automatic sideboard setup based on opponent selection.

## Authentication

All endpoints require user authentication via any supported method:
- NextAuth session cookie
- Discord Bot Token (`discordId` query param)
- MCP Token (`mcp_token` query param)
- OAuth 2.1 Bearer token (Authorization header)

## Matchup Object

```typescript
{
  "heroId": "briar_warden_of_thorns",           // Talishar format
  "preferredTurnOrder": "First" | "Second" | "NoPreference" | null,
  "notes": "Strategy notes (max 500 chars)",    // Optional
  "sideboard": {
    "in": ["throttle_red", "sink_below_red"],   // Cards to sideboard IN
    "out": ["pummel_red", "pummel_yellow"]      // Cards to sideboard OUT
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `heroId` | string | Yes | Opponent hero identifier in Talishar format (e.g., `"briar_warden_of_thorns"`) |
| `preferredTurnOrder` | string \| null | No | Turn order preference: `"First"`, `"Second"`, `"NoPreference"`, or `null` |
| `notes` | string \| null | No | Strategy notes (max 500 characters) |
| `sideboard` | object | Yes | Sideboard swap configuration |
| `sideboard.in` | string[] | Yes | Card identifiers to sideboard IN (from inventory) |
| `sideboard.out` | string[] | Yes | Card identifiers to sideboard OUT (from main deck) |

## Validation Rules

### Strict Validation (On Save)

All create/update operations enforce strict validation:

1. **Equal Swap**: `sideboard.in.length === sideboard.out.length`
2. **Card Availability (IN)**: Cards in `in[]` must exist in deck's inventory (sideboard)
3. **Card Availability (OUT)**: Cards in `out[]` must exist in main deck (hero + equipment + maindeck)
4. **Quantity Limits**: Cannot exceed available card quantities
5. **Valid Hero ID**: Must exist in HERO_INFO (converted to Talishar format)
6. **Valid Turn Order**: Must be `"First"`, `"Second"`, `"NoPreference"`, or `null`
7. **Notes Length**: Max 500 characters
8. **No Duplicates**: Cannot create duplicate matchup for same hero

### Lenient Validation (On Export)

The Talishar export endpoint uses lenient validation:
- Invalid matchups are silently skipped
- Console warnings logged for debugging
- Only valid matchups included in response
- Gracefully handles data corruption

## API Endpoints

### Create Matchup

**POST** `/api/decks/[deckId]/matchups`

Creates a new matchup for the specified deck.

#### Request

```json
{
  "matchup": {
    "heroId": "briar_warden_of_thorns",
    "preferredTurnOrder": "Second",
    "notes": "Defend early aggression, watch for Embodiment of Earth",
    "sideboard": {
      "in": ["unmovable_red", "unmovable_red"],
      "out": ["crippling_crush_red", "pummel_red"]
    }
  }
}
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "matchup": {
      "heroId": "briar_warden_of_thorns",
      "preferredTurnOrder": "Second",
      "notes": "Defend early aggression, watch for Embodiment of Earth",
      "sideboard": {
        "in": ["unmovable_red", "unmovable_red"],
        "out": ["crippling_crush_red", "pummel_red"]
      }
    }
  }
}
```

#### Error Responses

**400 Bad Request** - Validation Error
```json
{
  "success": false,
  "error": "Sideboard swap not balanced: 2 in, 3 out",
  "errors": [
    "Sideboard swap not balanced: 2 in, 3 out"
  ]
}
```

**400 Bad Request** - Duplicate Hero
```json
{
  "success": false,
  "error": "Matchup for briar_warden_of_thorns already exists"
}
```

**400 Bad Request** - Card Unavailable
```json
{
  "success": false,
  "error": "Card 'unmovable_red' - need 2 copies in sideboard, only 1 available",
  "errors": [
    "Card 'unmovable_red' - need 2 copies in sideboard, only 1 available"
  ]
}
```

**401 Unauthorized**
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**403 Forbidden**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**404 Not Found**
```json
{
  "success": false,
  "error": "Deck not found"
}
```

### List Matchups

**GET** `/api/decks/[deckId]/matchups`

Retrieves all matchups for the specified deck.

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "matchups": [
      {
        "heroId": "briar_warden_of_thorns",
        "preferredTurnOrder": "Second",
        "notes": "Defend early aggression",
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
}
```

#### Error Responses

Same as Create endpoint (401, 403, 404)

### Update Matchup

**PUT** `/api/decks/[deckId]/matchups/[heroId]`

Updates an existing matchup. The `heroId` in the URL must match the `heroId` in the request body.

#### Request

```json
{
  "matchup": {
    "heroId": "briar_warden_of_thorns",
    "preferredTurnOrder": "First",
    "notes": "Updated strategy notes",
    "sideboard": {
      "in": ["sink_below_red", "sink_below_red"],
      "out": ["crippling_crush_red", "pummel_red"]
    }
  }
}
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "matchup": {
      "heroId": "briar_warden_of_thorns",
      "preferredTurnOrder": "First",
      "notes": "Updated strategy notes",
      "sideboard": {
        "in": ["sink_below_red", "sink_below_red"],
        "out": ["crippling_crush_red", "pummel_red"]
      }
    }
  }
}
```

#### Error Responses

**400 Bad Request** - Hero ID Mismatch
```json
{
  "success": false,
  "error": "Hero ID mismatch"
}
```

**404 Not Found** - Matchup Not Found
```json
{
  "success": false,
  "error": "Matchup not found"
}
```

Plus same validation errors as Create endpoint (400, 401, 403, 404)

### Delete Matchup

**DELETE** `/api/decks/[deckId]/matchups/[heroId]`

Deletes a matchup for the specified hero.

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "message": "Matchup deleted"
  }
}
```

#### Error Responses

**404 Not Found**
```json
{
  "success": false,
  "error": "Matchup not found"
}
```

Plus same auth errors as other endpoints (401, 403, 404)

## Hero Identifiers

Hero IDs use Talishar format (underscore-separated, lowercase):

**Examples:**
- `"dorinthea_quicksilver_prodigy"`
- `"briar_warden_of_thorns"`
- `"fai_rising_rebellion"`
- `"azalea_ace_in_the_hole"`

**Valid Heroes**: All heroes in `HERO_INFO` (lib/hero-data.ts), converted via `toTalisharIdentifier()`

## Card Identifiers

Card identifiers match the format used in Talishar export:
- `{card_name}_{pitch_color}` for pitched cards (e.g., `"throttle_red"`)
- `{card_name}` for non-pitched cards (e.g., `"banksy"`)

**Pitch Colors:**
- `1` → `"red"`
- `2` → `"yellow"`
- `3` → `"blue"`

## Storage

Matchups are stored in the deck's `metadata` field:

```javascript
deck.metadata = {
  matchups: [
    { heroId: "...", preferredTurnOrder: "...", notes: "...", sideboard: {...} }
  ]
}
```

**Benefits:**
- No schema migration required
- Backwards compatible
- Flexible for future enhancements
- Uses existing MongoDB field

## Integration with Talishar Export

When a deck is exported via `GET /api/decks/[deckId]/talishar`, valid matchups are automatically included in the response.

**Talishar Export Example:**

```json
{
  "name": "Dorinthea Control",
  "format": "cc",
  "cards": [...],
  "matchups": [
    {
      "heroId": "briar_warden_of_thorns",
      "preferredTurnOrder": "Second",
      "notes": "Defend early aggression",
      "sideboard": {
        "in": ["unmovable_red", "unmovable_red"],
        "out": ["crippling_crush_red", "pummel_red"]
      }
    }
  ]
}
```

See `/api/decks/[deckId]/talishar/CLAUDE.md` for full Talishar export documentation.

## Usage Examples

### JavaScript/TypeScript

```typescript
// Create matchup
const response = await fetch(`/api/decks/${deckId}/matchups`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    matchup: {
      heroId: 'briar_warden_of_thorns',
      preferredTurnOrder: 'Second',
      notes: 'Defend early aggression',
      sideboard: {
        in: ['unmovable_red', 'unmovable_red'],
        out: ['crippling_crush_red', 'pummel_red']
      }
    }
  })
});

const result = await response.json();
if (result.success) {
  console.log('Matchup created:', result.data.matchup);
}

// List matchups
const listResponse = await fetch(`/api/decks/${deckId}/matchups`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const matchups = await listResponse.json();
console.log('All matchups:', matchups.data.matchups);

// Update matchup
await fetch(`/api/decks/${deckId}/matchups/briar_warden_of_thorns`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    matchup: {
      heroId: 'briar_warden_of_thorns',
      preferredTurnOrder: 'First',
      notes: 'Updated notes',
      sideboard: {
        in: ['sink_below_red'],
        out: ['pummel_red']
      }
    }
  })
});

// Delete matchup
await fetch(`/api/decks/${deckId}/matchups/briar_warden_of_thorns`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### curl

```bash
# Create matchup
curl -X POST "https://fabbazaar.com/api/decks/[deckId]/matchups" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "matchup": {
      "heroId": "briar_warden_of_thorns",
      "preferredTurnOrder": "Second",
      "notes": "Defend early aggression",
      "sideboard": {
        "in": ["unmovable_red", "unmovable_red"],
        "out": ["crippling_crush_red", "pummel_red"]
      }
    }
  }'

# List matchups
curl -X GET "https://fabbazaar.com/api/decks/[deckId]/matchups" \
  -H "Authorization: Bearer [token]"

# Update matchup
curl -X PUT "https://fabbazaar.com/api/decks/[deckId]/matchups/briar_warden_of_thorns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "matchup": {
      "heroId": "briar_warden_of_thorns",
      "preferredTurnOrder": "First",
      "notes": "Updated",
      "sideboard": {
        "in": ["sink_below_red"],
        "out": ["pummel_red"]
      }
    }
  }'

# Delete matchup
curl -X DELETE "https://fabbazaar.com/api/decks/[deckId]/matchups/briar_warden_of_thorns" \
  -H "Authorization: Bearer [token]"
```

## Common Use Cases

### 1. Pre-Planning Tournament Matchups

```typescript
// Create matchups for expected meta heroes
const metaHeroes = [
  { heroId: 'briar_warden_of_thorns', turnOrder: 'Second' },
  { heroId: 'fai_rising_rebellion', turnOrder: 'First' },
  { heroId: 'iyslander_stormbind', turnOrder: 'Second' }
];

for (const hero of metaHeroes) {
  await createMatchup(deckId, {
    heroId: hero.heroId,
    preferredTurnOrder: hero.turnOrder,
    notes: `Meta matchup - analyzed ${new Date().toLocaleDateString()}`,
    sideboard: calculateOptimalSideboard(hero.heroId)
  });
}
```

### 2. Testing Sideboard Plans

```typescript
// Test different sideboard configurations
const testConfigs = [
  { in: ['sink_below_red', 'sink_below_red'], out: ['pummel_red', 'pummel_yellow'] },
  { in: ['unmovable_red', 'unmovable_red'], out: ['crippling_crush_red', 'pummel_red'] }
];

for (const config of testConfigs) {
  await updateMatchup(deckId, heroId, {
    heroId,
    preferredTurnOrder: 'Second',
    notes: `Test config ${testConfigs.indexOf(config) + 1}`,
    sideboard: config
  });

  // Test in Talishar
  const talisharDeck = await exportToTalishar(deckId);
  await testInSimulator(talisharDeck);
}
```

### 3. Bulk Import from Spreadsheet

```typescript
// Import matchups from CSV/spreadsheet
async function importMatchupsFromCSV(deckId: string, csvData: string) {
  const rows = parseCSV(csvData);

  for (const row of rows) {
    await createMatchup(deckId, {
      heroId: toTalisharIdentifier(row.hero),
      preferredTurnOrder: row.turnOrder,
      notes: row.notes,
      sideboard: {
        in: row.sideboardIn.split(','),
        out: row.sideboardOut.split(',')
      }
    });
  }
}
```

## Related Documentation

- [Talishar Export API](/app/api/decks/[deckId]/talishar/CLAUDE.md)
- [Deck Service Documentation](/lib/services/CLAUDE.md#deck-service)
- [Multi-Auth Documentation](/lib/auth/CLAUDE.md)
- [Hero Data Reference](/lib/hero-data.ts)
