# Client Services Architecture

This directory contains client-side service abstractions that wrap API calls for React components.

## Purpose

Client services provide a **unified interface** for making API requests from the frontend. They abstract away fetch() calls, query parameter building, and error handling, ensuring consistency across all components.

## Architecture Pattern

```
Component → Client Service → fetch() → API Route → Server Service → Database
```

**Example:**
```typescript
// Component
import { bindersClient } from '@/lib/client';

const result = await bindersClient.getBinderCards(binderId, filters, options);

if (result.success) {
  setCards(result.data.cards);
} else {
  toast.error(result.error);
}
```

## Core Principles

### 1. ApiResponse<T> Pattern

All client service methods return `ApiResponse<T>`:

```typescript
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };
```

**Benefits:**
- Consistent error handling
- Type-safe responses
- No need for try/catch in components
- Clear success/failure paths

### 2. Type Safety via Server Contracts

Client services import types from server-side service contracts:

```typescript
// Import types from server-side contract
import type {
  BinderDTO,
  BinderCardFilters,
  BinderCardsResult,
} from '@/lib/services/contracts/IBinderService';

// Use in client service
export async function getBinderCards(
  binderId: string,
  filters: BinderCardFilters,
  options: BinderCardSearchOptions
): Promise<ApiResponse<BinderCardsResult>> {
  // Implementation
}
```

This ensures client and server stay in sync.

### 3. Centralized Logic

All API-related logic lives in ONE place:
- ✅ Query parameter building
- ✅ Error handling
- ✅ Response parsing
- ✅ Request headers

Components stay focused on UI logic.

## Available Services

| Service | File | Purpose |
|---------|------|---------|
| **bindersClient** | `binders-client.ts` | Binder CRUD, card management |
| **wantsClient** | `wants-client.ts` | Want list operations |
| **decksClient** | `decks-client.ts` | Deck building, inventory comparison |
| **searchClient** | `search-client.ts` | Card search and browse |
| **usersClient** | `users-client.ts` | User profiles, trade analysis |

## Usage Examples

### Example 1: Getting Binder Cards

**Before (Direct fetch):**
```typescript
const [cards, setCards] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

const fetchCards = async () => {
  setLoading(true);
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '48',
      sortBy: sortBy,
    });

    if (searchQuery) params.append('search', searchQuery);
    if (rarityFilter) params.append('rarity', rarityFilter);

    const response = await fetch(`/api/binders/${binderId}/cards?${params}`);

    if (!response.ok) throw new Error('Failed to fetch');

    const data = await response.json();
    setCards(data.cards);
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

**After (Client service):**
```typescript
import { bindersClient } from '@/lib/client';

const [cards, setCards] = useState([]);
const [loading, setLoading] = useState(true);

