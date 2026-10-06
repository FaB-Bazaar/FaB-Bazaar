/**
 * Integration tests for PostgresCardVaultService (real local Docker DB).
 *
 * The /admin/cardvault ingest job's DB half: the CardVault payload cache
 * (migration 0122 — prod's root FS is read-only, so the CLI's disk cache
 * can't come along), the plan commit, and the image-upload bookkeeping.
 * Plans come from the real Viserai fixtures, re-keyed onto unique collector
 * numbers in a fake language ('zz') under the real `iar` code — a throwaway
 * set code would be an orphan to PostgresSetsService's coverage test, and a
 * throwaway `sets` row would break sets-sync.test.ts, when files run in parallel.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '@/lib/postgres/db';
import { cards, printings, cardvaultPayloadCache } from '@/lib/postgres/schema';
import { eq, inArray, like } from 'drizzle-orm';
import { planSetIngest, type SetIngestPlan } from '@/lib/import/plan-set-ingest';
import { PostgresCardVaultService } from './PostgresCardVaultService';
import type { Result } from '../../contracts/common';

const service = new PostgresCardVaultService();
const ok = <T>(r: Result<T>): T => { if (!r.success) throw new Error(r.error); return r.data; };
const FIXTURES = join(__dirname, '../../../import/__fixtures__/cardvault');
const SLUGS = ['viserai-the-forsaken--viserai-usurper', 'viserai-between-worlds--viserai-usurper'];
const payloads = new Map(SLUGS.map((s) => [s, JSON.parse(readFileSync(join(FIXTURES, `${s}.json`), 'utf8'))]));

const rand = () => crypto.randomUUID().replace(/-/g, '').slice(0, 8);

/** A fresh-set plan re-keyed under collector prefix `tag` (language zz) with unique talishar/lss keys. */
function isolatedPlan(tag: string): SetIngestPlan {
  const p = planSetIngest({
    set: 'IAR', setHasFirstEdition: false, familySlugs: SLUGS, payloads,
    existingPrintings: [], cardRows: [], mintId: () => `zzcv-${rand()}${rand()}`,
  });
  for (const c of [...p.newCards, ...p.enrichCards]) c.talishar_card_id = `${c.talishar_card_id}_${tag}`;
  for (const r of p.newPrintings) {
    r.language = 'zz';
    r.collector_number = `${tag}-${r.collector_number}`;
    r.lss_print_code = r.lss_print_code ? `${tag}-${r.lss_print_code}` : r.lss_print_code;
    r.lss_print_id = `${r.lss_print_id}-${tag}`;
  }
  return p;
}

const tags: string[] = [];
const newTag = () => { const t = `ZZCV${rand().toUpperCase()}`; tags.push(t); return t; };
const ownRows = (tag: string) => like(printings.collectorNumber, `${tag}-%`);
const cardIds: string[] = [];
const cacheSlugs: string[] = [];

afterEach(async () => {
  for (const t of tags) {
    const rows = await db.select({ c: printings.cardUniqueId }).from(printings).where(ownRows(t));
    cardIds.push(...rows.map((r) => r.c));
    await db.update(printings).set({ otherFacePrintingId: null }).where(ownRows(t));
    await db.delete(printings).where(ownRows(t));
  }
  if (cardIds.length) await db.delete(cards).where(inArray(cards.cardUniqueId, [...new Set(cardIds)]));
  if (cacheSlugs.length) await db.delete(cardvaultPayloadCache).where(inArray(cardvaultPayloadCache.slug, cacheSlugs));
  tags.length = 0; cardIds.length = 0; cacheSlugs.length = 0;
});

describe('PostgresCardVaultService payload cache', () => {
  it('round-trips payloads and overwrites on re-save', async () => {
    const slug = `zz-test-${rand()}`;
    cacheSlugs.push(slug);
    expect(ok(await service.getCachedPayloads([slug]))).toEqual({});
    await service.savePayload(slug, { v: 1 });
    await service.savePayload(slug, { v: 2 });
    expect(ok(await service.getCachedPayloads([slug, 'zz-missing']))).toEqual({ [slug]: { v: 2 } });
  });
});

describe('PostgresCardVaultService.getSet', () => {
  it('returns the set with its first-edition flag, null when unregistered', async () => {
    const iar = ok(await service.getSet('IAR'));
    expect(iar).toMatchObject({ code: 'iar', hasFirstEdition: false });
    expect(ok(await service.getSet('zz-nope'))).toBeNull();
  });
});

