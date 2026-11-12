// GET /api/partner/v1/decks — the caller's decks (summaries).
import { deckService } from '@/lib/services';
import { partnerError, partnerOk, partnerRoute } from '@/lib/partner-api/route';
import { toPartnerDeckSummary } from '@/lib/partner-api/mappers';

export const GET = partnerRoute('decks:read', async ({ auth }) => {
  const result = await deckService.listUserDecksBasic(auth.userId);
  if (!result.success) {
    console.error('[PartnerAPI] list decks failed:', result.error);
    return partnerError(500, 'internal_error', 'Could not load decks.');
  }
  return partnerOk(result.data.map(toPartnerDeckSummary));
});
