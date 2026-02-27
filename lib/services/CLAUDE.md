# Service Layer Architecture

This directory contains the service layer that abstracts all database access behind clean interfaces.

## Key Concepts

- **Contracts** (`contracts/`): TypeScript interfaces defining service APIs - database agnostic
- **MongoDB Implementations** (`mongodb/`): Concrete implementations using MongoDB/Mongoose
- **PostgreSQL Implementations** (`postgres/`): Concrete implementations using PostgreSQL/Drizzle
- **ServiceFactory** (`index.ts`): Singleton factory managing service instances

## PostgreSQL Migration Status

**Last Updated**: 2026-02-16

The platform has completed migration from MongoDB to PostgreSQL. Set `DATABASE_PROVIDER=postgres` in `.env.local` to use PostgreSQL implementations (default).

**Recent Changes (2026-02-16)**:
- ✅ Removed `heroService` - migrated 2 API routes to use `printingsService` + `@/lib/fab-constants/heroes`
- ✅ Removed `binderStatsService` - deleted 2 cron/refresh routes (stats now calculated on-demand)

### ✅ Migrated Services (10/10 services - 100% COMPLETE)
- `userService` - User accounts, auth, profiles
- `binderService` - Card collections/binders
- `inventoryService` - Inventory items in binders
- `wantsService` - User want lists
- `printingsService` - Full card search
- `deckService` - Deck management
- `articleService` - Article/CMS management (includes hero guides via contentType='hero')
- `authTokenService` - Authentication tokens (MCP, Bearer, OAuth)
- `oauthService` - OAuth client management
- `oauthFlowService` - OAuth 2.1 protocol flows

### ❌ Deprecated Services (9 services - DO NOT MIGRATE)
- `metadataService` - **Use `@/lib/fab-constants` instead** (static data, no DB needed)
- `heroService` - **✅ REMOVED (2026-02-16)** - Use `printingsService` + `@/lib/fab-constants/heroes` + `articleService`
- `binderStatsService` - **✅ REMOVED (2026-02-16)** - Use `binderService.getUserBindersWithStats()` (stats calculated on-demand)
- `systemStatsService` - **Removed** (homepage vanity metrics not needed)
- `tradeMatchingService` - Pre-calculated matches (redundant functionality)
- `tradeAnalysisService` - Real-time analysis (redundant functionality)
- `matchingService` - Bilateral matching (redundant functionality)
- `denormalizationService` - **Not needed in PostgreSQL** (proper JOINs eliminate need)
- `featuredCardsService` - Consider PostgreSQL views or Redis instead

**Why no denormalization in PostgreSQL?**
PostgreSQL handles JOINs efficiently with proper indexes. Testing showed 3-way JOINs execute in 2-5ms on 40k+ rows. The MongoDB version needed denormalization due to `$lookup` performance, but PostgreSQL's query planner and indexes make this unnecessary. Keep data normalized for simpler maintenance.

## IMPORTANT: All database access MUST go through services

```typescript
// CORRECT - Use service layer
import { userService, binderService } from '@/lib/services';
const result = await binderService.getBinder(binderId, userId);

// WRONG - Direct MongoDB access (deprecated pattern)
import connectToDatabase from '@/lib/mongodb';
const { db } = await connectToDatabase();
```

## AsyncResult Pattern

All service methods return `AsyncResult<T>` for consistent error handling:

```typescript
type AsyncResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Usage
const result = await userService.findById(userId);
if (result.success) {
  console.log(result.data); // The user object
} else {
  console.error(result.error); // Error message
}
```

## Available Services

### Active Services (18 total)

| Service | Purpose | PostgreSQL Status |
|---------|---------|-------------------|
| `userService` | User accounts, auth, profiles | ✅ Migrated |
| `binderService` | Card collections/binders (includes showcase cards support) | ✅ Migrated |
| `inventoryService` | Inventory items in binders | ✅ Migrated |
| `wantsService` | User want lists | ✅ Migrated |
| `printingsService` | Full card search (printings collection) | ✅ Migrated |
| `printingsCoreService` | Lightweight card lookup (printings_core) | MongoDB only |
| `deckService` | Deck management | ✅ Migrated |
| `notificationService` | Trade notifications | MongoDB only |
| `binderStatsService` | Binder statistics calculation | ✅ REMOVED (2026-02-16) - use binderService.getUserBindersWithStats() |
| `tradeService` | P2P trade execution (ACID) | MongoDB only |
| `escrowService` | Trade escrow/locking (ACID) | MongoDB only |
| `storeManagerService` | Store permissions | MongoDB only |
| `geoService` | Geographic data | MongoDB only |
| `authService` | JWT/password utilities (database-agnostic) | N/A |
| `heroService` | Hero card operations and search | ✅ REMOVED (2026-02-16) - use printingsService + fab-constants |
| `systemStatsService` | Homepage and pricing statistics | ❌ Deprecated - vanity metrics removed |
| `authTokenService` | Authentication tokens (MCP, Bearer, OAuth) | ✅ Migrated |
| `articleService` | Article/CMS management (hero guides, user articles) | ✅ Migrated |
| `oauthService` | OAuth client management (user CRUD operations) | ✅ Migrated |
| `oauthFlowService` | OAuth 2.1 protocol implementation (authorization, tokens) | ✅ Migrated |

