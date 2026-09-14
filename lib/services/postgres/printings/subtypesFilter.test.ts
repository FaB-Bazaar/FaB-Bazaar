/**
 * Integration tests for the `subtypes` search filter — a second, independent
 * overlap against cards.types so a caller can AND a slot (arms / off-hand /
 * 1h …) with a type guard (equipment + weapon). `types` alone can't express
 * that: it is a single OR overlap.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();
const ZONE = ['equipment', 'weapon'];

describe('PostgresPrintingsService — subtypes filter', () => {
  it('subtypes alone narrows to cards carrying that slot token', async () => {
    const res = await service.searchPrintings({ subtypes: ['arms'] }, { limit: 80, groupByCard: true });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    expect(res.data.printings.every((p) => (p.types ?? []).includes('arms'))).toBe(true);
  });

  it('ANDs with the types guard: off-hand + equipment/weapon excludes the off-hand companion allies', async () => {
    // Polly Cranka / Sticky Fingers are "Companion - Off-hand Ally" — they
    // carry 'off-hand' in cards.types but are not equipment.
    const res = await service.searchPrintings({ types: ZONE, subtypes: ['off-hand'] }, { limit: 200, groupByCard: true });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    const names = res.data.printings.map((p) => p.name.toLowerCase());
    expect(names).not.toContain('polly cranka');
    expect(names).not.toContain('sticky fingers');
    expect(res.data.printings.every((p) => (p.types ?? []).includes('off-hand'))).toBe(true);
  });

  it('several slots are OR-combined (arms + legs is larger than arms alone)', async () => {
    const both = await service.searchPrintings({ types: ZONE, subtypes: ['arms', 'legs'] }, { limit: 1, groupByCard: true });
    const arms = await service.searchPrintings({ types: ZONE, subtypes: ['arms'] }, { limit: 1, groupByCard: true });
    expect(both.success && arms.success).toBe(true);
    if (!both.success || !arms.success) return;
    expect(both.data.total).toBeGreaterThan(arms.data.total);
  });

  it('1h returns one-handed weapons only', async () => {
    const res = await service.searchPrintings({ types: ZONE, subtypes: ['1h'] }, { limit: 80, groupByCard: true });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.printings.length).toBeGreaterThan(0);
    expect(res.data.printings.every((p) => (p.types ?? []).includes('1h') && (p.types ?? []).includes('weapon'))).toBe(true);
  });
});
