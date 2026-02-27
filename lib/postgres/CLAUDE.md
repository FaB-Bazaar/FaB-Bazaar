# PostgreSQL Schema Reference

FaB Bazaar uses a **fully normalized PostgreSQL schema** with Drizzle ORM. No denormalization — all related data is fetched via JOINs (2–5ms on 40k+ rows with indexes). All PKs are text nanoids, not auto-increment integers.

- **Schema**: `lib/postgres/schema.ts`
- **Config**: `drizzle.config.ts`
- **Connection**: `lib/postgres/db.ts` (node-postgres pool, max 20 clients)
- **Migrations**: `lib/postgres/migrations/` (0000–0004)
- **Services**: `lib/services/postgres/`

---

## Enums

| Enum | Values |
|------|--------|
| `visibility_level` | `public`, `private`, `friends`, `unlisted` |
| `condition` | `NM` (Near Mint), `LP` (Lightly Played), `MP` (Moderately Played), `HP` (Heavily Played), `DMG` (Damaged) |
| `priority` | `low`, `medium`, `high`, `urgent` |
| `deck_category` | `hero`, `equipment`, `maindeck`, `sideboard`, `inventory` |

---

## Tables

### `users`
The central table. Every user-owned object foreign-keys back here with `ON DELETE CASCADE`.

**Key columns:**
- `id` (text PK), `username` UNIQUE, `displayUsername` (original casing)
- `email` (AES-encrypted), `emailHash` (for lookups), `emailIV`
- `passwordHash`, `isPasswordPreHashed`
- Discord: `discordId` UNIQUE, `discordUsername`, `discordAvatar`, `avatarUrl`
- MCP auth: `mcpToken`, `mcpTokenExpiry`, `clientHash`
- `countryCode`
- Role booleans: `isAdmin`, `isSuperAdmin`, `isContentCreator`, `canManageLocations`, `canImportCardCollections`, `canModerateForums`
- Account type booleans: `isStore`, `storeId`, `isLocalGamingStore`, `isPatreon`, `isShop`, `isTcgSeller`

**Indexes:** `discordId`, `username`, `emailHash`, `mcpToken`

---

### `cards`
Card-level data shared across all printings of the same card. One row per logical card.

**Key columns:**
- `cardUniqueId` (text PK)
- `name`, `displayName`, `text`, `searchableText`, `typeText`, `typeTextDisplay`
- Arrays: `types`, `traits`, `keywords`, `abilities`, `classes`, `talents`
- Game stats: `power`, `cost`, `defense`, `pitch`, `health`, `intelligence`, `color`
- **40 boolean type/class flags**: `isAction`, `isAttack`, `isDefenseReaction`, `isInstant`, `isEquipment`, `isWeapon`, `isHero`, `isMentor`, `isToken`, `playedHorizontally`, `isGeneric`, `isBrute`, `isGuardian`, `isMechanologist`, `isRanger`, `isRuneblade`, `isAssassin`, `isWarrior`, `isNinja`, `isWizard`, `isMerchant`, `isBard`, `isAdjudicator`, `isIllusionist`, `isThief`, `isShapeshifter`, `isNecromancer`
- **13 talent flags**: `hasChaos`, `hasLight`, `hasRoyal`, `hasDraconic`, `hasLightning`, `hasShadow`, `hasEarth`, `hasMystic`, `hasRevered`, `hasIce`, `hasReviled`, `hasPirate`, `hasElemental`
- Combination flags: `isGenericOnly`, `hasClassAndTalent`, `hasClassOnly`, `hasTalentOnly`
- Format legality: `blitzLegal`, `ccLegal`, `commonerLegal`, `llLegal`, `silverAgeLegal`
- Ban/suspend: `blitzBanned`, `ccBanned`, `commonerBanned`, `llBanned`, `blitzSuspended`, `ccSuspended`, `commonerSuspended`, `llRestricted`, `silverAgeBanned`, `silverAgeSuspended`

**Indexes:** `name`, `typeText`

---

### `printings`
One row per physical printing of a card (set + edition + foiling combination). References `cards`.

