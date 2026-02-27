# Client Services

Client-side API abstraction layer for FaB Bazaar frontend components.

## Quick Start

```typescript
import { bindersClient, wantsClient, decksClient } from '@/lib/client';

// Get binder cards with filters
const result = await bindersClient.getBinderCards(
  binderId,
  { search: 'command', rarity: 'M' },
  { page: 1, limit: 48, sortBy: 'name' }
);

if (result.success) {
  console.log(result.data.cards); // Array of cards
  console.log(result.data.pagination); // Pagination info
} else {
  console.error(result.error); // Error message
}
```

## Why Use Client Services?

### Problem: Scattered fetch() calls

Components currently make direct API calls with duplicated logic:

```typescript
// This pattern appears in 79 different files! ❌
const response = await fetch(`/api/binders/${binderId}/cards?${params}`);
if (!response.ok) throw new Error('Failed');
const data = await response.json();
```

### Solution: Centralized client services

One service handles all API logic:

```typescript
// Used everywhere ✅
const result = await bindersClient.getBinderCards(binderId, filters, options);
```

**Benefits:**
- ✅ No code duplication
- ✅ Consistent error handling
- ✅ Full TypeScript safety
- ✅ Easy to test
- ✅ Easy to add features (caching, auth headers, retry logic)

## Available Services

### Binders Client (`bindersClient`)

Manage card collections and binders.

```typescript
import { bindersClient } from '@/lib/client';

// Get user's binders
const binders = await bindersClient.getUserBinders();

// Get binder cards with filters and pagination
const cards = await bindersClient.getBinderCards(
  binderId,
  { search: 'ninja', rarity: 'M', forTrade: true },
  { page: 1, limit: 48, sortBy: 'tcg-market-desc' }
);

// Add cards to binder
const result = await bindersClient.addCardsToBinder(binderId, [
  { printingId: 'abc123', quantity: 2, forTrade: true }
]);

// Update a card
const updated = await bindersClient.updateBinderCard(
  binderId,
  cardId,
  { quantity: 3, forTrade: false }
);

// Delete a card
await bindersClient.deleteBinderCard(binderId, cardId);
```

**Methods:**
- `getBinder(binderId)` - Get single binder
- `getUserBinders()` - List user's binders
- `createBinder(data)` - Create new binder
- `updateBinder(binderId, updates)` - Update binder
- `deleteBinder(binderId)` - Delete binder
- `getBinderCards(binderId, filters, options)` - Get cards with pagination
- `getBinderCard(binderId, cardId)` - Get single card by ID
- `addCardsToBinder(binderId, cards)` - Add cards
- `updateBinderCard(binderId, cardId, updates)` - Update card
- `swapCardPrinting(binderId, cardId, newPrintingId)` - Swap printing
- `deleteBinderCard(binderId, cardId)` - Delete card
- `bulkUpdateCards(binderId, field, value, cardIds?)` - Bulk update
- `transferAllCards(sourceId, targetId)` - Transfer all
- `transferSelectedCards(sourceId, targetId, cards)` - Transfer selected
- `copyBinder(binderId, newName, options)` - Copy binder
- `exportBinderCards(binderId)` - Export for download

### Wants Client (`wantsClient`)

Manage want lists.

```typescript
import { wantsClient } from '@/lib/client';

// Get user's wants
const wants = await wantsClient.getUserWants(
  { priority: 'high' },
  { page: 1, limit: 50 }
);

// Add to wants
await wantsClient.addWantsItem('printingId123', 2, 'high');

// Update wants item
await wantsClient.updateWantsItem(wantsItemId, {
  quantity: 3,
  priority: 'medium'
});

// Remove from wants
await wantsClient.removeWantsItem('printingId123', true);
```

**Methods:**
- `getUserWants(filters?, options?)` - Get user's wants
- `getWantsForUser(userId, filters?, options?)` - Get another user's wants
- `addWantsItem(printingId, quantity?, priority?)` - Add to wants
- `updateWantsItem(wantsItemId, updates)` - Update item
- `removeWantsItem(printingId, removeAll?)` - Remove item
- `bulkAddWants(items)` - Bulk import
- `exportWants()` - Export wants
- `getWantsStats()` - Get statistics

### Decks Client (`decksClient`)

Manage deck builds.

