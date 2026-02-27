# MongoDB Service Implementations

⚠️ **DEPRECATED - REFERENCE ONLY** - This directory contains MongoDB/Mongoose implementations kept as reference code.

**Status**: MongoDB is fully deprecated and non-functional. PostgreSQL is the only active database.

**Why kept?**: These files remain in the codebase as reference in case we ever need to migrate back to MongoDB for any reason. They are NOT used in production and do NOT function as a fallback.

**Migration Status**: See `lib/services/CLAUDE.md` for PostgreSQL migration progress.
- **7 services migrated** to PostgreSQL (user, binder, inventory, wants, printings, deck, article)
- **6 services deprecated** (metadata, trade matching, denormalization, featured cards)
- **5 services remaining** for migration

**For new development**: Use PostgreSQL implementations in `lib/services/postgres/` exclusively.

## Directory Structure

Each service has its own subdirectory:
```
mongodb/
├── user/MongoUserService.ts
├── binder/MongoBinderService.ts
├── inventory/MongoInventoryService.ts
├── wants/MongoWantsService.ts
├── printings/MongoPrintingsService.ts
├── printings-core/MongoPrintingsCoreService.ts
├── deck/MongoDeckService.ts
├── notification/MongoNotificationService.ts
├── stats/MongoBinderStatsService.ts
├── leaderboard/MongoLeaderboardService.ts
├── trade/MongoTradeService.ts
├── escrow/MongoEscrowService.ts
├── store/MongoStoreManagerService.ts
├── denormalization/MongoDenormalizationService.ts
├── geo/MongoGeoService.ts
└── auth/AuthService.ts (database-agnostic)
```

## Common Patterns

### Database Connection
```typescript
private async getDb() {
  const { db } = await connectToDatabase();
  return db;
}
```

### ACID Transactions (trade/escrow)
```typescript
const session = await mongoose.startSession();
session.startTransaction();
try {
  // operations with { session }
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  await session.endSession();
}
```

### Error Handling
Always wrap in try/catch, return `{ success: false, error: message }` on failure.

## IMPORTANT: Transaction Services

`MongoTradeService` and `MongoEscrowService` use ACID transactions. DO NOT modify transaction logic without understanding MongoDB session semantics.
