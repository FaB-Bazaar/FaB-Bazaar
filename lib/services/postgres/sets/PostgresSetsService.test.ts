/**
 * Integration tests for PostgresSetsService against local Postgres.
 * Requires migration 0061 (sets table) to be applied — the table is seeded
 * read-only reference data, so tests assert against known stable rows (wtr)
 * rather than inserting fixtures.
 */

import { describe, it, expect } from 'vitest';
import { PostgresSetsService } from './PostgresSetsService';

const service = new PostgresSetsService();

describe('PostgresSetsService', () => {
  it('listSets returns every set ordered by release_order ascending', async () => {
    const res = await service.listSets();
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.length).toBeGreaterThan(100);
    const orders = res.data.map((s) => s.releaseOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    // No duplicate codes
    const codes = res.data.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('getSetByCode returns the full DTO for a known core set', async () => {
    const res = await service.getSetByCode('wtr');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data).toMatchObject({
      code: 'wtr',
      displayCode: 'WTR',
      name: 'Welcome to Rathe',
      releaseDate: '2019-10-11',
      category: 'standard',
      tier: 1,
      isCore: true,
      hasFirstEdition: true,
      unlimitedBeforeFirst: true,
    });
    expect(res.data?.releaseOrder).toBeTypeOf('number');
  });

  it('exposes the curated displayOrder on every set', async () => {
    const res = await service.listSets();
    expect(res.success).toBe(true);
    if (!res.success) return;

    for (const s of res.data) {
      expect(s.displayOrder, `displayOrder missing on ${s.code}`).toBeTypeOf('number');
    }
    // Curated printing-display ordering is unique per set
    const orders = res.data.map((s) => s.displayOrder);
    expect(new Set(orders).size).toBe(orders.length);
    // Seeded semantics: main booster sets come before armory reprints
    const byCode = new Map(res.data.map((s) => [s.code, s]));
    expect(byCode.get('wtr')!.displayOrder).toBeLessThan(byCode.get('asr')!.displayOrder);
  });

  it('getSetByCode is case-insensitive (printings store lowercase codes)', async () => {
    const res = await service.getSetByCode('WTR');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data?.code).toBe('wtr');
  });

  it('getSetByCode returns null (not an error) for an unknown code', async () => {
    const res = await service.getSetByCode('zzz');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toBeNull();
  });

  it('reorderSets renumbers display_order transactionally (swap survives the UNIQUE constraint)', async () => {
    const before = await service.listSets();
    expect(before.success).toBe(true);
    if (!before.success) return;
    const a = before.data.find((s) => s.code === 'iar')!;
    const b = before.data.find((s) => s.code === 'mpw')!;

    try {
      // Swapping two orders directly would violate UNIQUE without two-phase handling
      const res = await service.reorderSets([
        { code: a.code, displayOrder: b.displayOrder },
        { code: b.code, displayOrder: a.displayOrder },
      ]);
      expect(res.success, !res.success ? (res as any).error : '').toBe(true);
      if (!res.success) return;
      expect(res.data.updated).toBe(2);

      const afterA = await service.getSetByCode(a.code);
      const afterB = await service.getSetByCode(b.code);
      expect(afterA.success && afterB.success).toBe(true);
      if (!afterA.success || !afterB.success) return;
      expect(afterA.data?.displayOrder).toBe(b.displayOrder);
      expect(afterB.data?.displayOrder).toBe(a.displayOrder);
    } finally {
      // Restore reference data for other tests
      await service.reorderSets([
        { code: a.code, displayOrder: a.displayOrder },
        { code: b.code, displayOrder: b.displayOrder },
      ]);
    }
  });

  it('reorderSets rejects unknown codes without changing anything', async () => {
    const res = await service.reorderSets([{ code: 'zzz-not-a-set', displayOrder: 999990 }]);
    expect(res.success).toBe(false);
  });

  it('reorderSets rejects duplicate target orders', async () => {
    const res = await service.reorderSets([
      { code: 'wtr', displayOrder: 999990 },
      { code: 'arc', displayOrder: 999990 },
    ]);
    expect(res.success).toBe(false);
    // Untouched
    const wtr = await service.getSetByCode('wtr');
    expect(wtr.success && wtr.data?.displayOrder !== 999990).toBe(true);
  });

  it('covers every set code present in printings (no orphan codes)', async () => {
    const res = await service.listSets();
    expect(res.success).toBe(true);
    if (!res.success) return;

    const { db } = await import('@/lib/postgres/db');
    const { printings } = await import('@/lib/postgres/schema');
    const { sql } = await import('drizzle-orm');
    const rows = await db.selectDistinct({ set: printings.set }).from(printings).orderBy(sql`1`);

    const known = new Set(res.data.map((s) => s.code));
    const orphans = rows.map((r) => r.set).filter((c) => c && !known.has(c));
    expect(orphans).toEqual([]);
  });
});
