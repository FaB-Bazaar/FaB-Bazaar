# Browse Hooks

`useBulkImportPage.ts` — Main hook powering the `/browse` page bulk import feature.

## Client Services Used

- `bindersClient.getUserBinders()`, `createBinder()`, `addCardsToBinder()`
- `searchClient.searchPrintingsPost()`
- `wantsClient.bulkAddWants()`

## Related Files

- `lib/browse/parsers/bulk-input-parser.ts` — Parses card list text
- `lib/browse/utils/index.ts` — Utility functions (selectDefaultPrinting)
- `lib/browse/group-bulk-results.ts` — Pure grouping/merge of search results into tile rows (tested there; `hooks/**` has no vitest glob)
- `app/browse/page.tsx` — Page that uses this hook

## Gotchas

- The cardlist parser reads a leading/trailing `red|yellow|blue` word as a pitch color, so names like "Deep Blue" (pitchless equipment) get a phantom color filter and return nothing. The parser stashes the full name in `fallbackName`; `useBulkImportPage` retries without the color filter via `lib/browse/bulk-search-fallback.ts` when a result is empty.
- Lines may be collector numbers (`2 WTR001`, `1 WTR123 RF`, `ARC057 (cold foil, 1st)`) — the parser sets `collectorNumber` and the bulk-search route resolves them via `printingsService.bulkResolveByCollectorNumber` (all editions/foilings of that set printing; `selectDefaultPrinting` then picks Unlimited non-foil, or the foiling the tags asked for). Bare trailing tags are accepted only when EVERY token is a known tag, otherwise the line stays a name. Collector rows key by card + collector number, so `2 WTR001` and `1 1HP001` (both Rhinar) are two rows — name lines still key by card alone. Across searches nothing merges: a repeated search APPENDS a new row (so the second pass can pick another foiling); rows fold together only when staged and only if they hold the same `printing_id` (`stageBulkInstance`).
- `selectDefaultPrinting` must list Alpha (`a`) in its edition priority: a missing key made the sort comparator NaN and Alpha stayed in front of Unlimited for WTR-numbered cards.