describe('PostgresCardVaultService.commitPlan', () => {
  it('inserts the plan and loadPlanContext then sees every row', async () => {
    const tag = newTag();
    const plan = isolatedPlan(tag);
    const commitRes = await service.commitPlan(plan);
    expect(commitRes.success).toBe(true);
    expect(ok(commitRes)).toMatchObject({ cardsCreated: 3, printingsCreated: plan.newPrintings.length });

    const ctx = ok(await service.loadPlanContext('iar', {
      lssCardIds: [],
      talisharIds: plan.newCards.map((c) => c.talishar_card_id),
    }));
    const seen = new Set(ctx.existingPrintings.map((r) => r.printing_id));
    expect(plan.newPrintings.every((r) => seen.has(r.printing_id))).toBe(true);
    expect(ctx.cardRows).toHaveLength(3);

    // face pairs land linked both ways
    const back = plan.newPrintings.find((r) => r.is_front_face === false)!;
    const [row] = await db.select().from(printings).where(eq(printings.printingId, back.printing_id));
    expect(row.otherFacePrintingId).toBe(back.other_face_printing_id);
  });

  it('enriches provisional cards only — never a fab-cube-anchored one', async () => {
    const tag = newTag();
    const plan = isolatedPlan(tag);
    await service.commitPlan(plan);
    const [anchored, provisional] = plan.newCards;
    await db.update(cards).set({ fabCubeCardId: `zzcv-anchor-${rand()}` }).where(eq(cards.cardUniqueId, anchored.card_unique_id));

    const res = ok(await service.commitPlan({
      ...plan, newCards: [], newPrintings: [], retroLinks: [],
      enrichCards: [{ ...anchored, name: 'zz changed' }, { ...provisional, name: 'zz changed' }],
    }));
    expect(res.cardsEnriched).toBe(1);
    const rows = await db.select({ id: cards.cardUniqueId, name: cards.name }).from(cards)
      .where(inArray(cards.cardUniqueId, [anchored.card_unique_id, provisional.card_unique_id]));
    expect(rows.find((r) => r.id === anchored.card_unique_id)!.name).not.toBe('zz changed');
    expect(rows.find((r) => r.id === provisional.card_unique_id)!.name).toBe('zz changed');
  });

  it('retro-links a back onto its front only when the front is unlinked', async () => {
    const tag = newTag();
    const plan = isolatedPlan(tag);
    await service.commitPlan(plan);
    const [a, b, c] = plan.newPrintings.filter((r) => r.is_front_face !== false);
    await db.update(printings).set({ otherFacePrintingId: null }).where(eq(printings.printingId, a.printing_id));

    const res = ok(await service.commitPlan({
      ...plan, newCards: [], enrichCards: [], newPrintings: [],
      retroLinks: [{ frontId: a.printing_id, backId: b.printing_id }, { frontId: c.printing_id, backId: b.printing_id }],
    }));
    expect(res.retroLinksSet).toBe(c.other_face_printing_id ? 1 : 2);
    const [row] = await db.select().from(printings).where(eq(printings.printingId, a.printing_id));
    expect(row.otherFacePrintingId).toBe(b.printing_id);
  });

  it('rolls back everything when one insert fails', async () => {
    const tag = newTag();
    const plan = isolatedPlan(tag);
    plan.newPrintings.push({ ...plan.newPrintings[0] }); // duplicate printing_id → PK violation
    const res = await service.commitPlan(plan);
    expect(res.success).toBe(false);
    const left = await db.select().from(printings).where(ownRows(tag));
    expect(left).toHaveLength(0);
    const leftCards = await db.select().from(cards)
      .where(like(cards.talisharCardId, `%${plan.newCards[0].talishar_card_id.split('_').pop()}`));
    expect(leftCards).toHaveLength(0);
  });
});

describe('PostgresCardVaultService image bookkeeping', () => {
  it('lists rows not yet on Cloudflare, with their collector-number universe, and records new urls', async () => {
    const tag = newTag();
    const plan = isolatedPlan(tag);
    await service.commitPlan(plan);
    const mine = new Set(plan.newPrintings.map((r) => r.printing_id));
    const pending = ok(await service.listPendingImageRows('iar'));
    const minePending = pending.pending.filter((r) => mine.has(r.printing_id));
    expect(minePending.map((r) => r.printing_id).sort())
      .toEqual(plan.newPrintings.filter((r) => r.image_url).map((r) => r.printing_id).sort());
    expect(pending.universe.length).toBeGreaterThanOrEqual(pending.pending.length);

    const target = minePending[0];
    await service.setImageUrl(target.printing_id, 'https://imagedelivery.net/x/zz/public');
    const after = ok(await service.listPendingImageRows('iar'));
    expect(after.pending.map((r) => r.printing_id)).not.toContain(target.printing_id);

    const all = ok(await service.listImageRows('iar'));
    expect(all.find((r) => r.printingId === target.printing_id)!.imageUrl)
      .toBe('https://imagedelivery.net/x/zz/public');
  });
});

describe('PostgresCardVaultService.listSets', () => {
  it('reports each set\'s image status across every language', async () => {
    const iar = async () => ok(await service.listSets()).find((s) => s.code === 'iar')!;
    const before = await iar();
    const plan = isolatedPlan(newTag());
    await service.commitPlan(plan);
    const after = await iar();
    const withImage = plan.newPrintings.filter((r) => r.image_url).length;
    expect(after.printings - before.printings).toBe(plan.newPrintings.length);
    expect(after.imagesNotOnCloudflare - before.imagesNotOnCloudflare).toBe(withImage);
    expect(after.imagesMissing - before.imagesMissing).toBe(plan.newPrintings.length - withImage);
    expect(after.enPrintings).toBe(before.enPrintings); // the fixture rows are language 'zz'
  });
});
