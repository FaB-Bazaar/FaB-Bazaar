// GET /api/partner/v1/binders — the caller's binders with totals.
import { binderService } from '@/lib/services';
import { partnerError, partnerOk, partnerRoute } from '@/lib/partner-api/route';
import { toPartnerBinder } from '@/lib/partner-api/mappers';

export const GET = partnerRoute('collection:read', async ({ auth }) => {
  const result = await binderService.getUserBindersWithStats(auth.userId);
  if (!result.success) {
    console.error('[PartnerAPI] list binders failed:', result.error);
    return partnerError(500, 'internal_error', 'Could not load binders.');
  }
  return partnerOk(result.data.map(toPartnerBinder));
});
