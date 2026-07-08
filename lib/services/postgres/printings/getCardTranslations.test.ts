/**
 * Integration tests for PostgresPrintingsService.getCardTranslations.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local, with
 * card_translations backfilled (import-i18n) — Enlightened Strike has a French
 * translation ("Frappe Éclairée").
 *
 * Powers the search_printings options.language localization: bulk lookup of
 * translated card names for a set of card_unique_ids.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

let estrikeCuid: string;

beforeAll(async () => {
  const res = await service.searchPrintings({ name: 'enlightened strike', exact: true }, { limit: 1 });
  if (!res.success || res.data.printings.length === 0) throw new Error('Enlightened Strike not found in DB');
  estrikeCuid = (res.data.printings[0] as any).card_unique_id;
});

describe('PostgresPrintingsService.getCardTranslations', () => {
  it('returns the translated name/displayName for cards that have a translation', async () => {
    const res = await service.getCardTranslations([estrikeCuid], 'fr');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0]).toMatchObject({
      cardUniqueId: estrikeCuid,
      displayName: 'Frappe Éclairée',
    });
  });

  it('omits cards with no translation in that language (caller falls back to English)', async () => {
    const res = await service.getCardTranslations([estrikeCuid], 'xx');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toEqual([]);
  });

  it('returns empty for an empty id list without querying', async () => {
    const res = await service.getCardTranslations([], 'fr');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toEqual([]);
  });

  it('is case-insensitive on the language code', async () => {
    const res = await service.getCardTranslations([estrikeCuid], 'FR');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toHaveLength(1);
  });
});