### ❌ Deprecated Services (DO NOT USE)

| Service | Replacement | Reason |
|---------|-------------|--------|
| `metadataService` | `@/lib/fab-constants` | Static data doesn't need database |
| `heroService` | `printingsService` + `@/lib/fab-constants/heroes` + `articleService` | Redundant - cards in DB, static info in constants, guides in articles |
| `binderStatsService` | `binderService.getUserBindersWithStats()` | PostgreSQL aggregates fast enough for real-time calculation |
| `systemStatsService` | Remove entirely | Homepage vanity metrics (total users, total cards) not needed |
| `tradeMatchingService` | Remove entirely | Redundant functionality |
| `tradeAnalysisService` | Remove entirely | Redundant functionality |
| `matchingService` | Remove entirely | Redundant functionality |
| `denormalizationService` | Not needed in PostgreSQL | JOINs are fast, keep data normalized |
| `featuredCardsService` | PostgreSQL views or Redis | Reconsider caching strategy |

## ❌ DEPRECATED: Metadata Service

**Status**: Deprecated as of 2026-02-15
**Replacement**: Use `@/lib/fab-constants` instead

The `metadataService` pulled card metadata from MongoDB collections, but this data is **static reference data** that doesn't change frequently. It's now available as TypeScript constants in `@/lib/fab-constants`.

## ❌ DEPRECATED: Hero Service

**Status**: Deprecated as of 2026-02-15
**Replacement**: Use `printingsService` + `@/lib/fab-constants/heroes` + `articleService`

The `heroService` had two purposes, both now handled by existing services:

### 1. Hero Card Data (searchHeroes, getHeroBySlug)
**Before**: Separate `hero_printing_cards` collection with dedicated service
**After**: Hero cards already in `cards` table (where `is_hero = true`)

**Use `printingsService` instead**:
```typescript
// Search heroes by class
const result = await printingsService.searchPrintings({
  isHero: true,
  classes: ['ninja']
});

// Get hero by card unique ID
const hero = await printingsService.getPrintingsByCardId(cardUniqueId);
```

### 2. Hero Static Info (classes, talents, nicknames)
**Before**: Stored in database
**After**: Static TypeScript constants in `@/lib/fab-constants/heroes.ts`

**Use constants instead**:
```typescript
import { HERO_INFO, getHeroInfo, getHeroesGroupedByClass } from '@/lib/fab-constants/heroes';

// Get hero info (66 adult heroes + 60+ young heroes)
const katsu = getHeroInfo('katsu'); // { classes: ['ninja'], talents: [], cardUniqueId: '...' }

// Get all heroes grouped by class
const grouped = getHeroesGroupedByClass();
// { 'Ninja': ['katsu, the wanderer', 'fai, rising rebellion', ...], ... }
```

### 3. Hero CMS Content (guides, strategy)
**Before**: `upsertHeroContent()`, `getHeroContent()`, `deleteHeroContent()`
**After**: Use `articleService` with `contentType='hero'`

**Use articleService instead**:
```typescript
// Create hero guide
await articleService.createArticle(authorId, {
  title: 'Katsu, the Wanderer Guide',
  contentType: 'hero',
  heroSlug: 'katsu-the-wanderer',
  heroClass: 'ninja',
  sections: [...]
});
```

### Migration Notes
- **API routes** (`/api/hero-printings/*`) should use `printingsService` + constants
- **Hero actions** (`app/actions/heroActions.ts`) should use `articleService`
- **Benefits**: No separate collection, faster (constants are in-memory), type-safe

## ❌ DEPRECATED: Binder Stats Service

**Status**: Deprecated as of 2026-02-15
**Replacement**: Use `binderService.getUserBindersWithStats()` - stats calculated on-demand

The `binderStatsService` was needed in MongoDB to pre-calculate and cache binder statistics due to slow aggregation pipelines. PostgreSQL can calculate stats in real-time using fast SQL aggregates.

