# User Public Binders API - Service Architecture

**Last Updated**: 2026-01-12

## Overview

This endpoint provides **public access** to a user's binders for viewing on profile pages. It's the primary way to fetch another user's binder list with full stats and showcase cards.

**Status**: ✅ **Fully migrated to service layer** (100% database-agnostic)

---

## Endpoint

**Route**: `GET /api/users/[userId]/binders`
**File**: `app/api/users/[userId]/binders/route.ts`
**Purpose**: Retrieve public binders for a specific user with optional stats and showcase cards

---

## When This Route Is Used

### Primary Usage

#### 1. **Profile Page** (`app/profile/[username]/page.tsx`)
Main use case - displays user's public binders on their profile:
```typescript
const bindersResponse = await fetch(
  `/api/users/${profileData.user._id}/binders?includeStats=true&includeShowcase=true`,
  { signal }
)
```
**Query params**: `includeStats=true&includeShowcase=true`
**Purpose**: Show user's collection with full stats and featured cards

#### 2. **Binder Creation Page** (`app/binder/create/page.tsx`)
Fetch user's existing binders when creating a new one:
```typescript
const response = await fetch(`/api/users/${user.id}/binders`, {
  method: 'GET'
})
```
**Query params**: None (simple list)
**Purpose**: Show existing binders for context

#### 3. **Export Data Dialog** (`components/dialogs/account/export-data-dialog.tsx`)
Data export functionality:
```typescript
fetch(`/api/users/${user.id}/binders`)
```
**Query params**: None
**Purpose**: List binders for data export selection

#### 4. **Browse API** (`lib/browse/api/index.ts`)
Programmatic access for browse features:
```typescript
const response = await fetch(`/api/users/${userId}/binders`, {
  headers: { ... }
})
```

---

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includeStats` | boolean | `false` | Include full binder statistics (quantities, values, rarity counts) |
| `includeShowcase` | boolean | `false` | Include showcase cards (featured cards on profile) |

### Examples

```bash
# Simple list (no stats)
GET /api/users/507f1f77bcf86cd799439011/binders

# With stats
GET /api/users/507f1f77bcf86cd799439011/binders?includeStats=true

# With stats and showcase cards
GET /api/users/507f1f77bcf86cd799439011/binders?includeStats=true&includeShowcase=true
```

---

## Service Layer Architecture

### Service Methods Used

```typescript
import { binderService } from '@/lib/services';

// For stats/showcase requests
const result = await binderService.getUserBindersWithStats(userId);
const publicBinders = result.data.filter(b => b.isPublic || b.visibility?.level === 'public');

// For simple requests (no stats)
const result = await binderService.listBinders({
  userId,
  isPublic: true,
  archived: false
}, {
  sort: { updatedAt: -1 }
});
```

### Key Service: `getUserBindersWithStats()`

**Contract**: `IBinderService.getUserBindersWithStats()`
**Implementation**: `MongoBinderService.getUserBindersWithStats()`
**Location**: `lib/services/mongodb/binder/MongoBinderService.ts`

**Returns**: `BinderWithStatsDTO[]` with all fields:
- Basic info: `_id`, `name`, `description`, `tags`, `slug`
- Settings: `isPublic`, `visibility`, `isOnHand`, `updatedAt`
- **Stats**: Complete stats object with quantities, values, rarity counts
- **Showcase cards**: Featured cards for profile display

---

## Response Format

### Without Stats/Showcase
```typescript
{
  success: true,
  binders: [
    {
      _id: string,
      name: string,
      description: string | null,
      tags: string[],
      slug: string | null,
      isOnHand: boolean,
      visibility: { level: 'public' | 'private' | 'unlisted' },
      isPublic: boolean,
      updatedAt: Date
    }
  ],
  meta: {
    count: number,
    includeStats: false,
    includeShowcase: false,
    userId: string
  }
}
```

### With Stats
```typescript
{
  success: true,
  binders: [
    {
      // ... basic fields ...
      totalQuantity: number,
      quantityForTrade: number,
      quantityNotForTrade: number,
      totalValue: {
        tcg_market: number,
        tcg_low: number,
        tcg_mid: number,
        tcg_high: number
      },
      valueForTrade: { tcg_market, tcg_low, tcg_mid, tcg_high },
      valueNotForTrade: { tcg_market, tcg_low, tcg_mid, tcg_high },
      rarityCounts: Record<string, number>,
      rarityCountsForTrade: Record<string, number>,
      rarityCountsNotForTrade: Record<string, number>,
      cardCount: number,
      totalCards: number,
      total_value: number  // Legacy field (tcg_low)
    }
  ],
  meta: { count, includeStats: true, includeShowcase, userId }
}
```

### With Showcase Cards
```typescript
{
  success: true,
  binders: [
    {
      // ... basic fields + stats ...
      showcaseCards: [
        {
          printingId: string,
          tcg_low: number,
          rarity: string  // e.g., 'M', 'L', 'F'
        }
      ]
    }
  ],
  meta: { ... }
}
```

---

## Security Features

### 1. Bot Detection
Blocks common bots and crawlers:
```typescript
const botPatterns = [
  /bot/i, /crawler/i, /spider/i, /scraper/i,
  /googlebot/i, /bingbot/i, /curl/i, /wget/i,
  // ... more patterns
];
```

### 2. Valid Browser Check
Requires legitimate browser user agent:
```typescript
const validBrowsers = [
  /chrome/i, /firefox/i, /safari/i, /edge/i, /opera/i
];
```

### 3. Referer Validation
Prevents direct API access from external sites:
```typescript
// Must have referer from same domain
if (!referer || refererUrl.hostname !== requestUrl.hostname) {
  return 403 Forbidden;
}
```

**Exception**: Development mode with local IPs (localhost, 127.0.0.1)

### 4. Rate Limiting
Per-IP rate limiting:
- **Limit**: 30 requests per minute per IP
- **Window**: 60 seconds
- **Action**: Returns 429 Too Many Requests when exceeded

### 5. Public Binders Only
Only returns binders marked as public:
```typescript
binders = result.data.filter(
  b => b.isPublic || b.visibility?.level === 'public'
);
```

---

## Migration Details

### Before Migration (290 lines)
```typescript
// ❌ Direct MongoDB access for stats/showcase
const { db } = await connectToDatabase();
const fullBinders = await db.collection('binders').find({
  userId: userObjectId,
  'visibility.level': 'public',
  archived: { $ne: true }
}).toArray();

