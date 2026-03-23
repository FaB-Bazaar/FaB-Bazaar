# CLAUDE.md - FaB Bazaar

> Subdirectory CLAUDE.md files (e.g., `lib/auth/CLAUDE.md`, `lib/services/CLAUDE.md`) are loaded automatically when working in those directories. Don't read them proactively.

## Open Source Documentation Policy

This repo is publicly open-sourced. Keep CLAUDE.md content at the architecture/pattern level. Do not include error message strings, security-critical schema fields, token payload structures, or security implementation details.

## Project Overview

Next.js 15 (App Router) trading card platform for Flesh and Blood TCG. PostgreSQL + Drizzle ORM. Self-hosted VPS (Docker).

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

## Non-obvious Commands

```bash
npm run seo:check     # SEO analysis
npm run seo:report    # Generate SEO report
npm run seo:sitemap   # Generate sitemap
npm run seo:robots    # Generate robots.txt
npm run seo:manifest  # Generate manifest
npm run seo:speed     # Speed analysis
npm run test          # Vitest
```

## Environment

See `.env.example` for required environment variables.