const fetchCards = async () => {
  setLoading(true);

  const result = await bindersClient.getBinderCards(
    binderId,
    { search: searchQuery, rarity: rarityFilter },
    { page, limit: 48, sortBy }
  );

  setLoading(false);

  if (result.success) {
    setCards(result.data.cards);
  } else {
    toast.error(result.error);
  }
};
```

### Example 2: Updating a Card

**Before:**
```typescript
const handleUpdate = async (cardId: string, updates: any) => {
  try {
    const response = await fetch(`/api/binders/${binderId}/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) throw new Error('Failed');

    const result = await response.json();
    setCards(cards.map(c => c._id === cardId ? result.data : c));
  } catch (error) {
    toast.error(error.message);
  }
};
```

**After:**
```typescript
import { bindersClient } from '@/lib/client';

const handleUpdate = async (cardId: string, updates: UpdateCardDTO) => {
  const result = await bindersClient.updateBinderCard(binderId, cardId, updates);

  if (result.success) {
    setCards(cards.map(c => c._id === cardId ? result.data : c));
    toast.success('Card updated');
  } else {
    toast.error(result.error);
  }
};
```

### Example 3: Error Handling

All errors are handled consistently:

```typescript
const result = await bindersClient.getBinderCards(binderId, filters, options);

if (!result.success) {
  // result.error is always a string
  // result.code is an optional error code

  console.error(`Error: ${result.error}`);

  if (result.code === 'NETWORK_ERROR') {
    toast.error('Please check your connection');
  } else if (result.code === 'HTTP_401') {
    router.push('/login');
  } else {
    toast.error(result.error);
  }
}
```

## Utilities

### buildQueryParams()

Converts an object to URLSearchParams, filtering out undefined/null values:

```typescript
import { buildQueryParams } from '@/lib/client';

const params = buildQueryParams({
  page: 1,
  search: 'command',
  rarity: undefined,  // Filtered out
  forTrade: true,
});

// Result: "page=1&search=command&forTrade=true"
```

### handleResponse()

Parses fetch Response into ApiResponse<T>:

```typescript
import { handleResponse } from '@/lib/client';

const response = await fetch('/api/binders/123');
const result = await handleResponse<BinderDTO>(response);

if (result.success) {
  console.log(result.data); // BinderDTO
}
```

### handleError()

Converts exceptions to ApiResponse:

```typescript
import { handleError } from '@/lib/client';

try {
  const response = await fetch('/api/...');
  return await handleResponse(response);
} catch (error) {
  return handleError(error);
}
```

## Testing

Mock client services in tests:

```typescript
import * as bindersClient from '@/lib/client/binders-client';

jest.mock('@/lib/client/binders-client', () => ({
  getBinderCards: jest.fn(),
}));

// In test
(bindersClient.getBinderCards as jest.Mock).mockResolvedValue({
  success: true,
  data: { cards: mockCards, pagination: {...} },
});
```

## Relationship to Server Services

Client services mirror server services but serve different purposes:

| Layer | Location | Purpose | Example |
|-------|----------|---------|---------|
| **Server Service** | `lib/services/` | Database abstraction | `binderService.getBinder()` |
| **Client Service** | `lib/client/` | API abstraction | `bindersClient.getBinder()` |

**Flow:**
```
Component
  ↓ calls
Client Service (lib/client/binders-client.ts)
  ↓ fetch()
API Route (app/api/binders/[id]/route.ts)
  ↓ calls
Server Service (lib/services/mongodb/binder/)
  ↓ queries
MongoDB
```

## Migration Guide

### Step 1: Identify fetch() calls

Search component for direct `fetch()` calls:
```typescript
const response = await fetch('/api/binders/...');
```

### Step 2: Import client service

```typescript
import { bindersClient } from '@/lib/client';
```

### Step 3: Replace fetch with service method

Map each fetch() to the corresponding service method:

| Old fetch() call | New service method |
|------------------|-------------------|
| `fetch('/api/binders/123')` | `bindersClient.getBinder('123')` |
| `fetch('/api/binders/123/cards?...')` | `bindersClient.getBinderCards('123', filters, options)` |
| `fetch('/api/wants')` | `wantsClient.getUserWants(filters, options)` |
| `fetch('/api/decks')` | `decksClient.getUserDecks(filters, pagination)` |

### Step 4: Update error handling

Replace try/catch with success check:

```typescript
// Before
try {
  const response = await fetch(...);
  if (!response.ok) throw new Error('Failed');
  const data = await response.json();
  setData(data);
} catch (error) {
  setError(error.message);
}

// After
const result = await bindersClient.getBinderCards(...);
if (result.success) {
  setData(result.data);
} else {
  toast.error(result.error);
}
```

## Best Practices

### ✅ DO

- Always use client services for API calls
- Handle both success and error cases
- Use TypeScript types from server contracts
- Keep components focused on UI logic

### ❌ DON'T

- Don't use fetch() directly in components
- Don't duplicate API logic across components
- Don't ignore error responses
- Don't use `any` types

## Future Enhancements

Potential improvements (out of scope for initial implementation):

1. **Request Caching** - Integrate SWR or React Query
2. **Optimistic Updates** - Update UI before API confirms
3. **Request Deduplication** - Prevent duplicate simultaneous calls
4. **Retry Logic** - Automatic retry on network failures
5. **Request Cancellation** - Cancel in-flight requests on unmount

## Migrated Components

The following components have been refactored to use client services (Phase 3 of implementation):

### Binder Components (using `bindersClient`)
| Component | Methods Used |
|-----------|--------------|
| `app/binder/[binderId]/page.tsx` | `getBinderCards`, `getBinderCard`, `updateBinderCard`, `deleteBinderCard` |
| `components/binder/DeleteSelectedDialog.tsx` | `deleteBinderCard`, `updateBinderCard` |
| `components/binder/TransferCardsDialog.tsx` | `getUserBinders`, `transferSelectedCards` |

### Wants Components (using `wantsClient`)
| Component | Methods Used |
|-----------|--------------|
| `app/wants/page.tsx` | `getUserWants`, `updateWantsItem`, `removeWantsItem`, `addWantsItem` |
| `components/WantsCard.tsx` | `removeWantsItem`, `addWantsItem` |

### Remaining Components to Migrate
See the plan file at `.claude/plans/enumerated-bouncing-wand.md` for the full list of ~74 remaining components.

## Reference Files

- **Server Contracts**: `lib/services/contracts/I*Service.ts`
- **Existing Example**: `lib/agreements-client.ts`
- **Utilities**: `lib/client/utils.ts`
- **Types**: `lib/client/types.ts`