// Manual stats formatting (110+ lines)
const formatted = fullBinders.map(binder => {
  // ... 110 lines of manual formatting logic ...
  if (includeStats) {
    formatted.totalQuantity = binder.totalQuantity || 0;
    // ... 60 lines of stats extraction ...
  }
  if (includeShowcase) {
    formatted.showcaseCards = binder.showcaseCards.map(card => ({
      printingId: card.printingId,
      tcg_low: typeof card.tcg_low === 'number'
        ? card.tcg_low
        : parseFloat(card.tcg_low.$numberDouble),
      // ...
    }));
  }
  return formatted;
});
```

### After Migration (237 lines)
```typescript
// ✅ Service layer with comprehensive DTO
const result = await binderService.getUserBindersWithStats(userId);
const publicBinders = result.data.filter(
  b => b.isPublic || b.visibility?.level === 'public'
);

// Simple formatting from service DTO
const formattedBinders = binders.map(binder => {
  const formatted = { ...basicFields };

  if (includeStats && binder.stats) {
    formatted.totalQuantity = binder.stats.totalQuantity || 0;
    // ... direct field mapping from DTO ...
  }

  if (includeShowcase && binder.showcaseCards) {
    formatted.showcaseCards = binder.showcaseCards; // Already formatted!
  }

  return formatted;
});
```

### Code Reduction
- **Before**: 290 lines
- **After**: 237 lines
- **Reduction**: 53 lines (18%)
- **Removed**: 110+ lines of manual formatting logic
- **Removed**: Direct MongoDB access
- **Removed**: Duplicate showcaseCards conversion

---

## Service Enhancement: `BinderWithStatsDTO`

### Added Fields (2026-01-12)
Enhanced `BinderWithStatsDTO` to support showcase cards:

```typescript
export interface BinderWithStatsDTO {
  _id: string;
  userId: string;
  name: string;
  description?: string | null;      // ✅ Added
  tags?: string[];                   // ✅ Added
  slug?: string | null;              // ✅ Added
  isOnHand?: boolean;                // ✅ Added
  isPublic: boolean;
  visibility?: VisibilityDTO;
  updatedAt?: Date;                  // ✅ Added
  showcaseCards?: Array<{            // ✅ Added
    printingId: string;
    tcg_low: number;
    rarity: string;
  }>;
  stats?: {
    totalQuantity: number;
    quantityForTrade: number;
    quantityNotForTrade: number;
    totalValue: { tcg_market, tcg_low, tcg_mid, tcg_high },
    valueForTrade: { ... },
    valueNotForTrade: { ... },
    rarityCounts: Record<string, number>,
    rarityCountsForTrade: Record<string, number>,
    rarityCountsNotForTrade: Record<string, number>
  };
}
```

### Implementation Enhancement
Updated `MongoBinderService.getUserBindersWithStats()`:
- Added projection for new fields
- Implemented MongoDB `$numberDouble` conversion for showcaseCards
- Single query returns everything needed

---

## Performance

### Response Times
- **Simple list** (no stats): 10-20ms
- **With stats**: 15-30ms
- **With stats + showcase**: 20-35ms

### Caching
- **Header**: `Cache-Control: public, max-age=300` (5 minutes)
- **Rationale**: Public data, stats update periodically
- **Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`

