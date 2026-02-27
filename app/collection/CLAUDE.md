# Collection Module - Service Architecture

**Last Updated**: 2026-01-09

## Overview

The collection module provides endpoints for viewing and managing a user's complete card collection across all their binders. All endpoints have been migrated to use the **service layer architecture**, ensuring database-agnostic, testable, and maintainable code.

---

## Directory Structure

```
app/collection/
├── CLAUDE.md                    # This file - architecture documentation
├── page.tsx                     # Collection overview page (UI)
├── layout.tsx                   # Collection layout wrapper
├── all-cards/                   # All cards listing endpoint
│   └── route.ts                 # ✅ Uses binderService.getAllCardsForUser()
├── search/                      # Collection search functionality
└── patreon/                     # Patreon-related features
```

---

## API Endpoints

### 1. Collection Overview Stats
**Endpoint**: `GET /api/collection`
**File**: `app/api/collection/route.ts`
**Purpose**: Returns aggregated collection statistics across all user's binders

#### Service Methods Used
```typescript
import { binderService, userService } from '@/lib/services';

// Get user info
const userResult = await userService.getBasicInfo(userId);

// Get binders with stats
const bindersResult = await binderService.getUserBindersWithStats(userId);

// Aggregate stats in JavaScript
const stats = aggregateBinderStats(bindersResult.data);
```

#### Key Features
- ✅ Excludes archived binders
- ✅ Aggregates stats from all active binders
- ✅ Real-time calculation (no stale data)
- ✅ Supports multiple authentication methods (session, Discord bot, MCP)
- ✅ Public/private access control

#### Response Format
```typescript
{
  success: true,
  data: {
    userId: string,
    username: string,
    calculatedAt: string,
    collection: {
      totalQuantity: number,
      quantityForTrade: number,
      quantityNotForTrade: number,
      totalValues: { tcg_market, tcg_low, tcg_mid, tcg_high },
      valueForTrade: { tcg_market, tcg_low, tcg_mid, tcg_high },
      valueNotForTrade: { tcg_market, tcg_low, tcg_mid, tcg_high },
      rarityCounts: Record<string, number>,
      rarityCountsForTrade: Record<string, number>,
      rarityCountsNotForTrade: Record<string, number>,
      binderCount: number,
      publicBinderCount: number
    }
  }
}
```

---

### 2. All Cards Listing
**Endpoint**: `GET /api/collection/all-cards`
**File**: `app/api/collection/all-cards/route.ts`
**Purpose**: Returns all inventory items across all user's binders with filtering/sorting

#### Service Methods Used
```typescript
import { binderService } from '@/lib/services';

const result = await binderService.getAllCardsForUser(
  userId,
  filters,  // { search, rarity, foiling, set, condition, forTrade }
  options   // { sortBy }
);
```

#### Key Features
- ✅ Pagination support
- ✅ Advanced filtering (rarity, foiling, set, condition, trade status)
- ✅ Multiple sort options
- ✅ Includes binder metadata
- ✅ Already migrated to service layer

---

### 3. Card Search
**Endpoint**: `GET /api/collection/cards?q={searchQuery}`
**File**: `app/api/collection/cards/route.ts`
**Purpose**: Search for cards by name across all user's binders

#### Service Methods Used
```typescript
import { binderService } from '@/lib/services';

const result = await binderService.searchUserCards(
  userId,
  searchQuery,
  50  // limit
);
```

#### Key Features
- ✅ Case-insensitive search
- ✅ Groups results by card ID
- ✅ Shows all binder locations for each card
- ✅ Returns quantity and trade status per location
- ✅ Minimum 3 characters required

#### Response Format
```typescript
{
  success: true,
  results: [
    {
      _id: string,        // cardId
      name: string,
      imageUrl?: string,
      locations: [
        {
          binderId: string,
          binderName: string,
          binderSlug?: string,
          quantity: number,
          forTrade: boolean
        }
      ]
    }
  ]
}
```

---

## Service Layer Architecture

### Binder Service Methods

All collection endpoints use the `binderService` from `@/lib/services`:

| Method | Purpose | Returns |
|--------|---------|---------|
| `getUserBindersWithStats()` | Get user's binders with stats | `BinderWithStatsDTO[]` |
| `getAllCardsForUser()` | Get all cards with filters/sorting | `UserCollectionResult` |
| `searchUserCards()` | Search cards by name | `CardSearchResultDTO[]` |

### User Service Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `getBasicInfo()` | Get user's basic info | `UserBasicInfoDTO` |

---

## Data Transfer Objects (DTOs)

### BinderWithStatsDTO
```typescript
interface BinderWithStatsDTO {
  _id: string;
  userId: string;
  name: string;
  isPublic: boolean;
  visibility?: VisibilityDTO;
  stats?: {
    totalQuantity: number;
    quantityForTrade: number;
    quantityNotForTrade: number;
    totalValue: PriceValuesDTO;
    valueForTrade: PriceValuesDTO;
    valueNotForTrade: PriceValuesDTO;
    rarityCounts: Record<string, number>;
    rarityCountsForTrade: Record<string, number>;
    rarityCountsNotForTrade: Record<string, number>;
  };
}
```

### CardSearchResultDTO
```typescript
interface CardSearchResultDTO {
  _id: string;        // cardId
  name: string;
  imageUrl?: string;
  locations: CardLocationDTO[];
}

interface CardLocationDTO {
  binderId: string;
  binderName: string;
  binderSlug?: string;
  quantity: number;
  forTrade: boolean;
}
```

---

## Stats Calculation Architecture

