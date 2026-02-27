# Binder Stats Service

MongoDB implementation for binder statistics calculation and caching.

## Key Features

- **Dirty Flag Pattern**: Binders marked `statsNeedUpdate: true` are processed lazily
- **Client-Side Aggregation**: 50% faster than MongoDB aggregation pipelines
- **Batch Processing**: 20-item chunks to prevent memory/timeout issues
- **High-Value Triggers**: M/L/F/V rarities trigger immediate updates

## Methods

| Method | Purpose |
|--------|---------|
| `calculateStats()` | Calculate stats without saving |
| `updateStats()` | Calculate and persist to binder |
| `triggerUpdate()` | Mark dirty, optionally process immediately |
| `updateDirtyBinders()` | Batch process dirty binders (cron job) |
| `batchUpdateStats()` | Update multiple binders in chunks |
| `processPriceUpdates()` | Handle bulk price changes |
| `migrateAllBinders()` | One-time migration utility |

## Stats Calculated

- Total quantity, for-trade quantity, not-for-trade quantity
- Total value (tcg_market, tcg_low, tcg_mid, tcg_high)
- Rarity counts (C, R, S, M, L, F, T, V, P)
- Showcase cards (top 6 by price)