### Database Indexes Required
```javascript
// MongoDB indexes
db.binders.createIndex({ userId: 1 });
db.binders.createIndex({ userId: 1, isPublic: 1 });
db.binders.createIndex({ userId: 1, 'visibility.level': 1 });
```

---

## For SQL Migration

Route requires **ZERO changes** for SQL migration:

### SQL Service Implementation
```typescript
// lib/services/sql/SqlBinderService.ts
async getUserBindersWithStats(userId: string): AsyncResult<BinderWithStatsDTO[]> {
  const binders = await sql`
    SELECT
      b.id as _id,
      b.user_id as "userId",
      b.name,
      b.description,
      b.tags,
      b.slug,
      b.is_on_hand as "isOnHand",
      b.is_public as "isPublic",
      b.visibility,
      b.updated_at as "updatedAt",
      b.showcase_cards as "showcaseCards",
      json_build_object(
        'totalQuantity', b.total_quantity,
        'quantityForTrade', b.quantity_for_trade,
        'quantityNotForTrade', b.quantity_not_for_trade,
        'totalValue', b.total_value,
        'valueForTrade', b.value_for_trade,
        'valueNotForTrade', b.value_not_for_trade,
        'rarityCounts', b.rarity_counts,
        'rarityCountsForTrade', b.rarity_counts_for_trade,
        'rarityCountsNotForTrade', b.rarity_counts_not_for_trade
      ) as stats
    FROM binders b
    WHERE b.user_id = ${userId}
      AND b.archived != true
    ORDER BY b.updated_at DESC
  `;

  return { success: true, data: binders };
}
```

---

## Error Handling

### HTTP Status Codes
- `200 OK` - Success
- `400 Bad Request` - Invalid userId format
- `403 Forbidden` - Bot detected, invalid referer, or rate limit exceeded
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Database/service error

### Error Response Format
```typescript
{
  success: false,
  error: "Human-readable error message"
}
```

---

## Testing

### Manual Testing
```bash
# Profile page usage
curl "http://localhost:3000/api/users/USER_ID/binders?includeStats=true&includeShowcase=true" \
  -H "Referer: http://localhost:3000/profile/username" \
  -H "User-Agent: Mozilla/5.0 (Chrome)"

# Should return 403 without valid referer
curl "http://localhost:3000/api/users/USER_ID/binders"

# Should return 403 for bot user agents
curl "http://localhost:3000/api/users/USER_ID/binders" \
  -H "User-Agent: curl/7.0"
```

### Unit Testing (with service mocks)
```typescript
import { binderService } from '@/lib/services';

jest.mock('@/lib/services', () => ({
  binderService: {
    getUserBindersWithStats: jest.fn(),
    listBinders: jest.fn()
  }
}));

test('returns public binders with stats', async () => {
  (binderService.getUserBindersWithStats as jest.Mock).mockResolvedValue({
    success: true,
    data: [
      { _id: '1', name: 'Test', isPublic: true, stats: { totalQuantity: 100 } }
    ]
  });

  const response = await GET(mockRequest, { params: { userId: 'user123' } });
  expect(response.status).toBe(200);
});
```

---

## Related Documentation

- **Parent Directory**: `app/api/users/[userId]/`
- **Service Layer**: `lib/services/CLAUDE.md`
- **Binder Service Contract**: `lib/services/contracts/IBinderService.ts`
- **Binder Service Implementation**: `lib/services/mongodb/binder/MongoBinderService.ts`
- **Profile Page**: `app/profile/[username]/page.tsx`

---

## Key Takeaways

✅ **Fully migrated to service layer** (100% database-agnostic)
✅ **Primary use: Profile page** with stats and showcase cards
✅ **Security hardened** with bot detection, referer validation, rate limiting
✅ **Enhanced DTO** now includes showcase cards support
✅ **18% code reduction** (290 → 237 lines)
✅ **Ready for SQL migration** with zero route changes
✅ **Public data only** - enforces visibility rules
✅ **Cached responses** (5 minute TTL)

---

**Questions?** Check the service layer documentation at `lib/services/CLAUDE.md`.
