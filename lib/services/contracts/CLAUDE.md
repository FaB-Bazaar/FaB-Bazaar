# Service Contracts

TypeScript interfaces and DTOs defining database-agnostic service APIs. Each file follows `I{Name}Service.ts` convention with DTOs co-located in the same file.

All methods return `AsyncResult<T>` (defined in `common.ts`). Implementations live in `../postgres/`.

Two dead contract files remain (`IMetadataService.ts`, `IBinderStatsService.ts`) only because other files import their DTO types. See `lib/services/CLAUDE.md` for details.
