// PATCH /api/partner/v1/binders/{binderId}/cards/{itemId} — change one item in
// one of the caller's binders: its quantity and its for-trade flag. Nothing
// else about the item can be set from here. To take the last copy away use
// the remove endpoint.
import { binderService } from '@/lib/services';
import type { UpdateCardDTO } from '@/lib/services/contracts/IBinderService';
import { partnerError, partnerOk, partnerRoute, readJsonObject } from '@/lib/partner-api/route';
import { toPartnerBinderItem } from '@/lib/partner-api/mappers';

export const PATCH = partnerRoute<{ binderId: string; itemId: string }>(
  'collection:write',
  async ({ request, auth, params }) => {
    const body = await readJsonObject(request);
    if (!body) return partnerError(400, 'invalid_request', 'The body must be a JSON object.');

    const updates: UpdateCardDTO = {};
    if (body.quantity !== undefined) {
      const quantity = body.quantity;
      if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
        return partnerError(400, 'invalid_request', '"quantity" must be a whole number from 1 to 999.');
      }
      updates.quantity = quantity;
    }
    if (body.for_trade !== undefined) {
      if (typeof body.for_trade !== 'boolean') {
        return partnerError(400, 'invalid_request', '"for_trade" must be true or false.');
      }
      updates.forTrade = body.for_trade;
    }
    if (Object.keys(updates).length === 0) {
      return partnerError(400, 'invalid_request', 'Give at least one of "quantity" or "for_trade".');
    }

    const notFound = () => partnerError(404, 'not_found', 'No such item in that binder.');
    const binder = await binderService.getBinder(params.binderId, auth.userId);
    if (!binder.success || !binder.data || binder.data.userId !== auth.userId) return notFound();
    const existing = await binderService.getBinderCard(binder.data._id, params.itemId, auth.userId);
    if (!existing.success || !existing.data) return notFound();

    const result = await binderService.updateBinderCard(binder.data._id, params.itemId, auth.userId, updates);
    if (!result.success) {
      console.error('[PartnerAPI] update binder item failed:', result.error);
      return partnerError(500, 'internal_error', 'Could not update the item.');
    }
    return partnerOk(toPartnerBinderItem(result.data));
  },
);
