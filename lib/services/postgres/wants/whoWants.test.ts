/**
 * Integration tests: "who wants" batch lookups (GET /api/whowants, the
 * spotlight card's "Who wants this" tab, the Discord bot's Who Wants command).
 * Both methods were unimplemented stubs.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, wantsItems } from '@/lib/postgres/schema';
import { PostgresWantsService } from './PostgresWantsService';

const service = new PostgresWantsService();

let cardId: string;          // a card with two printings
let p1: string, p2: string;  // its printings
let otherPrinting: string;   // a printing of a different card
let alice: string, bob: string;

beforeAll(async () => {
  const rows = await db.execute(sql`
    SELECT card_unique_id, array_agg(printing_id ORDER BY printing_id) AS ids
    FROM printings GROUP BY card_unique_id HAVING count(*) >= 2 ORDER BY card_unique_id LIMIT 1`);
  const row = (rows as unknown as { rows?: any[] }).rows?.[0] ?? (rows as any)[0];
  cardId = row.card_unique_id;
  [p1, p2] = row.ids;
  const other = await db.execute(sql`SELECT printing_id FROM printings WHERE card_unique_id <> ${cardId} ORDER BY printing_id LIMIT 1`);
  otherPrinting = ((other as any).rows?.[0] ?? (other as any)[0]).printing_id;
});

beforeEach(async () => {
  alice = crypto.randomUUID();
  bob = crypto.randomUUID();
  await db.insert(users).values([
    { id: alice, username: `test-a-${alice.slice(0, 8)}`, countryCode: 'US' },
    { id: bob, username: `test-b-${bob.slice(0, 8)}`, countryCode: 'CA' },
  ]);
  await db.insert(wantsItems).values([
    { id: crypto.randomUUID(), userId: alice, printingId: p1, quantity: 2, priority: 'high' },
    { id: crypto.randomUUID(), userId: alice, printingId: otherPrinting, quantity: 1 },
    { id: crypto.randomUUID(), userId: bob, printingId: p2, quantity: 1 },
  ]);
});

afterEach(async () => {
  await db.delete(users).where(inArray(users.id, [alice, bob]));
});

const mine = <T extends { user_id: string }>(list: T[]) => list.filter(w => w.user_id === alice || w.user_id === bob);

describe('getWhoWantsCards (any version)', () => {
  it('finds everyone wanting any printing of the card, listing only that card', async () => {
    const r = await service.getWhoWantsCards([cardId], {}, { skip: 0, limit: 100 });
    expect(r.success).toBe(true);
    if (!r.success) return;
    const found = mine(r.data.wanters);
    expect(found.map(w => w.user_id).sort()).toEqual([alice, bob].sort());
    const a = found.find(w => w.user_id === alice)!;
    expect(a.username).toBe(`test-a-${alice.slice(0, 8)}`);
    expect(a.wanted_cards.map(c => c.printing_id)).toEqual([p1]); // not the other card
    expect(a.total_cards_wanted).toBe(2);
    expect(a.high_priority_count).toBe(1);
    expect(r.data.summary.search_mode).toBe('all_versions');
  });

  it('filters by country', async () => {
    const r = await service.getWhoWantsCards([cardId], { country: 'CA' }, { skip: 0, limit: 100 });
    expect(r.success && mine(r.data.wanters).map(w => w.user_id)).toEqual([bob]);
  });
});

describe('getWhoWantsPrintings (exact printing)', () => {
  it('finds only the users wanting that printing', async () => {
    const r = await service.getWhoWantsPrintings([p1], {}, { skip: 0, limit: 100 });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(mine(r.data.wanters).map(w => w.user_id)).toEqual([alice]);
    expect(r.data.summary.search_mode).toBe('specific_printings');
  });

  it('pages over wanters (limit applies to users, not rows)', async () => {
    const all = await service.getWhoWantsCards([cardId], {}, { skip: 0, limit: 100 });
    const one = await service.getWhoWantsCards([cardId], {}, { skip: 0, limit: 1 });
    expect(all.success && one.success).toBe(true);
    if (!all.success || !one.success) return;
    expect(one.data.wanters).toHaveLength(1);
    expect(one.data.summary.total_wanters_found).toBe(all.data.summary.total_wanters_found);
    expect(one.data.summary.total_pages).toBe(all.data.summary.total_wanters_found);
  });
});
