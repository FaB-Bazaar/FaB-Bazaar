// POST /api/partner/v1/collection/import — add a list of cards to the caller's
// collection: into a new private binder, or into one of their binders
// (`binder_id`). Cards that cannot be pinned to one printing are reported back,
// not guessed.
import { binderService, printingsService } from '@/lib/services';
import { partnerError, partnerOk, partnerRoute } from '@/lib/partner-api/route';
import {
  parseImportItems,
  resolveImportItems,
  type LookupPrinting,
  type PrintingLookup,
} from '@/lib/partner-api/resolve-items';

const BATCH = 500;
const MAX_NAME_ATTEMPTS = 200;

// Each collector number maps to several printings (foilings, editions, languages).
const PRINTINGS_PER_COLLECTOR_NUMBER = 40;

async function inBatches(
  values: string[],
  search: (batch: string[]) => ReturnType<typeof printingsService.searchPrintings>,
): Promise<LookupPrinting[]> {
  const rows: LookupPrinting[] = [];
  for (let i = 0; i < values.length; i += BATCH) {
    const result = await search(values.slice(i, i + BATCH));
    if (!result.success) throw new Error(`printing lookup failed: ${result.error}`);
    rows.push(...result.data.printings);
  }
  return rows;
}

const lookup: PrintingLookup = {
  byPrintingIds: ids =>
    inBatches(ids, batch => printingsService.searchPrintings({ printingIds: batch }, { limit: batch.length })),
  byCollectorNumbers: numbers =>
    inBatches(numbers, batch =>
      printingsService.searchPrintings(
        { collectorNumber: batch },
        { limit: batch.length * PRINTINGS_PER_COLLECTOR_NUMBER },
      ),
    ),
};

/** Binder names are unique per user: "Name", "Name 2", "Name 3", … */
function freeBinderName(wanted: string, taken: string[]): string | null {
  const used = new Set(taken.map(n => n.toLowerCase()));
  if (!used.has(wanted.toLowerCase())) return wanted;
  for (let n = 2; n <= MAX_NAME_ATTEMPTS; n++) {
    const candidate = `${wanted} ${n}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return null;
}

export const POST = partnerRoute('collection:write', async ({ request, auth }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return partnerError(400, 'invalid_request', 'The body must be JSON.');
  }
  if (!body || typeof body !== 'object') {
    return partnerError(400, 'invalid_request', 'The body must be a JSON object.');
  }

  const parsed = parseImportItems(body.items);
  if (!parsed.ok) return partnerError(400, 'invalid_request', parsed.message);

  const { resolved, unresolved } = await resolveImportItems(parsed.items, lookup);
  if (resolved.length === 0) {
    return partnerError(422, 'nothing_resolved', 'None of the items matched a card.', { unresolved });
  }

  let binder: { id: string; name: string; created: boolean };
  if (typeof body.binder_id === 'string' && body.binder_id) {
    const existing = await binderService.getBinder(body.binder_id, auth.userId);
    if (!existing.success || !existing.data || existing.data.userId !== auth.userId) {
      return partnerError(404, 'not_found', 'No such binder.');
    }
    binder = { id: existing.data._id, name: existing.data.name, created: false };
  } else {
    const wanted =
      typeof body.binder_name === 'string' && body.binder_name.trim()
        ? body.binder_name.trim().slice(0, 80)
        : `Import ${new Date().toISOString().slice(0, 10)}`;
    const summaries = await binderService.listUserBindersSummary(auth.userId);
    const name = freeBinderName(wanted, summaries.success ? summaries.data.map(b => b.name) : []);
    if (!name) return partnerError(409, 'name_taken', 'Choose a different binder name.');

    const created = await binderService.createBinder(auth.userId, {
      name,
      visibility: {
        level: 'private',
        allowInSearch: false,
        allowInMatching: false,
        allowWhoHas: false,
        allowWebhooks: false,
        allowDiscordCommands: false,
        allowApiExport: false,
      },
    });
    if (!created.success) {
      console.error('[PartnerAPI] create binder failed:', created.error);
      return partnerError(500, 'internal_error', 'Could not create the binder.');
    }
    binder = { id: created.data._id, name: created.data.name, created: true };
  }

  const added = await binderService.addCardsToBinder(
    binder.id,
    auth.userId,
    resolved.map(item => ({
      printingId: item.printingId,
      quantity: item.quantity,
      condition: 'NM',
      language: 'EN',
      forTrade: item.forTrade,
    })),
  );
  if (!added.success) {
    console.error('[PartnerAPI] add cards failed:', added.error);
    return partnerError(500, 'internal_error', 'Could not add the cards.');
  }

  return partnerOk({
    binder,
    imported: added.data.summary.added + added.data.summary.updated,
    failed: added.data.summary.failed,
    unresolved,
  });
});
