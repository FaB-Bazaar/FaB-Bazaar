/**
 * Integration tests for PostgresFoilMaskService (real local Docker DB).
 *
 * foil_mask_templates + foil_mask_bulk_ops (migration 0100) back the admin
 * mask editor's template rail, its dry-run preview, and undo.
 *
 * Fixtures insert throwaway printings under a per-run set code and delete them
 * by explicit printing_id, so this file never mutates catalogue rows.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/postgres/db';
import { printings, foilMaskTemplates, foilMaskBulkOps } from '@/lib/postgres/schema';
import { eq, inArray } from 'drizzle-orm';
import { PostgresFoilMaskService } from './PostgresFoilMaskService';

const service = new PostgresFoilMaskService();

const MASK = { top: 10, right: 8, bottom: 30, left: 8, round: '2%' };

let cardUniqueId: string;
/** Per-run set code so parallel test files can never match each other's rows. */
let testSet: string;
const createdPrintingIds: string[] = [];
const createdTemplateIds: string[] = [];
const createdOpIds: string[] = [];

interface FixtureOpts {
  locked?: boolean;
  alreadySet?: boolean;
  isExtendedArt?: boolean;
  artVariations?: string[];
  foiling?: string;
  set?: string;
}

async function makePrinting(opts: FixtureOpts = {}): Promise<string> {
  const printingId = `zfm-${crypto.randomUUID().slice(0, 18)}`;
  await db.insert(printings).values({
    printingId,
    cardUniqueId,
    set: opts.set ?? testSet,
    edition: 'f',
    foiling: opts.foiling ?? 'r',
    rarity: 'c',
    isExtendedArt: opts.isExtendedArt ?? false,
    artVariations: opts.artVariations ?? [],
    foilInsetLocked: opts.locked ?? false,
    ...(opts.alreadySet
      ? { foilInsetTop: 99, foilInsetRight: 99, foilInsetBottom: 99, foilInsetLeft: 99, foilInsetRound: '9%' }
      : {}),
  });
  createdPrintingIds.push(printingId);
  return printingId;
}

async function readMask(printingId: string) {
  const [row] = await db
    .select({
      top: printings.foilInsetTop,
      right: printings.foilInsetRight,
      bottom: printings.foilInsetBottom,
      left: printings.foilInsetLeft,
      round: printings.foilInsetRound,
    })
    .from(printings)
    .where(eq(printings.printingId, printingId));
  return row;
}

beforeAll(async () => {
  const [card] = await db.select({ id: printings.cardUniqueId }).from(printings).limit(1);
  cardUniqueId = card.id;
});

beforeEach(() => {
  testSet = `zf${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`;
});

afterEach(async () => {
  if (createdOpIds.length) {
    await db.delete(foilMaskBulkOps).where(inArray(foilMaskBulkOps.id, createdOpIds));
    createdOpIds.length = 0;
  }
  if (createdTemplateIds.length) {
    await db.delete(foilMaskTemplates).where(inArray(foilMaskTemplates.id, createdTemplateIds));
    createdTemplateIds.length = 0;
  }
  if (createdPrintingIds.length) {
    await db.delete(printings).where(inArray(printings.printingId, createdPrintingIds));
    createdPrintingIds.length = 0;
  }
});

