# Binder API Endpoints - Service Architecture

**Last Updated**: 2026-01-09

## Overview

The binder API endpoints provide full CRUD operations for managing user's card binders. All endpoints have been **fully migrated to the service layer architecture**, ensuring database-agnostic, testable, and maintainable code.

---

## Directory Structure

```
app/api/binders/
├── CLAUDE.md                           # This file - architecture documentation
├── route.ts                            # ✅ List/create binders (uses binderService)
├── [binderId]/
│   ├── CLAUDE.md                       # Single binder operations documentation
│   ├── route.ts                        # ✅ Get/update/delete binder (uses binderService + userService)
│   ├── bulk-update/
│   │   └── route.ts                    # ✅ Bulk update cards (uses binderService)
│   ├── copy/
│   │   └── route.ts                    # ✅ Copy binder (uses binderService)
│   ├── cards/
│   │   └── [cardId]/route.ts           # Card CRUD operations
│   └── export/
│       └── route.ts                    # Export binder data
├── user/
│   └── route.ts                        # Get user's binders
├── transfer/
│   └── route.ts                        # Transfer cards between binders
└── transfer-selected/
    └── route.ts                        # Transfer selected cards
```

---

## Service Layer Status

| Endpoint | Status | Service Methods Used |
|----------|--------|---------------------|
| `GET /api/binders` | ✅ Migrated | `binderService.listUserBinders()` |
| `POST /api/binders` | ✅ Migrated | `binderService.createBinder()` |
| `GET /api/binders/[binderId]` | ✅ Migrated | `binderService.getBinder()`, `userService.getBasicInfo()` |
| `PUT /api/binders/[binderId]` | ✅ Migrated | `binderService.updateBinder()` |
| `DELETE /api/binders/[binderId]` | ✅ Migrated | `binderService.deleteBinder()` |
| `PATCH /api/binders/[binderId]/bulk-update` | ✅ Migrated | `binderService.bulkUpdateCards()`, `binderService.findBinderByIdOrSlug()` |
| `POST /api/binders/[binderId]/copy` | ✅ Migrated | `binderService.copyBinder()`, `binderService.getBinder()`, `binderService.findBinderByIdOrSlug()` |

---

## Key Architecture Principles

### 1. No Direct Database Access
All routes use the service layer exclusively:

```typescript
// ✅ CORRECT - Service layer
import { binderService, userService } from '@/lib/services';
const result = await binderService.getBinder(binderId, userId);

// ❌ WRONG - Direct database access
import Binder from '@/models/Binder';
const binder = await Binder.findById(binderId);
```

### 2. Consistent Error Handling
All service methods return `AsyncResult<T>`:

```typescript
const result = await binderService.getBinder(binderId);
if (!result.success) {
  return NextResponse.json({ error: result.error }, { status: 500 });
}
const binder = result.data;
```

### 3. Multi-Authentication Support
All endpoints support hybrid authentication:

```typescript
import { authenticateRequest } from '@/lib/auth/multi-auth';
const authResult = await authenticateRequest(request, body);
```

Supports: Session auth, Discord bot tokens, MCP tokens, OAuth 2.1

---

## Migration Benefits

### Before Migration
```typescript
// ❌ Mixed direct DB and service calls
import connectToDatabase from '@/lib/mongodb';
import Binder from '@/models/Binder';
import InventoryItem from '@/models/InventoryItem';

const { db } = await connectToDatabase();
const owner = await db.collection('users').findOne({ _id: userId });
const binder = await Binder.findById(binderId);
const items = await InventoryItem.find({ binderId }).lean();
```

### After Migration
```typescript
// ✅ Pure service layer
import { binderService, userService } from '@/lib/services';

const ownerResult = await userService.getBasicInfo(userId);
const binderResult = await binderService.getBinder(binderId);
```

---

## Common Patterns

### Pattern 1: Get Binder with Owner Info
```typescript
// Get binder
const binderResult = await binderService.getBinder(binderId, requestingUserId);
if (!binderResult.success || !binderResult.data) {
  return NextResponse.json({ error: 'Binder not found' }, { status: 404 });
}

// Get owner info
const ownerResult = await userService.getBasicInfo(binderResult.data.userId);
const owner = ownerResult.success ? ownerResult.data : null;
```

