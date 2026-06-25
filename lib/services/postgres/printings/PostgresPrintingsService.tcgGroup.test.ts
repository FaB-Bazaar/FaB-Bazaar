/**
 * Integration test: getPrintingById surfaces the TCGplayer group (pack) a
 * printing belongs to — both the raw tcg_group_id and the joined group name.
 *
 * Motivating case: GEM cards all share the `gem` set code, but each belongs to a
 * specific seasonal "GEM Pack N" identified by its TCGplayer group id
 * (migration 0067). The read path must expose that so the UI can show the pack.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { db } from '@/lib/postgres/db';
import { printings } from '@/lib/postgres/schema';
import { eq } from 'drizzle-orm';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

// GEM Pack 5 — seeded into tcg_groups by migration 0067.
const GEM_PACK_5 = 24720;

describe('PostgresPrintingsService.getPrintingById — TCGplayer group', () => {
  let cardUniqueId: string;
  const testPrintingId = `test-tcggroup-${crypto.randomUUID()}`;

  beforeAll(async () => {
    // Anchor the test printing to a real card (FK target).
    const existing = await db
      .select({ cardUniqueId: printings.cardUniqueId })
      .from(printings)
      .where(eq(printings.set, 'gem'))
      .limit(1);
    if (existing.length === 0) throw new Error('no gem printing to borrow a card FK from');
    cardUniqueId = existing[0].cardUniqueId;
  });

  afterEach(async () => {
    await db.delete(printings).where(eq(printings.printingId, testPrintingId));
  });

  it('returns tcg_group_id and tcg_group_name for a printing in a group', async () => {
    await db.insert(printings).values({
      printingId: testPrintingId,
      cardUniqueId,
      set: 'gem',
      edition: 'n',
      foiling: 'r',
      rarity: 'p',
      collectorNumber: 'GEM149',
      tcgGroupId: GEM_PACK_5,
    });

    const res = await service.getPrintingById(testPrintingId);
    expect(res.success).toBe(true);
    if (!res.success || !res.data) throw new Error('printing not found');

    expect(res.data.tcg_group_id).toBe(GEM_PACK_5);
    expect(res.data.tcg_group_name).toBe('GEM Pack 5');
  });

  it('leaves tcg_group fields null for a printing with no group', async () => {
    await db.insert(printings).values({
      printingId: testPrintingId,
      cardUniqueId,
      set: 'gem',
      edition: 'n',
      foiling: 's',
      rarity: 'p',
      collectorNumber: 'GEM999',
      // tcgGroupId intentionally omitted
    });

    const res = await service.getPrintingById(testPrintingId);
    expect(res.success).toBe(true);
    if (!res.success || !res.data) throw new Error('printing not found');

    expect(res.data.tcg_group_id ?? null).toBeNull();
    expect(res.data.tcg_group_name ?? null).toBeNull();
  });
});