### MongoDB Approach (Deprecated)
**Problem**: MongoDB aggregation pipelines were slow
**Solution**: Pre-calculate stats, store in binder document, use "dirty flag" pattern

```typescript
// MongoDB: Cache stats in binder document
await binderStatsService.updateStats(binderId); // Stores stats in DB
await binderStatsService.triggerUpdate(binderId, { rarity: 'M' }); // Mark dirty

// Background cron job processes dirty binders
await binderStatsService.updateDirtyBinders(100);
```

### PostgreSQL Approach (Current)
**Solution**: Calculate stats on-demand with SQL aggregates (2-5ms execution time)

```typescript
// PostgreSQL: Calculate stats in real-time
const result = await binderService.getUserBindersWithStats(userId);
// Stats calculated via SQL aggregates:
// - SUM(quantity) for totals
// - SUM(quantity * price) for values
// - GROUP BY rarity for rarity counts
// - ORDER BY price DESC LIMIT 10 for showcase cards
```

### What Stats Are Calculated

For each binder:
- **Quantities**: Total cards, cards for trade, cards not for trade
- **Values**: Total value, trade value, non-trade value (4 pricing types: market, low, mid, high)
- **Rarity Counts**: Breakdown by rarity (overall, for-trade, not-for-trade)
- **Showcase Cards**: Top 10 most valuable cards

### Migration Notes
- **Cron jobs** (`/api/cron/update-binder-stats`) no longer needed
- **Refresh endpoints** (`/api/binders/[binderId]/refresh-stats`) can be removed
- **Dirty flags** (`statsNeedUpdate`) no longer needed in schema
- **Benefits**: Always current (no stale stats), simpler code, no background jobs needed

### ✅ Use fab-constants Instead

```typescript
// CORRECT - Use fab-constants (no database call needed)
import {
  SET_MAP,
  FOILING_MAP,
  RARITY_MAP,
  EDITION_MAP,
  getSetMetadata,
  getSetsInDisplayOrder
} from '@/lib/fab-constants';

// Get all sets
const sets = getSetsInDisplayOrder();

// Get set metadata
const setInfo = getSetMetadata('wtr'); // { code: 'wtr', name: 'Welcome to Rathe', ... }

// Get foilings
const foilings = Object.entries(FOILING_MAP); // [['r', 'Rainbow Foil'], ...]

// DEPRECATED - Old pattern (requires database call)
import { metadataService } from '@/lib/services';
const result = await metadataService.getAllMetadata(); // Don't use this
```

### Migration Notes
- **API routes** (`/api/metadata/*`) should be deprecated and clients updated to use constants
- **fab-constants** already used in 11+ files across the codebase
- **Benefits**: No database calls, type-safe, faster, simpler

## ❌ DEPRECATED: Trade Matching Services

**Status**: Deprecated as of 2026-02-15
**Reason**: Redundant functionality - these three services overlap significantly

The following trade-related services are marked for removal:

### `tradeMatchingService`
Pre-calculated trade opportunities from nightly cron jobs. Consider removing if not actively used.

### `tradeAnalysisService`
Real-time trade compatibility analysis between users. Overlaps with `matchingService`.

### `matchingService`
Bilateral match rate calculation. Overlaps with `tradeAnalysisService`.

**Migration plan**: Consolidate functionality or remove if unused. Review actual usage before deciding final approach.

## ⚠️ Featured Cards Service - Consider Alternative

**Status**: Reconsider caching strategy for PostgreSQL
**Current**: MongoDB aggregation pipelines with collection-based cache
**Alternative**: PostgreSQL materialized views or Redis

The `featuredCardsService` uses complex MongoDB aggregations to cache homepage featured cards. For PostgreSQL, consider:

1. **Materialized Views**: Create a refreshable view with the aggregation logic
2. **Redis Cache**: Move caching out of database entirely
3. **On-demand queries**: If fast enough with proper indexes, skip caching

### Current Implementation (MongoDB)

```typescript
// Aggregation pipeline cached in featured_cards collection
const result = await featuredCardsService.refreshFeaturedCards();
```

### PostgreSQL Alternatives

```sql
-- Option 1: Materialized View
CREATE MATERIALIZED VIEW featured_cards AS
SELECT ...complex query...;
REFRESH MATERIALIZED VIEW featured_cards;

-- Option 2: Regular query if performant
SELECT ... FROM inventory_items i
JOIN printings p ON i.printing_id = p.printing_id
WHERE i.for_trade AND p.tcg_market >= 15
ORDER BY (p.tcg_market * unique_owners_count) DESC;
```

