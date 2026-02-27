# PostgreSQL Service Implementations

This directory contains PostgreSQL/Drizzle ORM implementations of service contracts.

**Status**: PostgreSQL is the only active database. MongoDB is fully deprecated.

**Migration Progress**: 10/10 services migrated (100% COMPLETE ✅). See `lib/services/CLAUDE.md` for full details.

## Directory Structure

```
postgres/
├── user/PostgresUserService.ts              ✅ Migrated
├── binder/PostgresBinderService.ts          ✅ Migrated (includes stats calculation)
├── inventory/PostgresInventoryService.ts    ✅ Migrated
├── wants/PostgresWantsService.ts            ✅ Migrated
├── printings/PostgresPrintingsService.ts    ✅ Migrated
├── deck/PostgresDeckService.ts              ✅ Migrated
├── article/PostgresArticleService.ts        ✅ Migrated
├── auth-token/PostgresAuthTokenService.ts   ✅ Migrated
├── oauth/PostgresOAuthService.ts            ✅ Migrated
└── oauth-flow/PostgresOAuthFlowService.ts   ✅ Migrated
```

## Common Patterns

### Database Connection
```typescript
import { db } from '@/lib/postgres/db';
import { users, binders, inventoryItems } from '@/lib/postgres/schema';
```

### Simple Query
```typescript
const user = await db.select().from(users).where(eq(users.id, userId));
```

### JOIN Query (Preferred over Denormalization)
```typescript
const items = await db
  .select({
    id: inventoryItems.id,
    printingId: inventoryItems.printingId,
    binderName: binders.name,
    cardName: cards.name,
  })
  .from(inventoryItems)
  .leftJoin(binders, eq(inventoryItems.binderId, binders.id))
  .leftJoin(printings, eq(inventoryItems.printingId, printings.printingId))
  .leftJoin(cards, eq(printings.cardUniqueId, cards.cardUniqueId))
  .where(eq(inventoryItems.binderId, binderId));
```

### Transactions
```typescript
await db.transaction(async (tx) => {
  await tx.insert(users).values(userData);
  await tx.insert(binders).values(binderData);
  // Both succeed or both fail
});
```

### Error Handling
Always wrap in try/catch, return `{ success: false, error: message }` on failure.

## Key Principles

### ✅ Use JOINs, Not Denormalization

**MongoDB pattern (deprecated)**:
```typescript
// Stored binderName on each inventory item
inventoryItem.binderName = binder.name;
```

**PostgreSQL pattern (correct)**:
```typescript
// JOIN on the fly (2-5ms execution time)
.leftJoin(binders, eq(inventoryItems.binderId, binders.id))
```

**Performance**: Testing showed 2-5ms execution times on 40k+ rows with proper indexes.

### ✅ Normalized Schema

- **Single source of truth** - no redundant data
- **No sync operations** - data is always current
- **Simpler code** - no denormalization service calls

### ✅ Type-Safe Queries

Drizzle ORM provides full TypeScript inference:
```typescript
const result = await db.select().from(users).where(eq(users.id, userId));
// result is typed as User[] automatically
```

### ✅ JSONB for Flexible Schema

Use JSONB columns for dynamic/flexible data:
```typescript
// Article sections (7 different types)
sections: jsonb('sections').$type<ArticleSectionDTO[]>()

// Deck metadata
metadata: jsonb('metadata')
```

## Migration Checklist

When migrating a service from MongoDB to PostgreSQL:

1. ✅ **Review schema** - Ensure PostgreSQL schema exists in `lib/postgres/schema.ts`
2. ✅ **Remove denormalization** - Don't copy denormalized fields
3. ✅ **Use JOINs** - Replace denormalized data with JOIN queries
4. ✅ **JSONB for flexibility** - Use JSONB columns for dynamic data (not TEXT)
5. ✅ **Calculate stats on-demand** - Use SQL aggregates instead of cached values
6. ✅ **Test performance** - Verify JOINs execute in <50ms
7. ✅ **Update service factory** - Add database provider switching in `lib/services/index.ts`
8. ✅ **Update documentation** - Mark service as migrated in `lib/services/CLAUDE.md`

## Performance Best Practices

### Indexes
Ensure proper indexes exist on foreign keys:
```sql
CREATE INDEX idx_inventory_binder_id ON inventory_items(binder_id);
CREATE INDEX idx_inventory_printing_id ON inventory_items(printing_id);
```

### Aggregations
Use SQL aggregates for statistics:
```typescript
const [stats] = await db.select({
  totalCards: sql<number>`COUNT(*)::int`,
  totalValue: sql<number>`SUM(quantity * tcg_market)::real`,
})
.from(inventoryItems)
.leftJoin(printings, eq(inventoryItems.printingId, printings.printingId))
.where(eq(inventoryItems.binderId, binderId));
```

### Pagination
Use LIMIT/OFFSET for large result sets:
```typescript
const items = await db.select()
  .from(inventoryItems)
  .limit(50)
  .offset(page * 50);
```