describe('PostgresFoilMaskService — apply to an explicit selection', () => {
  it('writes the mask to exactly the printings named and no others', async () => {
    const chosen = await makePrinting();
    const bystander = await makePrinting();

    const result = await service.applyToSelection([chosen], MASK, {});
    expect(result.success).toBe(true);
    if (!result.success) return;
    createdOpIds.push(result.data.opId);

    expect(result.data.updated).toBe(1);
    expect(await readMask(chosen)).toEqual(MASK);
    expect((await readMask(bystander)).bottom).toBeNull();
  });

  it('overwrites a printing that already has a mask', async () => {
    // Selection mode is the escape hatch from a bad bulk run: match mode only
    // touches unset rows, so without this there is no way to correct in bulk.
    const target = await makePrinting({ alreadySet: true });

    const result = await service.applyToSelection([target], MASK, {});
    expect(result.success).toBe(true);
    if (!result.success) return;
    createdOpIds.push(result.data.opId);

    expect(result.data.updated).toBe(1);
    expect(await readMask(target)).toEqual(MASK);
  });

  it('skips a locked printing even when it was explicitly selected', async () => {
    const locked = await makePrinting({ locked: true });
    const open = await makePrinting();

    const result = await service.applyToSelection([locked, open], MASK, {});
    expect(result.success).toBe(true);
    if (!result.success) return;
    createdOpIds.push(result.data.opId);

    expect(result.data.updated).toBe(1);
    expect(result.data.skippedLocked).toBe(1);
    expect((await readMask(locked)).bottom).toBeNull();
  });

  it('rejects an empty selection', async () => {
    const result = await service.applyToSelection([], MASK, {});
    expect(result.success).toBe(false);
  });
});

describe('PostgresFoilMaskService — preview before applying', () => {
  it('reports what a match would touch without writing anything', async () => {
    const unset = await makePrinting();
    const locked = await makePrinting({ locked: true });
    const already = await makePrinting({ alreadySet: true });

    const result = await service.previewMatch({ set: testSet, foiling: 'r', artVariations: [] });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.wouldUpdate).toBe(1);
    expect(result.data.skippedLocked).toBe(1);
    expect(result.data.skippedAlreadySet).toBe(1);

    // Nothing written.
    expect((await readMask(unset)).bottom).toBeNull();
    expect((await readMask(locked)).bottom).toBeNull();
    expect((await readMask(already)).bottom).toBe(99);
  });

  it('returns sample printings so the operator can eyeball the target set', async () => {
    await makePrinting();
    await makePrinting();

    const result = await service.previewMatch({ set: testSet, foiling: 'r', artVariations: [] });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.sample.length).toBe(2);
    expect(result.data.sample[0]).toHaveProperty('printingId');
    expect(result.data.sample[0]).toHaveProperty('name');
  });

  it('counts distinct sets so a cross-set sweep announces its breadth', async () => {
    // A set-less match is the "apply globally" case. Scoped here by a
    // fixture-only foiling code so the sweep can span sets without matching
    // any catalogue row.
    const foiling = `zf${crypto.randomUUID().replace(/-/g, '').slice(0, 4)}`;
    const otherSet = `zf${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`;
    await makePrinting({ foiling });
    await makePrinting({ foiling, set: otherSet });

    const result = await service.previewMatch({ foiling, artVariations: [] });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.wouldUpdate).toBe(2);
    expect(result.data.setCount).toBe(2);
  });
});

