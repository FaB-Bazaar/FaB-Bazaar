/**
 * Integration tests for PostgresFeedOverridesService (real local Docker DB).
 *
 * feed_overrides (migration 0095) stores manual corrections to the fab-cube
 * feed, applied by pipeline step 002 before price lookup. The service is the
 * admin-UI write path; the whitelist here must stay in sync with
 * ALLOWED_OVERRIDE_FIELDS in pipeline/scripts/002_tcg_price_enhancer.py.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/postgres/db';
import { feedOverrides } from '@/lib/postgres/schema';
import { inArray } from 'drizzle-orm';
import { PostgresFeedOverridesService, ALLOWED_FEED_OVERRIDE_FIELDS } from './PostgresFeedOverridesService';

const service = new PostgresFeedOverridesService();

// Unique collector numbers per test run so parallel files can't collide.
const collector = () => `ZF${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

const createdIds: string[] = [];
const track = <T extends { id: string }>(row: T): T => {
  createdIds.push(row.id);
  return row;
};

afterEach(async () => {
  if (createdIds.length) {
    await db.delete(feedOverrides).where(inArray(feedOverrides.id, createdIds));
    createdIds.length = 0;
  }
});

describe('PostgresFeedOverridesService', () => {
  it('exports the tcgplayer field whitelist', () => {
    expect(ALLOWED_FEED_OVERRIDE_FIELDS).toEqual([
      'tcgplayer_product_id',
      'tcgplayer_url',
      'tcgplayer_subtype_name',
    ]);
  });

  it('creates an override and lists it', async () => {
    const cn = collector();
    const created = await service.create({
      collectorNumber: cn,
      foiling: 'R',
      setFields: { tcgplayer_product_id: '632643' },
      reason: 'feed points at 1st Strike product',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    track(created.data);
    expect(created.data.collectorNumber).toBe(cn);
    expect(created.data.edition).toBeNull();
    expect(created.data.language).toBe('en');
    expect(created.data.active).toBe(true);

    const list = await service.list();
    expect(list.success).toBe(true);
    if (!list.success) return;
    const row = list.data.find((o) => o.id === created.data.id);
    expect(row).toBeDefined();
    expect(row!.setFields).toEqual({ tcgplayer_product_id: '632643' });
  });

  it('rejects setFields keys outside the whitelist', async () => {
    const result = await service.create({
      collectorNumber: collector(),
      setFields: { tcg_low: 0.01 } as Record<string, unknown>,
      reason: 'nope',
    });
    expect(result.success).toBe(false);
    if (result.success) {
      track(result.data);
      return;
    }
    expect(result.error).toMatch(/tcg_low/);
  });

  it('rejects empty setFields', async () => {
    const result = await service.create({
      collectorNumber: collector(),
      setFields: {},
      reason: 'nothing to set',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a duplicate match key (case-insensitive)', async () => {
    const cn = collector();
    const first = await service.create({
      collectorNumber: cn,
      foiling: 'R',
      setFields: { tcgplayer_product_id: '1' },
      reason: 'first',
    });
    expect(first.success).toBe(true);
    if (first.success) track(first.data);

    const dup = await service.create({
      collectorNumber: cn.toLowerCase(),
      foiling: 'r',
      setFields: { tcgplayer_product_id: '2' },
      reason: 'dup',
    });
    expect(dup.success).toBe(false);
    if (dup.success) track(dup.data);
  });

  it('updates reason, setFields, and active flag', async () => {
    const created = await service.create({
      collectorNumber: collector(),
      setFields: { tcgplayer_product_id: '1' },
      reason: 'before',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    track(created.data);

    const updated = await service.update(created.data.id, {
      reason: 'after',
      setFields: { tcgplayer_url: 'https://www.tcgplayer.com/product/632643' },
      active: false,
    });
    expect(updated.success).toBe(true);
    if (!updated.success) return;
    expect(updated.data.reason).toBe('after');
    expect(updated.data.setFields).toEqual({
      tcgplayer_url: 'https://www.tcgplayer.com/product/632643',
    });
    expect(updated.data.active).toBe(false);
  });

  it('update rejects non-whitelisted setFields', async () => {
    const created = await service.create({
      collectorNumber: collector(),
      setFields: { tcgplayer_product_id: '1' },
      reason: 'r',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    track(created.data);

    const updated = await service.update(created.data.id, {
      setFields: { rarity: 'L' } as Record<string, unknown>,
    });
    expect(updated.success).toBe(false);
  });

  it('deletes an override', async () => {
    const created = await service.create({
      collectorNumber: collector(),
      setFields: { tcgplayer_product_id: '1' },
      reason: 'r',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    track(created.data);

    const deleted = await service.delete(created.data.id);
    expect(deleted.success).toBe(true);

    const list = await service.list();
    expect(list.success).toBe(true);
    if (!list.success) return;
    expect(list.data.find((o) => o.id === created.data.id)).toBeUndefined();
  });

  it('update of a missing id fails cleanly', async () => {
    const result = await service.update('does-not-exist', { reason: 'x' });
    expect(result.success).toBe(false);
  });
});
