# Matchup Sideboard API

**Base Path**: `/api/decks/[deckId]/matchups`

Manages matchup-specific sideboard configurations for competitive deck planning. When exported to Talishar, these enable automatic sideboard setup based on opponent selection.

## Matchup Object

Stored in deck's `metadata` JSONB field as `metadata.matchups[]`:

```typescript
{
  heroId: string,                    // Talishar format: "briar_warden_of_thorns"
  preferredTurnOrder: "First" | "Second" | "NoPreference" | null,
  notes: string | null,             // Max 500 chars
  sideboard: {
    in: string[],                   // Cards to sideboard IN (from inventory)
    out: string[]                   // Cards to sideboard OUT (from main deck)
  }
}
```

## Validation Rules

**Strict (on save)**: Equal swap count (`in.length === out.length`), cards must exist in correct zones, quantity limits enforced, no duplicate hero matchups.

**Lenient (on export)**: Invalid matchups silently skipped, only valid ones included in Talishar response.

## ID Formats

- **Hero IDs**: Talishar format — lowercase, underscore-separated (e.g., `"briar_warden_of_thorns"`). Must exist in `HERO_INFO`, converted via `toTalisharIdentifier()`.
- **Card IDs**: `{card_name}_{pitch_color}` where pitch 1=red, 2=yellow, 3=blue. Non-pitched cards omit suffix.

## Endpoints

CRUD at `/api/decks/[deckId]/matchups` (POST, GET) and `/api/decks/[deckId]/matchups/[heroId]` (PUT, DELETE). All require authentication.
