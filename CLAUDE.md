# CLAUDE.md - FaB Bazaar Project Context

> **Note for Claude Code**: This file references subdirectory CLAUDE.md files (e.g., `lib/auth/CLAUDE.md`, `lib/services/CLAUDE.md`) for detailed documentation. **Do not proactively read these files** unless the user explicitly asks about those specific areas or you're actively working in those directories. They are context references, not required reading.

## Open Source Documentation Policy

This repo is **publicly open-sourced** — all CLAUDE.md files are visible to anyone. Keep docs at the architecture/pattern level. Do not include internal error message strings, security-critical schema field names, token payload structures, or anything that maps the security implementation in detail. Link to TypeScript contracts instead of reproducing specifics inline.

## Project Overview
**FaB Bazaar** is a Next.js-based trading card platform for Flesh and Blood (FaB) trading cards. Users can manage collections, create want lists, find trading partners, and facilitate secure trades.

## Technology Stack
- **Framework**: Next.js 15 with App Router
- **Database**: PostgreSQL with Drizzle ORM
  - **Migration Status**: 10/10 services migrated (100% complete as of 2026-02-16)
  - **MongoDB**: Fully deprecated - service files kept as reference only, not functional
- **Authentication**: NextAuth.js with Discord OAuth + custom JWT
- **Styling**: Tailwind CSS with shadcn/ui components
- **Language**: TypeScript
- **Testing**: Vitest
- **Deployment**: Vercel

## Development Commands
```bash
# Development
npm run dev          # Start development server
npm run build        # Build production bundle
npm run start        # Start production server
npm run lint         # Run linting
npm run test         # Run tests with Vitest

# SEO Tools
npm run seo:check    # SEO analysis
npm run seo:report   # Generate SEO report
npm run seo:sitemap  # Generate sitemap
npm run seo:robots   # Generate robots.txt
npm run seo:manifest # Generate manifest
npm run seo:speed    # Speed analysis
```

## Project Structure
```
app/                 # Next.js App Router pages
├── api/            # API routes
├── auth/           # Authentication pages
├── admin/          # Admin panel pages
├── (main)/         # Trading, marketplace, profile pages
components/         # Reusable React components
├── ui/            # shadcn/ui base components
contexts/          # React contexts (Auth, Cookies)
lib/               # Utility libraries and services
models/            # MongoDB/Mongoose models
hooks/             # Custom React hooks
types/             # TypeScript type definitions
public/            # Static assets
scripts/           # Database migration/utility scripts
```

## Key Models
```typescript
// Available models for import
import User from "@/models/User"
import Binder from "@/models/Binder"
import WantsList from "@/models/WantsList"
import Listing from "@/models/Listing"
import Agreement from "@/models/Agreement"
import Message from "@/models/Message"
import Offer from "@/models/Offer"
import CardMetadata from "@/models/CardMetadata"
```

## Essential Services
```typescript
// Service layer (use for all database operations)
import { binderService, userService, inventoryService } from "@/lib/services"

// Card metadata constants (DO NOT use metadataService - deprecated)
import { SET_MAP, FOILING_MAP, RARITY_MAP, getSetMetadata } from "@/lib/fab-constants"

// Authentication
import { authenticateRequest, authenticateSession } from "@/lib/auth/multi-auth"

// Client-side state stores
import { useListingsStore } from "@/lib/listings-store"
import { useAgreementsStore } from "@/lib/agreements-store"
```

## API Route Pattern

**IMPORTANT**: Use service layer + multi-auth for all new routes.

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

See `lib/auth/CLAUDE.md` for authentication details and `lib/services/CLAUDE.md` for available services.

## Key Features
1. **User Authentication**: Discord OAuth + custom email/password
2. **Card Management**: Add cards to binder, create want lists
3. **Trading System**: Find matches, create trade agreements
4. **Marketplace**: Browse and create listings
5. **Admin Panel**: Card import, metadata management
6. **Real-time Features**: Notifications, trade updates

## Important Notes
- **File Locking**: Many core files are locked and cannot be modified
- **Authentication**: Working correctly, don't modify auth middleware
- **Database**: PostgreSQL (primary); MongoDB deprecated and non-functional
- **Responsive Design**: All components should be mobile-friendly
- **Type Safety**: Use TypeScript interfaces for all data structures
- **Error Handling**: Always include proper error boundaries

