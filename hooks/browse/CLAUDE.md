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
