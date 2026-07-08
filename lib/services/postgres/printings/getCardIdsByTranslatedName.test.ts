/**
 * Integration tests for PostgresPrintingsService.getCardIdsByTranslatedName.
 *
 * Runs against local Postgres with card_translations backfilled — Enlightened
 * Strike is "Frappe Éclairée" (fr) and "啓示の一撃" (ja).
 *
 * Powers the search_printings translated-name fallback: a user's native-
 * language card name resolves to card_unique_ids when the English name
 * search finds nothing.
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

describe('PostgresPrintingsService.getCardIdsByTranslatedName', () => {
  it('resolves a French card name to its card_unique_id', async () => {
    const res = await service.getCardIdsByTranslatedName('Frappe Éclairée');
    expect(res.success).toBe(true);
    if (!res.success) return;
    const match = res.data.find((m) => m.cardUniqueId === estrikeCuid);
    expect(match).toMatchObject({ language: 'fr', displayName: 'Frappe Éclairée' });
  });

  it('matches accent- and case-insensitively', async () => {
    const res = await service.getCardIdsByTranslatedName('frappe eclairee');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.some((m) => m.cardUniqueId === estrikeCuid)).toBe(true);
  });

  it('resolves a Japanese card name', async () => {
    const res = await service.getCardIdsByTranslatedName('啓示の一撃');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.some((m) => m.cardUniqueId === estrikeCuid && m.language === 'ja')).toBe(true);
  });

  it('returns empty for a name that matches nothing, and for blank input', async () => {
    const miss = await service.getCardIdsByTranslatedName('zzz not a card zzz');
    expect(miss.success).toBe(true);
    if (miss.success) expect(miss.data).toEqual([]);

    const blank = await service.getCardIdsByTranslatedName('   ');
    expect(blank.success).toBe(true);
    if (blank.success) expect(blank.data).toEqual([]);
  });
});