**Key columns:**
- `printingId` (text PK), `cardUniqueId` → `cards`
- `set`, `edition`, `foiling`, `rarity`, `collectorNumber`, `setPrintingUniqueId`
- Edition flags: `isFirstEdition`, `isUnlimited`, `isNormalEdition`
- Foiling flags: `isNormalFoil`, `isRainbowFoil`, `isColdFoil`, `isExtendedArt`
- Rarity flags: `isCommon`, `isRare`, `isSuperRare`, `isMajestic`, `isLegendary`, `isFabled`, `isPromo`
- `imageUrl`, `imageRotationDegrees`, `artists` (array), `flavorText`, `artVariations` (array)
- TCGPlayer: `tcgplayerProductId`, `tcgplayerUrl`, `tcgplayerSubtypeName`
- Pricing: `tcgMarket`, `tcgLow`, `tcgMid`, `tcgHigh`, `hasPrice`, `priceUpdatedAt`
- Price category flags: `isBudget`, `isUnder5`, `isUnder10`, `isUnder25`, `isUnder50`, `isUnder100`, `isExpensive`, `isPremium`
- `expansionSlot`, `contentHash`

**Indexes:** `cardUniqueId`, `set`, `rarity`, `edition`, `foiling`, `(set, rarity)`

---

### `binders`
A named collection belonging to a user. Inventory items live inside binders.

**Key columns:**
- `id` (text PK), `userId` → `users` (CASCADE)
- `name`, `slug`, `description`
- `isPublic`, `visibilityLevel` (enum)
- Feature flags: `allowInSearch`, `allowInMatching`, `allowDiscordCommands`, `allowApiExport`, `allowWhoHas`, `allowWebhooks`
- Stats: `statsNeedUpdate`, `statsUpdatedAt`

**Constraints:** UNIQUE `(userId, name)`

**Indexes:** `userId`, partial on `isPublic = true`, partial on `statsNeedUpdate = true`

---

### `inventory_items`
A user's physical card holdings. Each row is a distinct (binder, printing, condition, language) combination.

**Key columns:**
- `id` (text PK), `userId` → `users` (CASCADE), `binderId` → `binders` (CASCADE), `printingId` → `printings`
- `quantity`, `condition` (enum), `language` (default `EN`), `notes`
- `forTrade`, `forSale`
- `acquisitionPrice`, `acquisitionDate`

**Constraints:** UNIQUE `(binderId, printingId, condition, language)`

**Indexes:** `userId`, `binderId`, `printingId`, partial on `forTrade = true`, partial on `forSale = true`, `(userId, binderId)`, `(userId, printingId)`

---

### `wants_items`
A user's want list. Each user can want each printing at most once.

**Key columns:**
- `id` (text PK), `userId` → `users` (CASCADE), `printingId` → `printings`
- `quantity`, `priority` (enum, default `medium`), `notes`, `maxPrice`

**Constraints:** UNIQUE `(userId, printingId)`

**Indexes:** `userId`, `printingId`, `priority`

---

### `decks`
A user's deck. Cards are in `deck_cards`.

**Key columns:**
- `id` (text PK), `publicId` UNIQUE (nanoid for external URLs), `userId` → `users` (CASCADE)
- `name`, `slug`, `description`, `format`, `heroName`
- `isPublic`, `fabraryUrl`, `fabraryDeckId`
- `tags` (array), `metadata` (jsonb)

**Constraints:** UNIQUE `(userId, name)`

**Indexes:** `userId`, `publicId`, partial on `isPublic = true`, `(userId, slug)`

---

### `deck_cards`
Join table between `decks` and `printings`. Each row is a (deck, printing, category) entry.

**Key columns:**
- `id` (text PK), `deckId` → `decks` (CASCADE), `printingId` → `printings`
- `quantity`, `category` (enum: hero/equipment/maindeck/sideboard/inventory), `notes`

**Constraints:** UNIQUE `(deckId, printingId, category)`

**Indexes:** `deckId`, `printingId`

> Card stats (pitch, power, etc.) are **not** stored here — JOIN to `cards` via `printings`.

---

### `articles`
Content articles — hero guides, strategy pieces, news, user articles, etc.

**Key columns:**
- `id` (text PK), `publicId` UNIQUE, `slug` UNIQUE
- `title`, `subtitle`, `content` (raw text), `sections` (jsonb — array of typed section objects)
- `authorId` → `users` (CASCADE)
- `status`: `draft` | `published`
- `contentType`: `hero` | `article` | `guide` | `news` | `strategy` | `tournament`
- `categories` (array), `image`
- `isUserArticle`, `heroSlug`, `heroClass`

**Indexes:** `authorId`, `publicId`, `slug`, `status`, `isUserArticle`, `heroSlug`, `heroClass`, composite `(isUserArticle, authorId, status)`

