/**
 * Pins migration 0112: `sets.legal_from` + `apply_provisional_legality()`.
 *
 * A set ingested from CardVault during spoiler season creates provisional
 * `cards` rows (fab_cube_card_id IS NULL) with every *_legal flag false, and
 * pipeline 005 never touches those columns (CARD_ADMIN_OWNED_COLS). So on
 * release day nothing makes the set constructed-legal until fab-cube adopts
 * the rows — IAR sat at 21/263 CC-legal cards. The function derives flags for
 * provisional, never-flagged cards once their set is legal:
 *   legal date = COALESCE(sets.legal_from, sets.release_date) <= today
 *   cc / ll      = not a young hero
 *   blitz        = not an adult hero
 *   silver age   = non-hero printed at common / rare / basic / token
 *   commoner     = common / basic / token, and not an adult hero
 * It is idempotent and runs nightly from 005 so future sets flip on their own.
 *
 * Runs against the local DB (POSTGRES_URL via vitest.setup.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/postgres/db';
import { cards, printings, sets } from '@/lib/postgres/schema';

const rand = crypto.randomUUID().slice(0, 6);
const legalSet = `zl${rand.slice(0, 3)}`;      // release_date +10 days, legal_from yesterday (the IAR case)
const releasedSet = `zr${rand.slice(0, 3)}`;   // release_date −30 days, legal_from NULL
const futureSet = `zu${rand.slice(0, 3)}`;     // release_date +10 days, legal_from NULL
const excludedSet = `ze${rand.slice(0, 3)}`;   // released, category excluded

const ids = {
  common: `test-pl-common-${rand}`,
  majestic: `test-pl-majestic-${rand}`,
  youngHero: `test-pl-young-${rand}`,
  adultHero: `test-pl-adult-${rand}`,
  released: `test-pl-released-${rand}`,
  future: `test-pl-future-${rand}`,
  excluded: `test-pl-excluded-${rand}`,
  adopted: `test-pl-adopted-${rand}`,
  curated: `test-pl-curated-${rand}`,
};
const allIds = Object.values(ids);
const printingIds: string[] = [];

const isoDaysFromNow = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const FLAGS = ['cc_legal', 'blitz_legal', 'silver_age_legal', 'll_legal', 'commoner_legal'] as const;
type Flags = Record<(typeof FLAGS)[number], boolean>;

async function flagsOf(cardUniqueId: string): Promise<Flags> {
  const r = await db.execute(sql`SELECT cc_legal, blitz_legal, silver_age_legal, ll_legal, commoner_legal FROM cards WHERE card_unique_id = ${cardUniqueId}`);
  return r.rows[0] as unknown as Flags;
}
const none: Flags = { cc_legal: false, blitz_legal: false, silver_age_legal: false, ll_legal: false, commoner_legal: false };

async function apply(): Promise<number> {
  const r = await db.execute(sql`SELECT apply_provisional_legality() AS n`);
  return Number((r.rows[0] as any).n);
}

beforeAll(async () => {
  const base = 800_000 + Math.floor(Math.random() * 1_000_000);
  await db.insert(sets).values([
    { code: legalSet, displayCode: legalSet.toUpperCase(), name: `Test Legal ${rand}`, releaseDate: isoDaysFromNow(10), legalFrom: isoDaysFromNow(-1), releaseOrder: base, displayOrder: base, category: 'standard' },
    { code: releasedSet, displayCode: releasedSet.toUpperCase(), name: `Test Released ${rand}`, releaseDate: isoDaysFromNow(-30), releaseOrder: base + 1, displayOrder: base + 1, category: 'standard' },
    { code: futureSet, displayCode: futureSet.toUpperCase(), name: `Test Future ${rand}`, releaseDate: isoDaysFromNow(10), releaseOrder: base + 2, displayOrder: base + 2, category: 'standard' },
    { code: excludedSet, displayCode: excludedSet.toUpperCase(), name: `Test Excluded ${rand}`, releaseDate: isoDaysFromNow(-30), releaseOrder: base + 3, displayOrder: base + 3, category: 'excluded' },
  ]);
  const card = (cardUniqueId: string, types: string[], extra: Record<string, unknown> = {}) => ({
    cardUniqueId, name: cardUniqueId, displayName: cardUniqueId, types, classes: ['merchant'], ...extra,
  });
  await db.insert(cards).values([
    card(ids.common, ['merchant', 'action']),
    card(ids.majestic, ['merchant', 'action']),
    card(ids.youngHero, ['merchant', 'hero', 'young'], { isHero: true }),
    card(ids.adultHero, ['merchant', 'hero'], { isHero: true }),
    card(ids.released, ['merchant', 'action']),
    card(ids.future, ['merchant', 'action']),
    card(ids.excluded, ['merchant', 'action']),
    card(ids.adopted, ['merchant', 'action'], { fabCubeCardId: `feed-${rand}` }),
    card(ids.curated, ['merchant', 'action'], { ccLegal: true }),
  ]);
  const mk = async (cardUniqueId: string, set: string, n: number, rarity: string) => {
    const id = nanoid(21);
    await db.insert(printings).values({ printingId: id, cardUniqueId, set, collectorNumber: `${set.toUpperCase()}${String(n).padStart(3, '0')}`, edition: 'n', foiling: 's', rarity, isFrontFace: true });
    printingIds.push(id);
  };
  await mk(ids.common, legalSet, 1, 'c');
  await mk(ids.majestic, legalSet, 2, 'm');
  await mk(ids.youngHero, legalSet, 3, 'b');
  await mk(ids.adultHero, legalSet, 4, 'm');
  await mk(ids.adopted, legalSet, 5, 'c');
  await mk(ids.curated, legalSet, 6, 'c');
  await mk(ids.released, releasedSet, 1, 'r');
  await mk(ids.future, futureSet, 1, 'c');
  await mk(ids.excluded, excludedSet, 1, 'c');
});

afterAll(async () => {
  if (printingIds.length) await db.delete(printings).where(inArray(printings.printingId, printingIds));
  await db.delete(cards).where(inArray(cards.cardUniqueId, allIds));
  await db.delete(sets).where(inArray(sets.code, [legalSet, releasedSet, futureSet, excludedSet]));
});

describe('migration 0112: sets.legal_from + apply_provisional_legality()', () => {
  it('derives flags for a common action once legal_from has passed, even before release_date', async () => {
    await apply();
    expect(await flagsOf(ids.common)).toEqual({ cc_legal: true, blitz_legal: true, silver_age_legal: true, ll_legal: true, commoner_legal: true });
  });

  it('majestics are constructed-legal but not Silver Age / Commoner', async () => {
    expect(await flagsOf(ids.majestic)).toEqual({ cc_legal: true, blitz_legal: true, silver_age_legal: false, ll_legal: true, commoner_legal: false });
  });

  it('young heroes are Blitz + Commoner only; adult heroes CC + LL only', async () => {
    expect(await flagsOf(ids.youngHero)).toEqual({ cc_legal: false, blitz_legal: true, silver_age_legal: false, ll_legal: false, commoner_legal: true });
    expect(await flagsOf(ids.adultHero)).toEqual({ cc_legal: true, blitz_legal: false, silver_age_legal: false, ll_legal: true, commoner_legal: false });
  });

  it('a released set with no legal_from falls back to release_date', async () => {
    expect((await flagsOf(ids.released)).cc_legal).toBe(true);
  });

  it('leaves future, excluded, adopted and admin-curated cards alone', async () => {
    expect(await flagsOf(ids.future)).toEqual(none);
    expect(await flagsOf(ids.excluded)).toEqual(none);
    expect(await flagsOf(ids.adopted)).toEqual(none);
    expect(await flagsOf(ids.curated)).toEqual({ ...none, cc_legal: true });
  });

  it('is idempotent — a second run touches nothing', async () => {
    expect(await apply()).toBe(0);
  });
});
