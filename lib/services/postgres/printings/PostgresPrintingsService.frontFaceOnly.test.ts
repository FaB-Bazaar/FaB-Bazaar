/**
 * frontFaceOnly: drops double-faced BACK printings (is_front_face = false).
 * The deck builder sets it — a back face (Bank Breaker, the weapon side of
 * Construct Bank Breaker) isn't a deck card; Talishar validates the front.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

const namesFor = async (filters: Parameters<PostgresPrintingsService['searchPrintings']>[0]) => {
  const r = await service.searchPrintings(filters, { limit: 50 });
  expect(r.success).toBe(true);
  if (!r.success) return [];
  return [...new Set(r.data.printings.map((p: any) => String(p.name).toLowerCase()))];
};

describe('frontFaceOnly', () => {
  it('without it, a name search returns the back face', async () => {
    expect(await namesFor({ name: 'bank breaker' })).toContain('bank breaker');
  });

  it('drops the back face and keeps the front', async () => {
    const names = await namesFor({ name: 'bank breaker', frontFaceOnly: true });
    expect(names).not.toContain('bank breaker');
    expect(names).toContain('construct bank breaker');
  });
});
