// POST /api/partner/v1/binders/{binderId}/cards/remove — take copies of cards
// out of one of the caller's binders. Each entry names an item and a count;
// the count is subtracted in one atomic step (never below zero) and the item
// disappears when none are left. There is no "remove everything" form.
import { binderService } from '@/lib/services';
import { listOf, partnerError, partnerOk, partnerRoute, quantityOf, readJsonObject } from '@/lib/partner-api/route';

const MAX_ITEMS = 500;

export const POST = partnerRoute<{ binderId: string }>('collection:write', async ({ request, auth, params }) => {
  const body = await readJsonObject(request);
  const entries = body ? listOf(body.items, MAX_ITEMS) : null;
  if (!entries) {
    return partnerError(400, 'invalid_request', `"items" must be a list of 1 to ${MAX_ITEMS} entries.`);
  }

  const items: Array<{ itemId: string; quantity: number }> = [];
  for (let i = 0; i < entries.length; i++) {
    const itemId = entries[i].item_id;
    const quantity = quantityOf(entries[i].quantity);
    if (typeof itemId !== 'string' || !itemId) {
      return partnerError(400, 'invalid_request', `items[${i}].item_id is required.`);
    }
    if (quantity === null) {
      return partnerError(400, 'invalid_request', `items[${i}].quantity must be a whole number from 1 to 999.`);
    }
    items.push({ itemId, quantity });
  }

  const binder = await binderService.getBinder(params.binderId, auth.userId);
  if (!binder.success || !binder.data || binder.data.userId !== auth.userId) {
    return partnerError(404, 'not_found', 'No such binder.');
  }

  const results = [];
  for (const item of items) {
    const result = await binderService.removeCopies(binder.data._id, item.itemId, auth.userId, item.quantity);
    results.push(
      result.success
        ? { item_id: item.itemId, removed: true, remaining: result.data.remaining }
        : { item_id: item.itemId, removed: false, reason: 'not_found' },
    );
  }

  const removed = results.filter(r => r.removed).length;
  return partnerOk({ removed, failed: results.length - removed, results });
});