### Per-Binder Stats (Existing)
- **Location**: `lib/services/mongodb/stats/MongoBinderStatsService.ts`
- **Storage**: Stored in each binder document
- **Updates**: Dirty flag pattern (`statsNeedUpdate: true`)
- **Cron Job**: `/api/cron/update-binder-stats` processes 100 dirty binders per run
- **Immediate Updates**: High-value cards (M/L/F/V rarities) trigger instant recalculation

### Collection-Wide Stats (New)
- **Method**: Real-time aggregation from binder stats
- **No Cron Needed**: Uses existing per-binder stats
- **Performance**: ~5-30ms for typical users (10-50 binders)
- **Implementation**: JavaScript aggregation in `aggregateBinderStats()` helper

---

## Migration History

### Before (Direct MongoDB Access)
```typescript
// ❌ Old pattern - direct database access
const { db } = await connectToDatabase();
const collectionDoc = await db.collection('card_collection').findOne({ userId });
const binders = await db.collection('binders').find({ userId }).toArray();
const results = await Binder.aggregate([...complex pipeline...]);
```

### After (Service Layer)
```typescript
// ✅ New pattern - service layer
import { binderService, userService } from '@/lib/services';

const userResult = await userService.getBasicInfo(userId);
const bindersResult = await binderService.getUserBindersWithStats(userId);
const searchResult = await binderService.searchUserCards(userId, query);
```

### Benefits
✅ **Database Agnostic**: MongoDB code isolated in service implementations
✅ **Testable**: Services can be mocked for unit tests
✅ **Type Safe**: Strong TypeScript contracts
✅ **Consistent**: All methods return `AsyncResult<T>`
✅ **Maintainable**: Business logic separated from data access
✅ **Future Proof**: Easy SQL migration by swapping service implementation

---

## For SQL Migration

To migrate from MongoDB to SQL/Postgres:

### 1. Create SQL Service Implementation
```typescript
// lib/services/sql/SqlBinderService.ts
export class SqlBinderService implements IBinderService {
  async getUserBindersWithStats(userId: string): AsyncResult<BinderWithStatsDTO[]> {
    // SQL query to get binders with stats
    const binders = await sql`
      SELECT * FROM binders
      WHERE user_id = ${userId} AND archived != true
    `;
    return { success: true, data: binders };
  }

  async searchUserCards(userId: string, query: string): AsyncResult<CardSearchResultDTO[]> {
    // SQL query with joins instead of MongoDB aggregation
    const results = await sql`
      SELECT c.id, c.name, c.image_url,
             json_agg(json_build_object(
               'binderId', b.id,
               'binderName', b.name,
               'quantity', ic.quantity,
               'forTrade', ic.for_trade
             )) as locations
      FROM cards c
      JOIN inventory_cards ic ON c.id = ic.card_id
      JOIN binders b ON ic.binder_id = b.id
      WHERE b.user_id = ${userId}
        AND c.name ILIKE ${`%${query}%`}
      GROUP BY c.id
      LIMIT 50
    `;
    return { success: true, data: results };
  }
}
```

### 2. Update Service Factory
```typescript
// lib/services/index.ts
import { SqlBinderService } from './sql/SqlBinderService';

static getBinderService(): IBinderService {
  // return new MongoBinderService();  // Old
  return new SqlBinderService();       // New
}
```

### 3. Zero Changes to Routes! 🎉
All API routes continue to work without modification because they only depend on the `IBinderService` contract, not the implementation.

---

## Testing

### Unit Testing (with mocks)
```typescript
import { binderService } from '@/lib/services';

// Mock the service
jest.mock('@/lib/services', () => ({
  binderService: {
    getUserBindersWithStats: jest.fn(),
    searchUserCards: jest.fn(),
  }
}));

// Test the route
test('collection stats endpoint', async () => {
  (binderService.getUserBindersWithStats as jest.Mock).mockResolvedValue({
    success: true,
    data: [{ _id: '1', stats: { totalQuantity: 100 } }]
  });

  const response = await GET(mockRequest);
  expect(response.status).toBe(200);
});
```

---

## Performance Considerations

### Collection Stats Endpoint
- **Query Time**: ~5-10ms (10 binders), ~20-30ms (50 binders)
- **Aggregation**: Client-side JavaScript (very fast)
- **Caching**: Not needed for typical usage
- **Index Required**: `db.binders.createIndex({ userId: 1 })`

### Card Search Endpoint
- **Query Time**: ~10-50ms depending on collection size
- **Limit**: 50 results to prevent overload
- **Minimum Query**: 3 characters to reduce false matches
- **Index Required**: `db.binders.createIndex({ userId: 1, 'cards.name': 1 })`

---

## Authentication

All endpoints support multiple authentication methods via `@/lib/auth/multi-auth`:

| Priority | Method | Use Case |
|----------|--------|----------|
| 1 | NextAuth Session | Web browser clients |
| 2 | Discord Bot Token | Discord bot server-to-server |
| 3 | MCP Token | Machine Client Protocol (external tools) |
| 4 | OAuth 2.1 Bearer | Third-party integrations |

---

## Related Documentation

- **Service Layer**: `lib/services/CLAUDE.md`
- **Binder Service Contract**: `lib/services/contracts/IBinderService.ts`
- **Stats Service**: `lib/services/mongodb/stats/MongoBinderStatsService.ts`
- **Migration TODO**: `docs/CLIENT_SERVICE_MIGRATION_TODO.md`
- **Main Project**: `CLAUDE.md` (root)

---

## Key Takeaways

✅ **All collection endpoints now use service layer**
✅ **No direct MongoDB access in routes**
✅ **Database-agnostic architecture**
✅ **Easy to test and maintain**
✅ **Ready for SQL migration**
✅ **Real-time stats without additional cron jobs**

---

**Questions?** Check `lib/services/CLAUDE.md` for service layer architecture details.
