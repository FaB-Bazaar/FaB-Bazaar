# CLAUDE.md - FaB Bazaar

> Subdirectory CLAUDE.md files (e.g., `lib/auth/CLAUDE.md`, `lib/services/CLAUDE.md`) are loaded automatically when working in those directories. Don't read them proactively.

## Open Source Documentation Policy

This repo is publicly open-sourced. Keep CLAUDE.md content at the architecture/pattern level. Do not include error message strings, security-critical schema fields, token payload structures, or security implementation details.

## Project Overview

Next.js 15 (App Router) trading card platform for Flesh and Blood TCG. PostgreSQL + Drizzle ORM. Self-hosted VPS (Docker).

## Security

- **Never hardcode secrets** — no API keys, tokens, passwords, or connection strings in source code. All secrets via `process.env.*` only, sourced from `.env.local` (never committed).

## Key Rules

- **PostgreSQL only** — MongoDB fully removed (2026-03-08). No Mongoose models, no MongoDB connections. The `models/` directory is dead code.
- **Don't modify auth middleware** — authentication is working and locked down
- **File locking** — many core files are locked and cannot be modified
- **Service layer for all DB access** — never query the database directly; use services from `@/lib/services`
- **Use `@/lib/fab-constants`** for card metadata (SET_MAP, FOILING_MAP, RARITY_MAP) — do NOT use metadataService
- **Use `@/lib/utils/display-username`** for rendered usernames — `displayUsername()` strips internal `dc_`/`gh_` prefixes, `profileHref()` URL-encodes profile links. Discord bot commands still need raw usernames.

## Deprecated/Removed Services

- `metadataService` — use `@/lib/fab-constants` instead
- `heroService` — removed; use `printingsService` + `@/lib/fab-constants/heroes` + `articleService`
- `binderStatsService` — removed; use `binderService.getUserBindersWithStats()`
- `denormalizationService` — removed (was MongoDB-only)
- `tradeMatchingService`, `tradeAnalysisService`, `matchingService` — deprecated
- Fabrary integration (`fabraryUrl`, `fabraryDeckId`) — removed from decks (0026)

## Known Gotchas

- **`/api/decks/list` is Talishar-only** — requires `x-api-key`; MCP and OAuth clients must use `/api/decks` (GET) instead.
- **Circular dep risk in services** — do not import from `@/lib/services` in any file that `lib/services/index.ts` imports transitively. Use `await import('@/lib/services')` lazily inside function bodies. (`lib/metafy/tokens.ts` hit this: caused `ReferenceError` in TDZ for `ServiceFactory`.)

## API Route Pattern

Use service layer + multi-auth for all routes. Return `{ success: true, data }` or `{ error: "message" }`.

```typescript
import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/auth/multi-auth"
import { binderService } from "@/lib/services"

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request, {})
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const result = await binderService.getBinder(binderId, authResult.userId)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: result.data })
}
```

## Authentication

Four methods: NextAuth Session, Discord Bot Token, MCP Token, OAuth 2.1 Bearer. See `lib/auth/CLAUDE.md` for details.

```typescript
import { authenticateRequest, authenticateSession } from "@/lib/auth/multi-auth"
```

## Testing

### Running tests

```bash
npm run test                          # all tests (watch mode)
npx vitest run                        # all tests (CI / one-shot)
npx vitest run <path>                 # single file
```

Requires `POSTGRES_URL` in `.env.local` for service integration tests (reads via `vitest.setup.ts` → `loadEnvConfig`).

### Two-layer pattern

Every feature gets two test files:

| Layer | File location | DB | What it proves |
|-------|---------------|----|----------------|
| **Service integration** | `lib/services/postgres/**/*.test.ts` | Real (local Docker) | Business logic, transactions, edge cases |
| **Route unit** | `app/api/**/*.test.ts` | None (mocked service) | Auth, validation, grouping, HTTP response shape |

### Service integration test conventions

- `beforeAll`: query a real FK value (e.g. `printingId`) needed to insert test rows
- `beforeEach`: insert isolated test data using `crypto.randomUUID()` IDs
- `afterEach`: `db.delete(users).where(eq(users.id, testUserId))` — cascade handles binders → inventory items
- Import service directly: `import { PostgresBinderService } from './PostgresBinderService'`
- Do **not** import from `@/lib/services` in service test files (circular dep risk — see Known Gotchas)

### Route unit test conventions

```typescript
vi.mock('@/lib/services', () => ({ binderService: { methodName: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));
// Import AFTER mocks (vi.mock is hoisted; referencing outer variables in factories breaks)
import { POST } from './route';
import { binderService } from '@/lib/services';
const mockMethod = vi.mocked(binderService.methodName);
```

See `app/api/collection/transfer/route.test.ts` for a complete example.

## Environment

See `.env.example` for required environment variables.
