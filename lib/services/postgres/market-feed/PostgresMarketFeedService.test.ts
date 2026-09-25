/**
 * Integration tests for PostgresMarketFeedService (real local Docker DB).
 *
 * market_feed_listings holds a curated, anonymous daily feed of buy/sell
 * prices seen in Facebook groups (submitted by a superadmin MCP client).
 * One call carries a whole day: re-submitting the same date replaces it.
 *
 * Each test uses its own far-past feed_date so parallel runs can't collide.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/postgres/db';
import { marketFeedListings } from '@/lib/postgres/schema';
import { inArray } from 'drizzle-orm';
import { PostgresMarketFeedService } from './PostgresMarketFeedService';

const service = new PostgresMarketFeedService();

const usedDates: string[] = [];
// Random date in 1900-1999 — never a real feed day, unique per test.
const testDate = () => {
  const y = 1900 + Math.floor(Math.random() * 100);
  const m = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const d = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const date = `${y}-${m}-${d}`;
  usedDates.push(date);
  return date;
};

afterEach(async () => {
  if (usedDates.length) {
    await db.delete(marketFeedListings).where(inArray(marketFeedListings.feedDate, usedDates));
    usedDates.length = 0;
  }
});

describe('PostgresMarketFeedService', () => {
  it('stores a day and reads it back', async () => {
    const date = testDate();
    const saved = await service.replaceDay({
      feedDate: date,
      listings: [
        { side: 'selling', cardName: 'Command and Conquer', price: 12.5, groupName: 'FaB Buy/Sell/Trade' },
        { side: 'buying', cardName: 'Command and Conquer', price: 10 },
      ],
    });
    expect(saved.success).toBe(true);
    if (!saved.success) return;
    expect(saved.data.count).toBe(2);

    const day = await service.getDay(date);
    expect(day.success).toBe(true);
    if (!day.success) return;
    expect(day.data.feedDate).toBe(date);
    expect(day.data.listings).toHaveLength(2);
    const sell = day.data.listings.find((l) => l.side === 'selling')!;
    expect(sell.price).toBe(12.5);
    expect(sell.currency).toBe('USD');
    expect(sell.groupName).toBe('FaB Buy/Sell/Trade');
  });

  it('re-submitting the same date replaces that day only', async () => {
    const date = testDate();
    const other = testDate();
    await service.replaceDay({ feedDate: other, listings: [{ side: 'selling', cardName: 'Sink Below', pitch: 1, price: 1 }] });
    await service.replaceDay({ feedDate: date, listings: [{ side: 'selling', cardName: 'Sink Below', pitch: 1, price: 1 }] });
    await service.replaceDay({
      feedDate: date,
      listings: [
        { side: 'buying', cardName: 'Sink Below', pitch: 1, price: 2 },
        { side: 'buying', cardName: 'Sink Below', pitch: 2, price: 3 },
      ],
    });

    const day = await service.getDay(date);
    if (!day.success) throw new Error(day.error);
    expect(day.data.listings.map((l) => l.price).sort()).toEqual([2, 3]);

    const untouched = await service.getDay(other);
    if (!untouched.success) throw new Error(untouched.error);
    expect(untouched.data.listings).toHaveLength(1);
  });

  it('matches a card by name + pitch and reports ambiguous names as unmatched', async () => {
    const date = testDate();
    const saved = await service.replaceDay({
      feedDate: date,
      listings: [
        { side: 'selling', cardName: 'sink below', pitch: 1, price: 1 },
        // Three pitches share the name — without pitch we can't pick one.
        { side: 'selling', cardName: 'Sink Below', price: 1 },
        { side: 'selling', cardName: 'Not A Real Card Zzq', price: 1 },
      ],
    });
    if (!saved.success) throw new Error(saved.error);
    expect(saved.data.unmatched.sort()).toEqual(['Not A Real Card Zzq', 'Sink Below']);

    const day = await service.getDay(date);
    if (!day.success) throw new Error(day.error);
    const matched = day.data.listings.filter((l) => l.cardUniqueId);
    expect(matched).toHaveLength(1);
    expect(matched[0].pitch).toBe(1);
  });

  it('matches by collector number and shows TCG Low for the named foiling', async () => {
    const [ref] = (
      await db.execute<{ card_unique_id: string; tcg_low: number }>(
        `SELECT card_unique_id, MIN(tcg_low) AS tcg_low FROM printings
         WHERE collector_number = 'WTR171' AND language = 'en' AND foiling = 'r' AND tcg_low IS NOT NULL
         GROUP BY card_unique_id` as any
      )
    ).rows;
    expect(ref).toBeDefined();

    const date = testDate();
    const saved = await service.replaceDay({
      feedDate: date,
      listings: [{ side: 'selling', cardName: 'whatever the post said', collectorNumber: 'wtr171', foiling: 'Rainbow Foil', price: 5 }],
    });
    if (!saved.success) throw new Error(saved.error);
    expect(saved.data.unmatched).toEqual([]);

    const day = await service.getDay(date);
    if (!day.success) throw new Error(day.error);
    const l = day.data.listings[0];
    expect(l.cardUniqueId).toBe(ref.card_unique_id);
    expect(l.foiling).toBe('r');
    expect(l.tcgLow).toBeCloseTo(Number(ref.tcg_low), 2);
  });

  describe('card matching when name and collector number disagree', () => {
    const matchedName = async (listing: Record<string, unknown>) => {
      const date = testDate();
      const saved = await service.replaceDay({ feedDate: date, listings: [{ side: 'selling', price: 1, ...listing } as any] });
      if (!saved.success) throw new Error(saved.error);
      const day = await service.getDay(date);
      if (!day.success) throw new Error(day.error);
      return day.data.listings[0].displayName?.toLowerCase() ?? null;
    };

    it('a recognised name beats a collector number that belongs to another card', async () => {
      // ANQ018 is "That All You Got?" — the post named Ripple Away.
      expect(await matchedName({ cardName: 'Ripple Away', collectorNumber: 'ANQ018' })).toBe('ripple away');
    });

    it('an unrecognised (misspelt) name falls back to the collector number', async () => {
      expect(await matchedName({ cardName: 'Blasphomet, the Insatiable Hunger', collectorNumber: 'IAR221' }))
        .toBe('blasmophet, the insatiable hunger');
    });

    it('a collector number we do not have falls back to the name', async () => {
      expect(await matchedName({ cardName: 'Corrupted Corpse', collectorNumber: 'ZZZ999' })).toBe('corrupted corpse');
    });

    it('a collector number picks the pitch when the name alone is ambiguous', async () => {
      const date = testDate();
      await service.replaceDay({ feedDate: date, listings: [{ side: 'selling', price: 1, cardName: 'Snatch', collectorNumber: 'WTR169' }] });
      const day = await service.getDay(date);
      if (!day.success) throw new Error(day.error);
      expect(day.data.listings[0].pitch).toBe(3);
    });

    it('a "(Young)" suffix resolves to the young hero card', async () => {
      expect(await matchedName({ cardName: 'Malice, Domina of the Dead (Young)' })).toBe('malice');
      expect(await matchedName({ cardName: 'Viserai (Young)' })).toBe('viserai');
    });

    it('an "(Adult)" suffix resolves to the adult hero card', async () => {
      expect(await matchedName({ cardName: 'Malice, Domina of the Dead (Adult)' })).toBe('malice, domina of the dead');
    });
  });

  describe('post links', () => {
    const storedUrl = async (postUrl: string) => {
      const date = testDate();
      const saved = await service.replaceDay({
        feedDate: date,
        listings: [{ side: 'selling', cardName: 'Sink Below', pitch: 1, price: 1, postUrl }],
      });
      if (!saved.success) return { error: saved.error };
      const day = await service.getDay(date);
      if (!day.success) throw new Error(day.error);
      return { url: day.data.listings[0].postUrl };
    };

    it('stores a Facebook group post link', async () => {
      expect(await storedUrl('https://www.facebook.com/groups/123456/posts/7890/'))
        .toEqual({ url: 'https://www.facebook.com/groups/123456/posts/7890/' });
    });

    it('strips tracking parameters and fragments', async () => {
      expect(await storedUrl('https://www.facebook.com/groups/123456/posts/7890/?__cft__[0]=AZX&__tn__=%2CO%2CP-R&mibextid=abc#comments'))
        .toEqual({ url: 'https://www.facebook.com/groups/123456/posts/7890/' });
    });

    it('keeps only the post identifiers on permalink.php links', async () => {
      expect(await storedUrl('https://m.facebook.com/permalink.php?story_fbid=111&id=222&__cft__=x&ref=share'))
        .toEqual({ url: 'https://m.facebook.com/permalink.php?story_fbid=111&id=222' });
    });

    it('rejects links that are not https Facebook URLs', async () => {
      for (const bad of [
        'javascript:alert(1)',
        'http://www.facebook.com/groups/1/posts/2/',
        'https://facebook.com.evil.example/groups/1/posts/2/',
        'https://example.com/facebook.com/groups/1',
        'not a url',
      ]) {
        expect(await storedUrl(bad)).toHaveProperty('error');
      }
    });
  });

  it('rejects invalid listings without touching the stored day', async () => {
    const date = testDate();
    await service.replaceDay({ feedDate: date, listings: [{ side: 'selling', cardName: 'Sink Below', pitch: 1, price: 1 }] });

    for (const bad of [
      { side: 'trading', cardName: 'Sink Below', price: 1 },
      { side: 'selling', cardName: '  ', price: 1 },
      { side: 'selling', cardName: 'Sink Below', price: 0 },
      { side: 'selling', cardName: 'Sink Below', price: 1, foiling: 'sparkly' },
      { side: 'selling', cardName: 'Sink Below', price: 1, condition: 'mint-ish' },
    ]) {
      const res = await service.replaceDay({ feedDate: date, listings: [bad as any] });
      expect(res.success).toBe(false);
    }
    expect((await service.replaceDay({ feedDate: '2026-13-40', listings: [] })).success).toBe(false);

    const day = await service.getDay(date);
    if (!day.success) throw new Error(day.error);
    expect(day.data.listings).toHaveLength(1);
  });

  it('an empty list clears the day', async () => {
    const date = testDate();
    await service.replaceDay({ feedDate: date, listings: [{ side: 'selling', cardName: 'Sink Below', pitch: 1, price: 1 }] });
    const cleared = await service.replaceDay({ feedDate: date, listings: [] });
    expect(cleared.success).toBe(true);
    const day = await service.getDay(date);
    if (!day.success) throw new Error(day.error);
    expect(day.data.listings).toEqual([]);
  });

  it('lists the dates that have listings, newest first', async () => {
    const a = testDate();
    const b = testDate();
    await service.replaceDay({ feedDate: a, listings: [{ side: 'selling', cardName: 'Sink Below', pitch: 1, price: 1 }] });
    await service.replaceDay({
      feedDate: b,
      listings: [
        { side: 'selling', cardName: 'Sink Below', pitch: 1, price: 1 },
        { side: 'buying', cardName: 'Sink Below', pitch: 1, price: 1 },
      ],
    });
    const dates = await service.listDates(1000);
    if (!dates.success) throw new Error(dates.error);
    const mine = dates.data.filter((d) => d.feedDate === a || d.feedDate === b);
    expect(mine.find((d) => d.feedDate === b)?.count).toBe(2);
    expect(mine.find((d) => d.feedDate === a)?.count).toBe(1);
    const all = dates.data.map((d) => d.feedDate);
    expect([...all].sort().reverse()).toEqual(all);
  });
});
