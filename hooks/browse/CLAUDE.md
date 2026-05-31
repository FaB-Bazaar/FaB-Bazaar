# Browse Hooks

`useBulkImportPage.ts` — Main hook powering the `/browse` page bulk import feature.

## Client Services Used

- `bindersClient.getUserBinders()`, `createBinder()`, `addCardsToBinder()`
- `searchClient.searchPrintingsPost()`
- `wantsClient.bulkAddWants()`

## Related Files

- `lib/browse/parsers/bulk-input-parser.ts` — Parses card list text
- `lib/browse/utils/index.ts` — Utility functions (selectDefaultPrinting)
- `app/browse/page.tsx` — Page that uses this hook

## Gotchas

- The cardlist parser reads a leading/trailing `red|yellow|blue` word as a pitch color, so names like "Deep Blue" (pitchless equipment) get a phantom color filter and return nothing. The parser stashes the full name in `fallbackName`; `useBulkImportPage` retries without the color filter via `lib/browse/bulk-search-fallback.ts` when a result is empty.
