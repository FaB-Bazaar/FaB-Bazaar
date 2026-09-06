/**
 * Integration tests for hero legality admin methods on PostgresPrintingsService.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 *
 * Covers listHeroCards() and setHeroLegality(cardUniqueId, flag, value):
 * the surface backing the /admin/heroes superadmin page where format-legality
 * booleans (cc_legal / blitz_legal / silver_age_legal / commoner_legal / ll_legal)
 * are toggled per hero card.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { db } from '@/lib/postgres/db';
import { cards } from '@/lib/postgres/schema';
import { eq, sql } from 'drizzle-orm';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

type LegalityFlag = 'cc_legal' | 'blitz_legal' | 'silver_age_legal' | 'commoner_legal' | 'll_legal';
// Snapshot restores `types` too: the setHeroYoung tests toggle 'young' on a
// real hero, and without restoring it the last test leaves an ADULT hero typed
// young in the shared local DB (which then mis-derives Future CC / hero pickers).

describe('PostgresPrintingsService — hero legality admin', () => {
  let heroCardUniqueId: string;
  let nonHeroCardUniqueId: string;
  // Snapshot of the legality booleans we touched so afterEach can restore them.
  const snapshots = new Map<string, Record<LegalityFlag, boolean> & { types: string[] }>();

  beforeAll(async () => {
    const heroRow = await db
      .select({ id: cards.cardUniqueId })
      .from(cards)
      .where(sql`'hero' = ANY(${cards.types})`)
      .limit(1);
    expect(heroRow.length).toBe(1);
    heroCardUniqueId = heroRow[0].id;

    const nonHeroRow = await db
      .select({ id: cards.cardUniqueId })
      .from(cards)
      .where(sql`NOT ('hero' = ANY(${cards.types}))`)
      .limit(1);
    expect(nonHeroRow.length).toBe(1);
    nonHeroCardUniqueId = nonHeroRow[0].id;
  });

  afterEach(async () => {
    for (const [cardUniqueId, original] of snapshots) {
      await db
        .update(cards)
        .set({
          ccLegal: original.cc_legal,
          blitzLegal: original.blitz_legal,
          silverAgeLegal: original.silver_age_legal,
          commonerLegal: original.commoner_legal,
          llLegal: original.ll_legal,
          types: original.types,
        })
        .where(eq(cards.cardUniqueId, cardUniqueId));
    }
    snapshots.clear();
  });

  async function snapshot(cardUniqueId: string) {
    const row = await db
      .select({
        cc: cards.ccLegal,
        blitz: cards.blitzLegal,
        silver: cards.silverAgeLegal,
        commoner: cards.commonerLegal,
        ll: cards.llLegal,
        types: cards.types,
      })
      .from(cards)
      .where(eq(cards.cardUniqueId, cardUniqueId))
      .limit(1);
    snapshots.set(cardUniqueId, {
      types: row[0].types,
      cc_legal: row[0].cc,
      blitz_legal: row[0].blitz,
      silver_age_legal: row[0].silver,
      commoner_legal: row[0].commoner,
      ll_legal: row[0].ll,
    });
  }

  describe('listHeroCards', () => {
    it('returns hero cards with display name, image, types, class, and legality flags', async () => {
      const result = await service.listHeroCards();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.length).toBeGreaterThan(50);
      const sample = result.data[0];
      expect(sample).toHaveProperty('cardUniqueId');
      expect(sample).toHaveProperty('displayName');
      expect(sample).toHaveProperty('imageUrl');
      expect(sample).toHaveProperty('types');
      expect(sample.types).toContain('hero');
      expect(sample).toHaveProperty('ccLegal');
      expect(sample).toHaveProperty('blitzLegal');
      expect(sample).toHaveProperty('silverAgeLegal');
      expect(sample).toHaveProperty('commonerLegal');
      expect(sample).toHaveProperty('llLegal');
    });

    it('returns exactly one row per hero card (deduped by cardUniqueId)', async () => {
      const result = await service.listHeroCards();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const ids = result.data.map(h => h.cardUniqueId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('with legalIn=cc returns only heroes where ccLegal is true', async () => {
      const result = await service.listHeroCards({ legalIn: 'cc' });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every(h => h.ccLegal === true)).toBe(true);
    });

    it('with legalIn=silver_age returns only heroes where silverAgeLegal is true', async () => {
      const result = await service.listHeroCards({ legalIn: 'silver_age' });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every(h => h.silverAgeLegal === true)).toBe(true);
    });

    it('rejects an unknown legalIn value', async () => {
      const result = await service.listHeroCards({ legalIn: 'garbage' as any });
      expect(result.success).toBe(false);
    });

    it('sorts adults before young, then by class, then by display name', async () => {
      const result = await service.listHeroCards();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const youngStartIdx = result.data.findIndex(h => h.types.includes('young'));
      const lastAdultIdx = result.data.map(h => h.types.includes('young')).lastIndexOf(false);
      // All adults appear before any young hero
      expect(lastAdultIdx).toBeLessThan(youngStartIdx);

      // Within each age bucket, class is non-decreasing
      function classesNonDecreasing(rows: typeof result.data) {
        for (let i = 1; i < rows.length; i++) {
          const prev = rows[i - 1].klass ?? '';
          const curr = rows[i].klass ?? '';
          if (curr < prev) return false;
        }
        return true;
      }
      const adults = result.data.filter(h => !h.types.includes('young'));
      const young = result.data.filter(h => h.types.includes('young'));
      expect(classesNonDecreasing(adults)).toBe(true);
      expect(classesNonDecreasing(young)).toBe(true);
    });
  });

  describe('setHeroYoung', () => {
    it("adds 'young' to types when value=true", async () => {
      await snapshot(heroCardUniqueId);
      // Force a known starting state
      await db
        .update(cards)
        .set({ types: sql`array_remove(${cards.types}, 'young')` })
        .where(eq(cards.cardUniqueId, heroCardUniqueId));

      const result = await service.setHeroYoung(heroCardUniqueId, true);
      expect(result.success).toBe(true);

      const row = await db
        .select({ types: cards.types })
        .from(cards)
        .where(eq(cards.cardUniqueId, heroCardUniqueId))
        .limit(1);
      expect(row[0].types).toContain('young');
      // Original types preserved
      expect(row[0].types).toContain('hero');
    });

    it("removes 'young' from types when value=false", async () => {
      await snapshot(heroCardUniqueId);
      await db
        .update(cards)
        .set({ types: sql`array_append(array_remove(${cards.types}, 'young'), 'young')` })
        .where(eq(cards.cardUniqueId, heroCardUniqueId));

      const result = await service.setHeroYoung(heroCardUniqueId, false);
      expect(result.success).toBe(true);

      const row = await db
        .select({ types: cards.types })
        .from(cards)
        .where(eq(cards.cardUniqueId, heroCardUniqueId))
        .limit(1);
      expect(row[0].types).not.toContain('young');
      expect(row[0].types).toContain('hero');
    });

    it('is idempotent — setting young=true when already young leaves a single occurrence', async () => {
      await snapshot(heroCardUniqueId);
      await db
        .update(cards)
        .set({ types: sql`array_append(array_remove(${cards.types}, 'young'), 'young')` })
        .where(eq(cards.cardUniqueId, heroCardUniqueId));

      await service.setHeroYoung(heroCardUniqueId, true);

      const row = await db
        .select({ types: cards.types })
        .from(cards)
        .where(eq(cards.cardUniqueId, heroCardUniqueId))
        .limit(1);
      const youngCount = row[0].types.filter((t: string) => t === 'young').length;
      expect(youngCount).toBe(1);
    });

    it('rejects an unknown cardUniqueId', async () => {
      const result = await service.setHeroYoung('does-not-exist-21char-x', true);
      expect(result.success).toBe(false);
    });

    it('rejects a non-hero card', async () => {
      const result = await service.setHeroYoung(nonHeroCardUniqueId, true);
      expect(result.success).toBe(false);
    });
  });

  describe('setHeroLegality', () => {
    it('flips a single legality flag on a hero card and persists', async () => {
      await snapshot(heroCardUniqueId);
      const original = snapshots.get(heroCardUniqueId)!;
      const next = !original.cc_legal;

      const result = await service.setHeroLegality(heroCardUniqueId, 'cc_legal', next);
      expect(result.success).toBe(true);

      const row = await db
        .select({ cc: cards.ccLegal })
        .from(cards)
        .where(eq(cards.cardUniqueId, heroCardUniqueId))
        .limit(1);
      expect(row[0].cc).toBe(next);
    });

    it('rejects an unknown cardUniqueId', async () => {
      const result = await service.setHeroLegality('does-not-exist-21char-x', 'cc_legal', true);
      expect(result.success).toBe(false);
    });

    it('rejects a non-hero card (so we cannot flip legality on equipment etc.)', async () => {
      const result = await service.setHeroLegality(nonHeroCardUniqueId, 'cc_legal', true);
      expect(result.success).toBe(false);
    });

    it('rejects an unknown flag name', async () => {
      const result = await service.setHeroLegality(heroCardUniqueId, 'cc_banned' as LegalityFlag, true);
      expect(result.success).toBe(false);
    });
  });
});
