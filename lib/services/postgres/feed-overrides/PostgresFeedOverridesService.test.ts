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

describe('artVariations discriminator (migration 0096)', () => {
  it('stores art variations uppercase and sorted', async () => {
    const created = await service.create({
      collectorNumber: collector(),
      foiling: 'R',
      artVariations: ['ds', 'aa'],
      setFields: { tcgplayer_product_id: '1' },
      reason: 'normalization',
    });
    expect(created.success).toBe(true);
    if (!created.success) return;
    track(created.data);
    expect(created.data.artVariations).toEqual(['AA', 'DS']);
  });

  it('allows AA / no-variant / wildcard overrides to coexist on one match key', async () => {
    const cn = collector();
    const base = {
      foiling: 'R',
      setFields: { tcgplayer_product_id: '1' },
      reason: 'coexist',
    };

    const aa = await service.create({ ...base, collectorNumber: cn, artVariations: ['AA'] });
    expect(aa.success).toBe(true);
    if (aa.success) track(aa.data);

    const none = await service.create({ ...base, collectorNumber: cn, artVariations: [] });
    expect(none.success).toBe(true);
    if (none.success) track(none.data);
    if (none.success) expect(none.data.artVariations).toEqual([]);

    const wildcard = await service.create({ ...base, collectorNumber: cn });
    expect(wildcard.success).toBe(true);
    if (wildcard.success) track(wildcard.data);
    if (wildcard.success) expect(wildcard.data.artVariations).toBeNull();
  });

  it('rejects a duplicate with the same art variations regardless of case/order', async () => {
    const cn = collector();
    const first = await service.create({
      collectorNumber: cn,
      foiling: 'R',
      artVariations: ['AA', 'DS'],
      setFields: { tcgplayer_product_id: '1' },
      reason: 'first',
    });
    expect(first.success).toBe(true);
    if (first.success) track(first.data);

    const dup = await service.create({
      collectorNumber: cn,
      foiling: 'r',
      artVariations: ['ds', 'Aa'],
      setFields: { tcgplayer_product_id: '2' },
      reason: 'dup',
    });
    expect(dup.success).toBe(false);
    if (dup.success) track(dup.data);
  });

  it('rejects blank art variation tokens', async () => {
    const result = await service.create({
      collectorNumber: collector(),
      artVariations: ['AA', '  '],
      setFields: { tcgplayer_product_id: '1' },
      reason: 'blank token',
    });
    expect(result.success).toBe(false);
    if (result.success) track(result.data);
  });
});

describe('upsertByMatchKey (admin PATCH auto-record)', () => {
  it('creates when no override matches the key', async () => {
    const cn = collector();
    const result = await service.upsertByMatchKey({
      collectorNumber: cn,
      edition: 'F',
      foiling: 'R',
      artVariations: ['AA'],
      setFields: { tcgplayer_product_id: '248564' },
      reason: 'manual admin edit',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    track(result.data);
    expect(result.data.collectorNumber).toBe(cn);
    expect(result.data.artVariations).toEqual(['AA']);
  });

  it('updates setFields/reason and reactivates when the key already exists', async () => {
    const cn = collector();
    const first = await service.upsertByMatchKey({
      collectorNumber: cn,
      edition: 'F',
      foiling: 'R',
      artVariations: ['AA'],
      setFields: { tcgplayer_product_id: '1' },
      reason: 'first pass',
    });
    expect(first.success).toBe(true);
    if (!first.success) return;
    track(first.data);
    const deactivated = await service.update(first.data.id, { active: false });
    expect(deactivated.success).toBe(true);

    const second = await service.upsertByMatchKey({
      collectorNumber: cn.toLowerCase(),
      edition: 'f',
      foiling: 'r',
      artVariations: ['aa'],
      setFields: { tcgplayer_product_id: '2' },
      reason: 'second pass',
    });
    expect(second.success).toBe(true);
    if (!second.success) return;
    // Same row, updated in place — not a duplicate-key failure.
    expect(second.data.id).toBe(first.data.id);
    expect(second.data.setFields).toEqual({ tcgplayer_product_id: '2' });
    expect(second.data.reason).toBe('second pass');
    expect(second.data.active).toBe(true);
  });

  it('treats wildcard (no artVariations) as its own upsert key', async () => {
    const cn = collector();
    const aa = await service.upsertByMatchKey({
      collectorNumber: cn,
      foiling: 'R',
      artVariations: ['AA'],
      setFields: { tcgplayer_product_id: '1' },
      reason: 'aa',
    });
    expect(aa.success).toBe(true);
    if (aa.success) track(aa.data);

    const wildcard = await service.upsertByMatchKey({
      collectorNumber: cn,
      foiling: 'R',
      setFields: { tcgplayer_product_id: '2' },
      reason: 'wildcard',
    });
    expect(wildcard.success).toBe(true);
    if (!wildcard.success) return;
    track(wildcard.data);
    expect(wildcard.data.id).not.toBe(aa.success ? aa.data.id : '');
  });
});