```typescript
import { decksClient } from '@/lib/client';

// Get user's decks
const decks = await decksClient.getUserDecks(
  { format: 'Blitz' },
  { page: 1, limit: 20 }
);

// Get single deck
const deck = await decksClient.getDeck(publicId);

// Create deck
const newDeck = await decksClient.createDeck({
  name: 'Iyslander Control',
  format: 'Classic Constructed',
  heroName: 'Iyslander'
});

// Add card to deck
await decksClient.addPrinting(publicId, {
  printingId: 'abc123',
  quantity: 3,
  category: 'maindeck'
});

// Compare deck vs inventory
const comparison = await decksClient.getInventoryComparison(publicId, {
  binderMode: 'all'
});
```

**Methods:**
- `getUserDecks(filters?, pagination?)` - List decks
- `getDeck(publicId)` - Get single deck
- `createDeck(data)` - Create deck
- `updateDeck(publicId, updates)` - Update deck
- `deleteDeck(publicId)` - Delete deck
- `addPrinting(publicId, printing)` - Add card
- `addPrintings(publicId, printings)` - Bulk add
- `removePrinting(publicId, printingId, category)` - Remove card
- `swapPrinting(publicId, oldId, newId, category)` - Swap printing
- `getInventoryComparison(publicId, options?)` - Compare vs inventory
- `calculateStats(publicId)` - Calculate stats
- `importFromFabrary(fabraryUrl)` - Import from Fabrary

### Search Client (`searchClient`)

Search and browse cards.

```typescript
import { searchClient } from '@/lib/client';

// Search printings
const results = await searchClient.searchPrintings(
  { name: 'command', class: 'ninja', rarity: 'M' },
  { page: 1, limit: 48, sortBy: 'name' }
);

// Get single printing
const printing = await searchClient.getPrintingById('printingId123');

// Get all printings of a card
const alternatives = await searchClient.getCardPrintings('WTR001');
```

**Methods:**
- `searchPrintings(filters, options)` - Search printings
- `browsePrintings(filters, options)` - Browse with pagination
- `bulkSearchPrintings(printingIds)` - Bulk lookup
- `getFilterValues()` - Get filter options
- `getPrintingById(printingId)` - Get single printing
- `getCardPrintings(cardUniqueId)` - Get all printings

### Users Client (`usersClient`)

User profiles and trade analysis.

```typescript
import { usersClient } from '@/lib/client';

// Get current user
const user = await usersClient.getCurrentUser();

// Get trade analysis
const analysis = await usersClient.getTradeAnalysis(targetUserId);

// Update profile
await usersClient.updateProfile({
  country: 'US',
  state: 'CA'
});
```

**Methods:**
- `getCurrentUser()` - Get current user
- `getUserProfile(userId)` - Get another user
- `updateProfile(updates)` - Update profile
- `findUser(query)` - Search users
- `getTradeAnalysis(targetUserId)` - Trade compatibility
- `getMatchRate(targetUserId)` - Match percentage
- `updateDiscordInfo(discordData)` - Update Discord
- `completeProfile(data)` - Complete profile
- `deleteAccount()` - Delete account

## Response Format

All methods return `ApiResponse<T>`:

```typescript
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
```

**Always check `success` before using `data`:**

```typescript
const result = await bindersClient.getBinder(binderId);

if (result.success) {
  // TypeScript knows result.data exists here
  console.log(result.data.name);
  console.log(result.data.cards);
} else {
  // TypeScript knows result.error exists here
  console.error(result.error);

  // Optional error code
  if (result.code === 'HTTP_404') {
    router.push('/404');
  }
}
```

## Error Handling

Errors are automatically caught and returned in a consistent format:

```typescript
// Network errors
{
  success: false,
  error: 'Network error. Please check your connection.',
  code: 'NETWORK_ERROR'
}

// HTTP errors
{
  success: false,
  error: 'Binder not found',
  code: 'HTTP_404'
}

// API errors
{
  success: false,
  error: 'Invalid printing ID',
  code: 'INVALID_PRINTING'
}
```

**Handle errors in components:**

```typescript
const result = await bindersClient.getBinderCards(...);

if (!result.success) {
  // Show error to user
  toast.error(result.error);

  // Log for debugging
  console.error('Failed to fetch cards:', result.error, result.code);

  // Handle specific errors
  if (result.code === 'HTTP_401') {
    router.push('/login');
  }
}
```

## Migration Guide

### Before: Direct fetch()

