# Binder Statistics

**`binderStats.ts` is dead code** — it imports `binderStatsService` which is no longer exported. Nothing in the codebase imports from this file. Safe to delete along with `IBinderStatsService.ts` once its re-exported DTO types are relocated.

For current stats behavior, see `app/api/binders/CLAUDE.md` (dirty flag pattern, cron job, immediate recalc for M/L/F/V).
