# Binder Statistics

This directory contains binder statistics calculation logic.

## Migration Status

`binderStats.ts` has been migrated to use `binderStatsService` from the service layer. The file now contains backwards-compatible wrapper functions that delegate to the service.

## Key Concepts

### Dirty Flag Pattern
Binders are marked `statsNeedUpdate: true` when inventory changes. A background job processes dirty binders in batches.

### High-Value Rarities
Cards with rarity M (Majestic), L (Legendary), F (Fabled), or V (Marvel) trigger immediate stats recalculation.

### Client-Side Aggregation
Stats are calculated client-side (not MongoDB aggregation pipelines) - tested 50% faster.

## Usage

```typescript
// Preferred - use service directly
import { binderStatsService } from '@/lib/services';
await binderStatsService.triggerUpdate(binderId, { force: true });

// Legacy - still works but deprecated
import { triggerBinderStatsUpdate } from '@/lib/stats/binderStats';
await triggerBinderStatsUpdate(binderId, db, { force: true });
```

## See Also

- `lib/services/mongodb/stats/MongoBinderStatsService.ts` - Implementation
- `lib/services/contracts/IBinderStatsService.ts` - Contract/DTOs