describe('PostgresFoilMaskService — apply to a match', () => {
  it('writes only to unset, unlocked printings', async () => {
    const unset = await makePrinting();
    const locked = await makePrinting({ locked: true });
    const already = await makePrinting({ alreadySet: true });

    const result = await service.applyToMatch({ set: testSet, foiling: 'r', artVariations: [] }, MASK, {});
    expect(result.success).toBe(true);
    if (!result.success) return;
    createdOpIds.push(result.data.opId);

    expect(result.data.updated).toBe(1);
    expect(await readMask(unset)).toEqual(MASK);
    expect((await readMask(locked)).bottom).toBeNull();
    expect((await readMask(already)).bottom).toBe(99);
  });

  it('matches art variations exactly, not by overlap', async () => {
    const plain = await makePrinting({ artVariations: [] });
    const ea = await makePrinting({ artVariations: ['EA'], isExtendedArt: true });

    const result = await service.applyToMatch(
      { set: testSet, foiling: 'r', artVariations: ['EA'], isExtendedArt: true },
      MASK,
      {}
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    createdOpIds.push(result.data.opId);

    expect(result.data.updated).toBe(1);
    expect(await readMask(ea)).toEqual(MASK);
    expect((await readMask(plain)).bottom).toBeNull();
  });
});

describe('PostgresFoilMaskService — undo', () => {
  it('restores prior values, including printings that had no mask at all', async () => {
    const wasUnset = await makePrinting();
    const wasSet = await makePrinting({ alreadySet: true });

    const applied = await service.applyToSelection([wasUnset, wasSet], MASK, {});
    expect(applied.success).toBe(true);
    if (!applied.success) return;
    createdOpIds.push(applied.data.opId);
    expect(await readMask(wasUnset)).toEqual(MASK);

    const undone = await service.undoOp(applied.data.opId);
    expect(undone.success).toBe(true);
    if (!undone.success) return;

    expect(undone.data.restored).toBe(2);
    expect((await readMask(wasUnset)).bottom).toBeNull();
    expect(await readMask(wasSet)).toEqual({ top: 99, right: 99, bottom: 99, left: 99, round: '9%' });
  });

  it('refuses to undo the same op twice', async () => {
    const target = await makePrinting();
    const applied = await service.applyToSelection([target], MASK, {});
    expect(applied.success).toBe(true);
    if (!applied.success) return;
    createdOpIds.push(applied.data.opId);

    expect((await service.undoOp(applied.data.opId)).success).toBe(true);
    const second = await service.undoOp(applied.data.opId);
    expect(second.success).toBe(false);
  });

  it('lists recent ops newest first with their undone state', async () => {
    const a = await makePrinting();
    const b = await makePrinting();

    const first = await service.applyToSelection([a], MASK, { description: 'first op' });
    const second = await service.applyToSelection([b], MASK, { description: 'second op' });
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    createdOpIds.push(first.data.opId, second.data.opId);

    await service.undoOp(first.data.opId);

    const ops = await service.listOps(50);
    expect(ops.success).toBe(true);
    if (!ops.success) return;

    const mine = ops.data.filter(o => o.id === first.data.opId || o.id === second.data.opId);
    expect(mine[0].id).toBe(second.data.opId);
    expect(mine.find(o => o.id === first.data.opId)?.undoneAt).not.toBeNull();
    expect(mine.find(o => o.id === second.data.opId)?.undoneAt).toBeNull();
  });
});

describe('PostgresFoilMaskService — templates', () => {
  it('lists the presets seeded by migration 0100 in sort order', async () => {
    const result = await service.listTemplates();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const names = result.data.map(t => t.name);
    expect(names).toContain('Standard frame — WTR');
    expect(names).toContain('Full art / hero');

    const orders = result.data.map(t => t.sortOrder);
    expect([...orders].sort((x, y) => x - y)).toEqual(orders);
  });

  it('creates, renames and deletes a template', async () => {
    const created = await service.createTemplate({ name: `zz-tpl-${crypto.randomUUID().slice(0, 8)}`, ...MASK });
    expect(created.success).toBe(true);
    if (!created.success) return;
    createdTemplateIds.push(created.data.id);

    expect(created.data.bottom).toBe(MASK.bottom);

    const renamed = await service.updateTemplate(created.data.id, { name: `zz-renamed-${crypto.randomUUID().slice(0, 8)}` });
    expect(renamed.success).toBe(true);
    if (!renamed.success) return;
    expect(renamed.data.name).toContain('zz-renamed');

    const deleted = await service.deleteTemplate(created.data.id);
    expect(deleted.success).toBe(true);
  });

  it('rejects a duplicate template name regardless of case', async () => {
    const name = `zz-dup-${crypto.randomUUID().slice(0, 8)}`;
    const first = await service.createTemplate({ name, ...MASK });
    expect(first.success).toBe(true);
    if (!first.success) return;
    createdTemplateIds.push(first.data.id);

    const second = await service.createTemplate({ name: name.toUpperCase(), ...MASK });
    expect(second.success).toBe(false);
    if (second.success) return;
    // The operator needs to be told the name is taken, not handed a generic
    // failure — the unique violation arrives on the pg error's `cause`, not on
    // the drizzle wrapper's message.
    expect(second.error).toBe('A template with that name already exists');
  });
});
