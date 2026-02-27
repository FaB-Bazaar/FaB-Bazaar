# Browse Hooks

This directory contains React hooks for the browse/bulk import functionality.

## Files

### `useBulkImportPage.ts`

The main hook powering the `/browse` page bulk import feature.

**Client Services Used:**
- `bindersClient.getUserBinders()` - Fetch user's binders for dropdown
- `bindersClient.createBinder()` - Create a new binder
- `bindersClient.addCardsToBinder()` - Add staged cards to selected binder
- `searchClient.searchPrintingsPost()` - Search for cards by name
- `wantsClient.bulkAddWants()` - Add staged cards to wants list

**State Managed:**
- `bulkInput` - User's card list text input
- `bulkResults` - Search results with staging/quantity/printing state
- `binders` - User's available binders
- `selectedBinderSlug` - Currently selected binder
- `loading` / `isImporting` - Loading states
- `error` - Error state

**Key Functions:**
- `handleBulkSearch()` - Parses input, searches for cards
- `handleCreateBinder()` - Creates a new binder
- `handleAddToBinder()` - Imports staged cards to binder
- `handleAddToWants()` - Adds staged cards to wants list
- `toggleStagedStatus()` - Toggle card staging
- `updateCardQuantity()` - Change card quantity
- `updateCardPrinting()` - Change selected printing
- `duplicateCard()` - Create a copy for different printing

## Related Files

- `lib/browse/parsers/bulk-input-parser.ts` - Parses card list text
- `lib/browse/utils/index.ts` - Utility functions (selectDefaultPrinting)
- `components/browse/BulkImportForm.tsx` - Input form component
- `components/browse/BulkResultsGrid.tsx` - Results grid component
- `app/browse/page.tsx` - Page that uses this hook

## Usage Example

```typescript
import { useBulkImportPage } from '@/hooks/browse/useBulkImportPage';

function BrowsePage() {
  const { state, handlers } = useBulkImportPage();

  return (
    <div>
      <BulkImportForm
        value={state.bulkInput}
        onChange={handlers.setBulkInput}
        onSubmit={handlers.handleBulkSearch}
        loading={state.loading}
      />
      <BulkResultsGrid
        results={state.bulkResults}
        onToggleStaged={handlers.toggleStagedStatus}
        onUpdateQuantity={handlers.updateCardQuantity}
      />
    </div>
  );
}
```
