/**
 * Integration test: getSetLanguages returns the distinct printing languages
 * present in a set, English first (then fr, ja, then others alphabetically).
 *
 * Drives the language flag filter on /sets/[setCode] — the UI shows flag
 * buttons only for languages the set actually has, and hides the row for
 * English-only sets.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('PostgresPrintingsService.getSetLanguages', () => {
  it('lists every language present in a multi-language set, English first', async () => {
    const res = await service.getSetLanguages('hvy');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data).toEqual(['en', 'fr', 'ja', 'de', 'es', 'it']);
  });

  it('is case-insensitive on the set code', async () => {
    const res = await service.getSetLanguages('OMN');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data).toEqual(['en', 'fr', 'ja']);
  });

  it('returns just english for an english-only set (hides the picker)', async () => {
    const res = await service.getSetLanguages('wtr');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data).toEqual(['en']);
  });

  it('returns an empty array for an unknown set', async () => {
    const res = await service.getSetLanguages('zzz-not-a-set');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data).toEqual([]);
  });
});