```typescript
const [cards, setCards] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchCards = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '48',
        search: searchQuery,
      });

      const response = await fetch(`/api/binders/${binderId}/cards?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch cards');
      }

      const data = await response.json();
      setCards(data.cards);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  fetchCards();
}, [binderId, searchQuery]);
```

### After: Client service

```typescript
import { bindersClient } from '@/lib/client';

const [cards, setCards] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchCards = async () => {
    setLoading(true);

    const result = await bindersClient.getBinderCards(
      binderId,
      { search: searchQuery },
      { page: 1, limit: 48 }
    );

    setLoading(false);

    if (result.success) {
      setCards(result.data.cards);
    } else {
      toast.error(result.error);
    }
  };

  fetchCards();
}, [binderId, searchQuery]);
```

**Changes:**
- ✅ Removed manual URLSearchParams building
- ✅ Removed try/catch block
- ✅ Removed manual response.ok checking
- ✅ Simplified error handling
- ✅ Added type safety

## TypeScript Support

All services are fully typed using server-side contracts:

```typescript
import type {
  BinderDTO,
  BinderCardFilters,
  BinderCardsResult,
} from '@/lib/services/contracts/IBinderService';

// Full autocomplete and type checking
const result = await bindersClient.getBinderCards(
  binderId,
  { search: 'ninja', rarity: 'M' }, // BinderCardFilters
  { page: 1, limit: 48 } // BinderCardSearchOptions
);

if (result.success) {
  result.data.cards; // InventoryCardDTO[]
  result.data.pagination; // { page, limit, total, totalPages }
  result.data.metadata; // { uniqueValues, counts }
}
```

## Testing

Mock client services in tests:

```typescript
import * as bindersClient from '@/lib/client/binders-client';

jest.mock('@/lib/client/binders-client');

test('should display cards', async () => {
  // Mock the service
  (bindersClient.getBinderCards as jest.Mock).mockResolvedValue({
    success: true,
    data: {
      cards: [{ _id: '1', name: 'Test Card' }],
      pagination: { page: 1, total: 1 },
    },
  });

  render(<BinderPage binderId="123" />);

  await waitFor(() => {
    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });
});
```

## Best Practices

### ✅ DO

```typescript
// Import from barrel export
import { bindersClient } from '@/lib/client';

// Always check success
if (result.success) {
  // Use data
}

// Show errors to user
if (!result.success) {
  toast.error(result.error);
}

// Use TypeScript types
const result: ApiResponse<BinderDTO> = await bindersClient.getBinder(id);
```

### ❌ DON'T

```typescript
// Don't use fetch() directly
const response = await fetch('/api/binders/123'); // ❌

// Don't skip success check
const result = await bindersClient.getBinder(id);
setData(result.data); // ❌ Could be undefined!

// Don't use any types
const result: any = await bindersClient.getBinder(id); // ❌
```

## FAQ

**Q: Can I still use fetch() for non-API calls?**
A: Yes, use fetch() for external APIs. Client services are only for internal `/api/*` endpoints.

**Q: What if a service method doesn't exist?**
A: Request it! Open an issue or add it to the appropriate service file.

**Q: How do I handle loading states?**
A: Client services don't manage loading states. Components should track loading locally:
```typescript
setLoading(true);
const result = await bindersClient.getBinderCards(...);
setLoading(false);
```

**Q: Can I customize request headers?**
A: Currently no. Auth headers are handled automatically by Next.js. Future enhancement if needed.

**Q: What about request caching?**
A: Not implemented yet. Future enhancement with SWR or React Query.

## Migrated Components

The following components have been refactored to use client services:

### Binder Components
- `app/binder/[binderId]/page.tsx` - Uses `bindersClient` for card CRUD operations
- `components/binder/DeleteSelectedDialog.tsx` - Uses `bindersClient` for delete/update
- `components/binder/TransferCardsDialog.tsx` - Uses `bindersClient` for transfer operations

### Wants Components
- `app/wants/page.tsx` - Uses `wantsClient` for wants list operations
- `components/WantsCard.tsx` - Uses `wantsClient` for printing swap

## Support

- **Documentation**: See `CLAUDE.md` in this directory
- **Server Contracts**: `lib/services/contracts/*.ts`
- **Examples**: `lib/agreements-client.ts`

## Contributing

When adding new client service methods:

1. Import types from server contracts (`lib/services/contracts/`)
2. Use `ApiResponse<T>` return type
3. Use `buildQueryParams()`, `handleResponse()`, `handleError()` utilities
4. Add JSDoc comments with examples
5. Export method in barrel file (`index.ts`)
6. Update this README with new methods
