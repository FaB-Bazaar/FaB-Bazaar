/**
 * Server-side half of the /opt → Volzar handoff: the first result names of the
 * search the user came from. Runs the EXACT first-page request the /opt page
 * sent (`optQueryToSearchRequest`) through the shared search cache, so right
 * after a search this is normally a cache hit, not a second DB query.
 *
 * Kept apart from opt-handoff.ts because this module reaches the service
 * layer; the pure builder must stay importable anywhere.
 */

import { optQueryToSearchRequest } from './opt-search-request';
import { runCachedSearch } from './cached-search';
import { summarizeHandoffResults } from './opt-handoff';

/** Names ("Name (pN, type)") of the first results; [] when the URL selects nothing or the search fails. */
export async function loadOptHandoffResults(optQuery: string): Promise<string[]> {
  const request = optQueryToSearchRequest(optQuery);
  if (!request) return [];
  const result = await runCachedSearch(request.filters, request.options);
  if (!result.success) return [];
  return summarizeHandoffResults(result.data.printings as any[]);
}