### Pattern 2: Resolve Binder by ID or Slug
```typescript
// Handle both ObjectId and slug
let resolvedBinderId = binderId;
if (!Types.ObjectId.isValid(binderId)) {
  const binderResult = await binderService.findBinderByIdOrSlug(binderId, userId);
  if (!binderResult.success || !binderResult.data) {
    return NextResponse.json({ error: 'Binder not found' }, { status: 404 });
  }
  resolvedBinderId = binderResult.data._id;
}
```

### Pattern 3: Ownership Check + Update
```typescript
// Service handles ownership check internally
const result = await binderService.updateBinder(binderId, userId, updates);
if (!result.success) {
  const status = result.error?.includes('Access denied') ? 403 : 500;
  return NextResponse.json({ error: result.error }, { status });
}
```

---

## Stats Management

### How Stats Work
1. **Per-Binder Storage**: Stats stored in each binder document
2. **Dirty Flag Pattern**: Card changes mark binder with `statsNeedUpdate: true`
3. **Cron Job**: `/api/cron/update-binder-stats` processes 100 dirty binders per run
4. **Immediate Updates**: High-value cards (M/L/F/V) trigger instant recalculation

### Service Layer Handles Stats
```typescript
// ✅ Service marks binder for stats update
const result = await binderService.bulkUpdateCards(binderId, userId, 'forTrade', true);
// Service already set statsNeedUpdate: true internally

// ❌ DON'T manually calculate stats in routes
// Let the stats service handle it via cron job
```

---

## For SQL Migration

To migrate from MongoDB to SQL:

### 1. Implement SQL Services
```typescript
// lib/services/sql/SqlBinderService.ts
export class SqlBinderService implements IBinderService {
  async getBinder(binderId: string, userId?: string): AsyncResult<BinderDTO | null> {
    const binder = await sql`
      SELECT * FROM binders
      WHERE id = ${binderId}
      AND (is_public = true OR user_id = ${userId})
    `;
    return { success: true, data: binder[0] || null };
  }
  // ... other methods
}
```

### 2. Update Service Factory
```typescript
// lib/services/index.ts
static getBinderService(): IBinderService {
  return new SqlBinderService();  // Instead of MongoBinderService
}
```

### 3. Zero Route Changes! 🎉
All API routes continue to work without modification because they only depend on the `IBinderService` interface.

---

## Testing

### Unit Testing with Mocks
```typescript
import { binderService } from '@/lib/services';

jest.mock('@/lib/services', () => ({
  binderService: {
    getBinder: jest.fn(),
    updateBinder: jest.fn(),
  }
}));

test('GET /api/binders/[binderId]', async () => {
  (binderService.getBinder as jest.Mock).mockResolvedValue({
    success: true,
    data: { _id: '123', name: 'Test Binder' }
  });

  const response = await GET(mockRequest, { params: { binderId: '123' } });
  expect(response.status).toBe(200);
});
```

---

## Error Handling

### Standard Error Response Format
```typescript
// Success
{
  success: true,
  data: BinderDTO
}

// Error
{
  success: false,
  error: "Human-readable error message"
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Invalid request body
- `401` - Authentication required
- `403` - Access denied (not owner)
- `404` - Binder not found
- `500` - Internal server error

---

## Performance Considerations

### Binder Queries
- **Index Required**: `db.binders.createIndex({ userId: 1 })`
- **Typical Query Time**: ~5-10ms per binder lookup
- **Bulk Operations**: Processed in 20-item chunks

### Stats Calculation
- **Real-time**: High-value cards (M/L/F/V)
- **Deferred**: Low-value cards (processed by cron)
- **Cron Job**: Runs every X minutes, processes 100 dirty binders

---

## Related Documentation

- **Service Layer Overview**: `lib/services/CLAUDE.md`
- **Binder Service Contract**: `lib/services/contracts/IBinderService.ts`
- **Stats Service**: `lib/services/mongodb/stats/MongoBinderStatsService.ts`
- **Single Binder Operations**: `app/api/binders/[binderId]/CLAUDE.md`
- **Collection Endpoints**: `app/collection/CLAUDE.md`

---

## Key Takeaways

✅ **All binder endpoints use service layer**
✅ **Zero direct database access in routes**
✅ **Database-agnostic architecture**
✅ **Multi-auth support throughout**
✅ **Ready for SQL migration**
✅ **Stats managed by service layer**
✅ **Consistent error handling**
✅ **Easily testable with mocks**

---

**Questions?** Check the service layer documentation at `lib/services/CLAUDE.md`.