## Environment Setup
Key environment variables are configured (see `.env.example` for full list):
- `POSTGRES_URL` - PostgreSQL connection string
- `JWT_SECRET` - Token signing
- `NEXTAUTH_SECRET`, `AUTH_URL` - NextAuth config
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` - Discord OAuth

## Common Components
- `CardDisplay` - Shows card information with metadata
- `RarityBadge`, `FoilingBadge` - Card attribute displays
- `TradeAgreement` - Trade management interface
- `SearchInput`, `QuickSearch` - Card search functionality
- `CountrySelector`, `StateSelector` - Location inputs

## Additional Documentation
- `PROJECT_OVERVIEW.md` - Detailed project documentation
- `API_TESTING_GUIDE.md` - API testing information
- `SEO_CHECKLIST.md` - SEO implementation guide
- `FabBazaar_API.postman_collection.json` - API testing collection

---

# Architecture Deep Dive

## Service Layer Architecture

All database access uses a **contract-based service layer** pattern. **18 active services** (5 deprecated, 2 removed) including userService, binderService, inventoryService, wantsService, deckService, articleService, and more.

**See `lib/services/CLAUDE.md` for complete service documentation.**

**Important**:
- ❌ **DO NOT** use `metadataService` - use `@/lib/fab-constants` instead for static card metadata
- ✅ **REMOVED** `heroService` (2026-02-16) - use `printingsService` + `@/lib/fab-constants/heroes` + `articleService` instead
- ✅ **REMOVED** `binderStatsService` (2026-02-16) - use `binderService.getUserBindersWithStats()` for on-demand stats
- ❌ **DO NOT** use `denormalizationService` in PostgreSQL - keep data normalized and use JOINs
- ❌ Trade matching services (tradeMatchingService, tradeAnalysisService, matchingService) are deprecated

```typescript
import { binderService } from '@/lib/services';

// All service methods return AsyncResult<T>
const result = await binderService.getBinder(binderId, userId);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

## Authentication

The platform supports **four authentication methods**: NextAuth Session, Discord Bot Token, MCP Token, and OAuth 2.1 Bearer.

**See `lib/auth/CLAUDE.md` for multi-auth implementation and `claude_auth.md` for detailed NextAuth.js setup.**

```typescript
import { authenticateRequest } from '@/lib/auth/multi-auth';

const authResult = await authenticateRequest(request, body);
// Returns: { success: true, userId, username, authMethod }
```

## Data Models & Denormalization

**Key models**: User, Binder, InventoryItem, WantsItem, Deck, Listing, Agreement, Article

**MongoDB Only**: Frequently-accessed parent fields are denormalized to child documents for performance. **Always sync after updates.**

**PostgreSQL**: Keep data normalized - use JOINs instead of denormalization. Performance testing showed 2-5ms execution times on 40k+ rows with proper indexes. Denormalization is **not needed** and **not recommended** in PostgreSQL.

```typescript
// MONGODB ONLY - Denormalization sync (not needed in PostgreSQL)
import { denormalizationService } from '@/lib/services';
await denormalizationService.syncInventoryWithBinder(binderId);

// POSTGRESQL - Use JOINs instead (handled by service layer)
import { inventoryService } from '@/lib/services';
const result = await inventoryService.getInventoryItems(binderId); // Automatically JOINs with binders table
```

**See `lib/denormalization/CLAUDE.md` for MongoDB sync functions and `lib/services/CLAUDE.md` for PostgreSQL migration notes.**

## Response Format Convention

All routes should return consistent response shapes:

```typescript
// Success: { success: true, data: T }
// Error: { success: false, error: "message" } or { error: "message" }
```

## Key Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | App Router, Server Components |
| PostgreSQL | 16.x | Primary database (migrating from MongoDB) |
| Drizzle ORM | Latest | PostgreSQL ORM with type-safe queries |
| MongoDB | 6.x | Legacy database (being phased out) |
| Mongoose | 8.x | ODM for MongoDB (legacy) |
| NextAuth | 5.0 (v5 beta) | Authentication |
| shadcn/ui | Latest | UI component library |
| Radix UI | Latest | Headless UI primitives |
| Tailwind CSS | 3.x | Styling |
| TypeScript | 5.x | Type safety |
| Vitest | Latest | Unit testing |