**Decision needed**: Test query performance before migrating this service.

## Binder Service - Showcase Cards Enhancement

**Last Updated**: 2026-01-12

The `binderService` was enhanced to support **showcase cards** in the `getUserBindersWithStats()` method. This enables profile pages to display featured cards alongside binder statistics.

### Enhanced DTO: `BinderWithStatsDTO`

Added comprehensive fields to support public binder listings:

```typescript
export interface BinderWithStatsDTO {
  _id: string;
  userId: string;
  name: string;
  description?: string | null;      // Added 2026-01-12
  tags?: string[];                   // Added 2026-01-12
  slug?: string | null;              // Added 2026-01-12
  isOnHand?: boolean;                // Added 2026-01-12
  isPublic: boolean;
  visibility?: VisibilityDTO;
  updatedAt?: Date;                  // Added 2026-01-12
  showcaseCards?: Array<{            // Added 2026-01-12
    printingId: string;
    tcg_low: number;
    rarity: string;
  }>;
  stats?: {
    totalQuantity: number;
    quantityForTrade: number;
    quantityNotForTrade: number;
    totalValue: { tcg_market, tcg_low, tcg_mid, tcg_high },
    valueForTrade: { tcg_market, tcg_low, tcg_mid, tcg_high },
    valueNotForTrade: { tcg_market, tcg_low, tcg_mid, tcg_high },
    rarityCounts: Record<string, number>,
    rarityCountsForTrade: Record<string, number>,
    rarityCountsNotForTrade: Record<string, number>
  };
}
```

### Usage Example

```typescript
import { binderService } from '@/lib/services';

// Get user's binders with full stats and showcase cards
const result = await binderService.getUserBindersWithStats(userId);

if (result.success) {
  result.data.forEach(binder => {
    console.log(`${binder.name}: ${binder.stats?.totalQuantity} cards`);

    if (binder.showcaseCards) {
      console.log(`  Featured: ${binder.showcaseCards.length} showcase cards`);
    }
  });
}
```

### Implementation Details

- **MongoDB Number Conversion**: Handles `$numberDouble` format in showcaseCards
- **Single Query**: All data fetched in one database call
- **Performance**: No additional queries for showcase cards
- **Backward Compatible**: Showcase cards optional, doesn't break existing code

### Routes Using This Enhancement

- `/api/users/[userId]/binders?includeStats=true&includeShowcase=true` - Profile page binder listings
- Used by: `app/profile/[username]/page.tsx`

See: `app/api/users/[userId]/binders/CLAUDE.md` for full documentation.

## ❌ DEPRECATED: Denormalization Service (PostgreSQL Only)

**Status**: Not needed in PostgreSQL migration
**Reason**: PostgreSQL JOINs are fast - keep data normalized

The `denormalizationService` was essential in MongoDB because:
- MongoDB's `$lookup` is slower than SQL JOINs
- Denormalized fields improved query performance (e.g., storing `binderAllowWhoHas` on inventory items)

### Why PostgreSQL Doesn't Need This

**Performance testing results** (40k inventory items):
- Simple JOIN: **4.8ms**
- 3-way JOIN (inventory + printings + cards + binders): **2.3ms**
- Full scan with JOIN filter: **33.6ms**

With proper indexes, PostgreSQL handles JOINs efficiently. Keep data normalized:

```sql
-- CORRECT: Join when needed
SELECT i.*, b.name, b.allow_who_has
FROM inventory_items i
JOIN binders b ON i.binder_id = b.id
WHERE b.allow_who_has = true;

-- NO NEED to denormalize allow_who_has onto inventory_items
```

### What Was Denormalized (MongoDB)
- **Binder → Inventory**: `binderAllowWhoHas`, `binderIsPublic`, `binderName`, etc.
- **User → Wants**: `username`, `userCountry`, `userState`
- **Printing → Wants**: Prices, names, images (20+ fields)

### PostgreSQL Approach
- **Prices**: Always JOIN with `printings` table (single source of truth)
- **User info**: JOIN with `users` table when needed
- **Binder info**: JOIN with `binders` table when needed

**Result**: Simpler code, no sync operations, always up-to-date data.

## Testing

Use `ServiceFactory.set*Service()` methods to inject mocks:

```typescript
ServiceFactory.setUserService(mockUserService);
ServiceFactory.setMetadataService(mockMetadataService);
```

## Files to Reference

- `contracts/common.ts` - Base types (AsyncResult, etc.)
- `contracts/IMetadataService.ts` - Metadata service contract with DTOs
- `index.ts` - Service exports and factory
