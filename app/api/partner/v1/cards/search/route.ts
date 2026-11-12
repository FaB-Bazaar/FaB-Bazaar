// GET /api/partner/v1/cards/search — find printings by name, set and/or
// collector number. A name search returns front faces only (the back of a
// double-faced card is not a card you own or deck on its own); a collector
// number lookup returns every printing carrying that number.
import { printingsService } from '@/lib/services';
import type { PrintingsSearchFilters } from '@/lib/services/contracts/IPrintingsService';
import { intParam, partnerError, partnerOk, partnerRoute } from '@/lib/partner-api/route';
import { toPartnerCard } from '@/lib/partner-api/mappers';

export const GET = partnerRoute('cards:read', async ({ request }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim();
  const set = url.searchParams.get('set')?.trim().toLowerCase();
  const collectorNumber = url.searchParams.get('collector_number')?.trim().toUpperCase();

  const filters: PrintingsSearchFilters = {};
  if (q) {
    filters.name = q;
    filters.frontFaceOnly = true;
  }
  if (set) filters.sets = [set];
  if (collectorNumber) filters.collectorNumber = collectorNumber;
  if (Object.keys(filters).length === 0) {
    return partnerError(400, 'invalid_request', 'Give at least one of "q", "set" or "collector_number".');
  }

  const page = intParam(url, 'page', 1, Number.MAX_SAFE_INTEGER);
  const limit = intParam(url, 'limit', 50, 100);

  const result = await printingsService.searchPrintings(filters, { limit, page });
  if (!result.success) {
    console.error('[PartnerAPI] card search failed:', result.error);
    return partnerError(500, 'internal_error', 'Search failed.');
  }

  return partnerOk(result.data.printings.map(toPartnerCard), {
    pagination: { page, limit, total: result.data.total, total_pages: result.data.pages },
  });
});
