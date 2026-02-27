# Denormalization

⚠️ **MONGODB ONLY** - This directory contains field synchronization logic for denormalized data in MongoDB.

**PostgreSQL does NOT need denormalization** - keep data normalized and use JOINs instead. Performance testing showed 2-5ms execution times on 40k+ rows with proper indexes.

## Migration Status

Both `binderDenormalization.ts` and `wantsDenormalization.ts` have been migrated to use `denormalizationService` from the service layer.

**Note**: This service is deprecated for PostgreSQL migrations. New PostgreSQL service implementations should use JOINs instead of denormalized fields.

## What is Denormalization?

For query performance, frequently-accessed parent fields are copied to child documents:

```
Binder (parent)           InventoryItem (child)
├── name                  ├── binderName (copied)
├── slug                  ├── binderSlug (copied)
├── visibility.allowWhoHas├── binderAllowWhoHas (copied)
└── isPublic              └── binderIsPublic (copied)
```

## IMPORTANT: Sync After Updates

When updating binder visibility or user profile, you MUST sync denormalized fields:

```typescript
import { denormalizationService } from '@/lib/services';

// After updating binder
await denormalizationService.syncInventoryWithBinder(binderId);

// After updating user
await denormalizationService.syncWantsWithUser(userId);
```

## Synced Fields

### Binder → InventoryItem
- `binderName`, `binderSlug`, `binderIsPublic`
- `binderAllowWhoHas`, `binderAllowInSearch`,

### User → WantsItem
- `username`, `discordUsername`, `country`

### Printing → WantsItem
- `name`, `display_name`, `rarity`, `image_url`, pricing fields
