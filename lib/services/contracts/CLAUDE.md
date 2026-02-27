# Service Contracts

This directory contains TypeScript interfaces defining database-agnostic service APIs.

## Purpose

Contracts decouple business logic from database implementation. Route handlers import services, not MongoDB code.

## Naming Convention

- Interface files: `I{ServiceName}Service.ts` (e.g., `IUserService.ts`)
- DTOs defined within each contract file
- All methods return `AsyncResult<T>` from `common.ts`

## Key Files

| Contract | Responsibility |
|----------|---------------|
| `IUserService.ts` | User CRUD, auth lookups, profile management |
| `IBinderService.ts` | Binder CRUD, visibility, stats |
| `IInventoryService.ts` | Inventory items, tradeable queries |
| `IWantsService.ts` | Want list management |
| `IPrintingsService.ts` | Full card search with 100+ filter options |
| `IPrintingsCoreService.ts` | Lightweight card lookup |
| `ITradeService.ts` | P2P trade execution |
| `IEscrowService.ts` | Trade item locking |
| `IBinderStatsService.ts` | Stats calculation, dirty flag pattern |

## Adding New Services

1. Create `I{Name}Service.ts` with DTOs and interface
2. All methods must return `AsyncResult<T>`
3. Document with JSDoc including examples
4. Create implementation in `mongodb/{name}/`
5. Register in `ServiceFactory` (`../index.ts`)
