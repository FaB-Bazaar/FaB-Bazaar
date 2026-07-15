# Client Services

Client-side API wrappers for React components. Abstracts fetch() calls so components focus on UI.

## Flow

```
Component → Client Service → fetch() → API Route → Server Service → Database
```

## Available Services

| Service | File | Purpose |
|---------|------|---------|
| `bindersClient` | `binders-client.ts` | Binder CRUD, card management |
| `wantsClient` | `wants-client.ts` | Want list operations |
| `decksClient` | `decks-client.ts` | Deck building, inventory comparison |
| `searchClient` | `search-client.ts` | Card search and browse |
| `usersClient` | `users-client.ts` | User profiles, trade analysis |
| `articlesClient` | `articles-client.ts` | Article CRUD, publishing |
| `locationsClient` | `locations-client.ts` | Stores, events, geo |
| `collectiblesClient` | `collectibles-client.ts` | Playmat/collectible catalog + have/want marks |

All methods return `ApiResponse<T>` (defined in `types.ts`): `{ success: true, data }` or `{ success: false, error }`. Types are imported from server-side contracts (`lib/services/contracts/`).

Components should use these services instead of calling fetch() directly.
