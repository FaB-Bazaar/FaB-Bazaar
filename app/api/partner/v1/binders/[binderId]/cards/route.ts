// GET /api/partner/v1/binders/{binderId}/cards — one page of the caller's binder.
// Only the caller's own binders are reachable here, whatever their visibility.
import { binderService } from '@/lib/services';
import { intParam, partnerError, partnerOk, partnerRoute } from '@/lib/partner-api/route';
import { toPartnerBinderItem } from '@/lib/partner-api/mappers';

const NOT_FOUND = () => partnerError(404, 'not_found', 'No such binder.');

export const GET = partnerRoute<{ binderId: string }>('collection:read', async ({ request, auth, params }) => {
  const binderResult = await binderService.getBinder(params.binderId, auth.userId);
  if (!binderResult.success || !binderResult.data || binderResult.data.userId !== auth.userId) {
    return NOT_FOUND();
  }

  const url = new URL(request.url);
  const page = intParam(url, 'page', 1, Number.MAX_SAFE_INTEGER);
  const limit = intParam(url, 'limit', 100, 200);

  const result = await binderService.getBinderCards(binderResult.data._id, {}, { page, limit, sortBy: 'name' });
  if (!result.success) {
    console.error('[PartnerAPI] binder cards failed:', result.error);
    return partnerError(500, 'internal_error', 'Could not load the binder.');
  }

  const { cards, pagination } = result.data;
  return partnerOk(cards.map(toPartnerBinderItem), {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      total_pages: pagination.totalPages,
    },
  });
});