---

### `oauth_clients`
Registered OAuth 2.1 clients (first-party or user-created).

**Key columns:**
- `id` (text PK), `clientId` UNIQUE, `clientSecret`, `clientName`
- `userId` → `users` (CASCADE, nullable — system clients have no user), `username` (denormalized)
- `redirectUris` (array), `grantTypes` (array), `responseTypes` (array)
- `tokenEndpointAuthMethod`, `scope`, `clientUri`
- `clientIdIssuedAt` (unix timestamp), `lastUsed`

**Indexes:** `clientId`, `userId`

---

### `oauth_authorization_codes`
Short-lived codes issued during the OAuth authorization flow. Supports PKCE.

**Key columns:**
- `id` (text PK), `code` UNIQUE
- `clientId`, `userId`, `redirectUri`, `scope`
- PKCE: `codeChallenge`, `codeChallengeMethod`
- `expiresAt`, `used`, `usedAt`

**Indexes:** `code`, `clientId`, `userId`, `expiresAt`

---

### `oauth_access_tokens`
Bearer tokens issued after successful OAuth flows.

**Key columns:**
- `id` (text PK), `accessToken` UNIQUE, `tokenType` (default `bearer`)
- `clientId`, `userId`, `scope`
- `expiresAt`, `refreshToken` UNIQUE, `refreshTokenExpiresAt`

**Indexes:** `accessToken`, `refreshToken`, `clientId`, `userId`, `expiresAt`

---

### `site_settings`
Simple key-value store for global configuration.

**Key columns:**
- `key` (text PK), `value` (jsonb), `updatedAt`

---

## Relationship Map

```
users
 ├── binders (userId → users.id)
 │    └── inventory_items (binderId → binders.id)
 │         └── printings (printingId → printings.printingId)
 │              └── cards (cardUniqueId → cards.cardUniqueId)
 │
 ├── inventory_items (userId → users.id)   [also linked via binder above]
 │
 ├── wants_items (userId → users.id)
 │    └── printings (printingId → printings.printingId)
 │         └── cards (cardUniqueId → cards.cardUniqueId)
 │
 ├── decks (userId → users.id)
 │    └── deck_cards (deckId → decks.id)
 │         └── printings (printingId → printings.printingId)
 │              └── cards (cardUniqueId → cards.cardUniqueId)
 │
 ├── articles (authorId → users.id)
 │
 └── oauth_clients (userId → users.id)
      └── [oauth_authorization_codes and oauth_access_tokens reference clientId by value]

cards ──< printings (one card, many printings)
```

**All user-owned tables** (`binders`, `inventory_items`, `wants_items`, `decks`, `articles`, `oauth_clients`) cascade-delete when the user is deleted.

---

## Common Query Patterns

### Inventory with card details
```typescript
const items = await db
  .select()
  .from(inventoryItems)
  .innerJoin(printings, eq(inventoryItems.printingId, printings.printingId))
  .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
  .where(eq(inventoryItems.binderId, binderId));
```

### Wants list with printing info
```typescript
const wants = await db
  .select()
  .from(wantsItems)
  .innerJoin(printings, eq(wantsItems.printingId, printings.printingId))
  .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
  .where(eq(wantsItems.userId, userId));
```

### Deck with all card categories
```typescript
const cards = await db
  .select()
  .from(deckCards)
  .innerJoin(printings, eq(deckCards.printingId, printings.printingId))
  .innerJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
  .where(eq(deckCards.deckId, deckId));
```

### Who has a specific printing (for trade)
```typescript
const holders = await db
  .select()
  .from(inventoryItems)
  .innerJoin(users, eq(inventoryItems.userId, users.id))
  .innerJoin(binders, eq(inventoryItems.binderId, binders.id))
  .where(and(
    eq(inventoryItems.printingId, printingId),
    eq(inventoryItems.forTrade, true),
    eq(binders.allowWhoHas, true),
    eq(binders.isPublic, true)
  ));
```

### Trade matching (user A has what user B wants)
```typescript
// Find printings user B wants that user A has for trade
const matches = await db
  .select()
  .from(wantsItems)
  .innerJoin(inventoryItems, and(
    eq(wantsItems.printingId, inventoryItems.printingId),
    eq(inventoryItems.forTrade, true)
  ))
  .where(and(
    eq(wantsItems.userId, userBId),
    eq(inventoryItems.userId, userAId)
  ));
```
