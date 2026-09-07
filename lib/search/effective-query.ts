/**
 * Which text actually reaches the server as a name/text filter. In the Volzar
 * scope the box holds a plain-English question that is only acted on when the
 * user presses Enter (the page then dispatches the translated state), so the
 * live/debounced query must NOT drive a search while they type.
 */
import type { OptUiState } from './opt-url-state';

export function effectiveSearchQuery(searchMode: OptUiState['searchMode'], debouncedQuery: string): string {
  return searchMode === 'volzar' ? '' : debouncedQuery;
}
