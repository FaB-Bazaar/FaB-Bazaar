/**
 * Integration tests (real local DB): registering and editing a set from
 * /admin/cardvault — the `sets` row, its TCGplayer groups (tcg_group_sets,
 * migration 0124) and its logo id. Fixture codes start with 'zz' (sets-sync
 * skips them) and are deleted after each test.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/postgres/db';
import { sets, tcgGroupSets } from '@/lib/postgres/schema';
import { inArray, like, sql } from 'drizzle-orm';
import { PostgresSetsService } from './PostgresSetsService';
import type { Result } from '../../contracts/common';
import type { SetFields } from '@/lib/sets/set-input';

const service = new PostgresSetsService();
const ok = <T>(r: Result<T>): T => { if (!r.success) throw new Error(r.error); return r.data; };
const codes: string[] = [];
const code = () => { const c = `zz${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`; codes.push(c); return c; };
const groupId = () => 900_000_000 + Math.floor(Math.random() * 90_000_000);

const fields = (c: string, over: Partial<SetFields> = {}): SetFields => ({
  code: c, displayCode: c.toUpperCase(), name: `Zz Test ${c}`, releaseDate: '2027-01-15', legalFrom: null,
  category: 'standard', tier: 1, hasFirstEdition: false, unlimitedBeforeFirst: false, inCardFilters: true,
  tcgGroups: [], ...over,
});

afterEach(async () => {
  if (!codes.length) return;
  await db.delete(tcgGroupSets).where(inArray(tcgGroupSets.setCode, codes));
  await db.delete(sets).where(inArray(sets.code, codes));
  codes.length = 0;
});

describe('PostgresSetsService.registerSet', () => {
  it('is newest in release order and ranks after its own tier for printing display', async () => {
    // display_order drives printing carousels (tier 1 → 2 → 5 → 3 → 4): a new
    // booster set must sort with the boosters, not after the armory decks.
    const [{ maxRelease, maxTier1 }] = (await db.execute(sql`
      SELECT max(release_order)::int AS "maxRelease",
             max(display_order) FILTER (WHERE tier = 1)::int AS "maxTier1"
        FROM sets WHERE code NOT LIKE 'zz%'`)).rows as any[];
    const c = code();
    const created = ok(await service.registerSet(fields(c)));
    expect(created).toMatchObject({ code: c, displayCode: c.toUpperCase(), releaseDate: '2027-01-15', category: 'standard', tier: 1, inCardFilters: true });
    expect(created.releaseOrder).toBeGreaterThan(maxRelease);
    expect(created.displayOrder).toBeGreaterThan(maxTier1);
    const [{ nextTier }] = (await db.execute(sql`
      SELECT min(display_order)::int AS "nextTier" FROM sets WHERE tier = 2 AND display_order > ${maxTier1}`)).rows as any[];
    expect(created.displayOrder).toBeLessThan(nextTier);
  });

  it('records the TCGplayer groups with the set', async () => {
    const c = code();
    const [g1, g2] = [groupId(), groupId()];
    ok(await service.registerSet(fields(c, { tcgGroups: [{ groupId: g1, name: 'Main group' }, { groupId: g2, name: 'Marvels group' }] })));
    const groups = ok(await service.listTcgGroupSets());
    expect(groups.filter((g) => g.setCode === c).map((g) => [g.groupId, g.setName]).sort())
      .toEqual([[g1, 'Main group'], [g2, 'Marvels group']].sort());
  });

  it('refuses a code that already exists, writing nothing', async () => {
    const c = code();
    ok(await service.registerSet(fields(c)));
    const again = await service.registerSet(fields(c, { name: 'Other', tcgGroups: [{ groupId: groupId(), name: 'g' }] }));
    expect(again.success).toBe(false);
    expect(!again.success && again.error).toMatch(/already/);
    expect((await db.select().from(tcgGroupSets).where(like(tcgGroupSets.setCode, c)))).toHaveLength(0);
  });
});

describe('PostgresSetsService.updateSet', () => {
  it('changes only the fields given, and can set the logo id', async () => {
    const c = code();
    ok(await service.registerSet(fields(c)));
    const updated = ok(await service.updateSet(c, { releaseDate: '2027-02-01', imageId: `set-${c}-logo` }));
    expect(updated).toMatchObject({ name: `Zz Test ${c}`, releaseDate: '2027-02-01', imageId: `set-${c}-logo`, tier: 1 });
  });

  it('adds TCGplayer groups without duplicating existing ones', async () => {
    const c = code();
    const g = groupId();
    ok(await service.registerSet(fields(c, { tcgGroups: [{ groupId: g, name: 'Main' }] })));
    ok(await service.updateSet(c, { tcgGroups: [{ groupId: g, name: 'Main' }, { groupId: g + 1, name: 'Second' }] }));
    const mine = ok(await service.listTcgGroupSets()).filter((x) => x.setCode === c);
    expect(mine.map((x) => x.groupId).sort()).toEqual([g, g + 1]);
  });

  it('reports an unknown set', async () => {
    const r = await service.updateSet('zz-missing', { name: 'x' });
    expect(r.success).toBe(false);
  });
});
