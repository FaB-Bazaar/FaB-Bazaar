/**
 * Integration test: card-summary representative printings must prefer English.
 *
 * searchCardsForHero (the QuickAdd dialog's hero-pool / type-chip browse) and
 * getCardSummariesByUniqueIds pick one representative printing per card via
 * DISTINCT ON. After the i18n backfill a card can have ja/fr/de/it printings
 * whose printing_id sorts before the English one, so without an explicit
 * language preference the pool surfaces foreign card faces (and QuickAdd's
 * quick-add would add a foreign printing). These tests pin: when an English
 * printing exists, it is the representative.
 *
 * Fixture: one isolated card with two printings identical in set/edition/
 * foiling/rarity, where the Japanese printing_id sorts FIRST lexicographically
 * — so any ordering without a language term would pick it.
 *
 * Runs against local Postgres (POSTGRES_URL in .env.local).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/postgres/db';
import { cards, printings } from '@/lib/postgres/schema';
import { eq } from 'drizzle-orm';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

const CARD_ID = `zzz-lang-test-${crypto.randomUUID().slice(0, 8)}`;
const TEST_CLASS = 'zzz-lang-test-class';
// 'aaa…' sorts before 'zzz…' — the ja printing wins every printing_id tiebreak
const JA_PRINTING_ID = `aaa-lang-ja-${crypto.randomUUID().slice(0, 8)}`;
const EN_PRINTING_ID = `zzz-lang-en-${crypto.randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  await db.insert(cards).values({
    cardUniqueId: CARD_ID,
    name: 'ZZZ Lang Test Card',
    displayName: 'ZZZ Lang Test Card',
    types: ['action'],
    classes: [TEST_CLASS],
    talents: [],
    pitch: 1,
  });
  const shared = {
    cardUniqueId: CARD_ID,
    set: 'wtr',
    edition: 'u',
    foiling: 's',
    rarity: 'c',
  };
  await db.insert(printings).values([
    { ...shared, printingId: JA_PRINTING_ID, language: 'ja', imageUrl: 'https://example.com/ja.webp' },
    { ...shared, printingId: EN_PRINTING_ID, language: 'en', imageUrl: 'https://example.com/en.webp' },
  ]);
});

afterAll(async () => {
  await db.delete(printings).where(eq(printings.cardUniqueId, CARD_ID));
  await db.delete(cards).where(eq(cards.cardUniqueId, CARD_ID));
});

describe('representative printing language preference', () => {
  it('searchCardsForHero picks the English printing as representative', async () => {
    const result = await service.searchCardsForHero({ heroClasses: [TEST_CLASS] });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const mine = result.data.find((c) => c.cardUniqueId === CARD_ID);
    expect(mine).toBeDefined();
    expect(mine!.representativePrintingId).toBe(EN_PRINTING_ID);
    expect(mine!.representativeImageUrl).toBe('https://example.com/en.webp');
    expect(mine!.printingsCount).toBe(2);
  });

  it('getCardSummariesByUniqueIds picks the English printing as representative', async () => {
    const result = await service.getCardSummariesByUniqueIds([CARD_ID]);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(1);
    expect(result.data[0].representativePrintingId).toBe(EN_PRINTING_ID);
    expect(result.data[0].representativeImageUrl).toBe('https://example.com/en.webp');
  });
});
