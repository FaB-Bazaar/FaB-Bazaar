/**
 * Integration tests for PostgresPrintingsService.searchCardsForHero.
 *
 * Runs against local Postgres. Requires POSTGRES_URL in .env.local.
 *
 * Purpose: return ONE row per unique card (not per printing) for a hero's
 * legal card pool, with a representative printing chosen per card. Used by
 * the deck editor to ship the entire hero pool in a single small fetch
 * instead of preloading all printings per type chip.
 */

import { describe, it, expect } from 'vitest';
import { PostgresPrintingsService } from './PostgresPrintingsService';

const service = new PostgresPrintingsService();

describe('PostgresPrintingsService.searchCardsForHero', () => {
  it('returns cards for a hero class (Guardian / Bravo)', async () => {
    const result = await service.searchCardsForHero({ heroClasses: ['guardian'] });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Guardian has a large card pool; expect at least 30 unique cards
    expect(result.data.length).toBeGreaterThan(30);
  });

  it('returns at most one row per cardUniqueId (no printing duplicates)', async () => {
    const result = await service.searchCardsForHero({ heroClasses: ['guardian'] });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const ids = result.data.map((c) => c.cardUniqueId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('populates every required CardSummary field', async () => {
    const result = await service.searchCardsForHero({ heroClasses: ['guardian'] });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const sample = result.data[0];
    expect(sample.cardUniqueId).toBeTruthy();
    expect(typeof sample.name).toBe('string');
    expect(sample.name.length).toBeGreaterThan(0);
    expect(Array.isArray(sample.types)).toBe(true);
    expect(Array.isArray(sample.keywords)).toBe(true);
    expect(typeof sample.color).toBe('string');
    expect(typeof sample.representativePrintingId).toBe('string');
    expect(sample.representativePrintingId.length).toBeGreaterThan(0);
    expect(typeof sample.printingsCount).toBe('number');
    expect(sample.printingsCount).toBeGreaterThanOrEqual(1);
    // representativeImageUrl can be null for cards without art (rare)
    // pitch/cost/defense/power can be null for non-numeric cards (e.g. equipment)
  });

  it('representativePrintingId points to a real printing of that card', async () => {
    const result = await service.searchCardsForHero({ heroClasses: ['guardian'] });
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Pick a few sample cards and verify the representative printing actually
    // belongs to them (via the existing getPrintingsForCard method).
    const samples = result.data.slice(0, 3);
    for (const card of samples) {
      const printingsResult = await service.getPrintingsForCard(card.cardUniqueId);
      expect(printingsResult.success).toBe(true);
      if (!printingsResult.success) continue;

      const ids = printingsResult.data.printings.map((p) => p.printing_id);
      expect(ids).toContain(card.representativePrintingId);
      // printingsCount reflects ALL printings of this card (unfiltered),
      // matching what getPrintingsForCard returns
      expect(card.printingsCount).toBe(printingsResult.data.total);
    }
  });

  it('format filter narrows the result (CC subset is ≤ unrestricted)', async () => {
    const unrestricted = await service.searchCardsForHero({ heroClasses: ['guardian'] });
    const cc = await service.searchCardsForHero({ heroClasses: ['guardian'], format: 'cc' });

    expect(unrestricted.success).toBe(true);
    expect(cc.success).toBe(true);
    if (!unrestricted.success || !cc.success) return;

    // CC bans some cards, so CC pool ≤ unrestricted pool
    expect(cc.data.length).toBeLessThanOrEqual(unrestricted.data.length);
  });

  it('talent filter changes the pool (Light adds light-talent cards)', async () => {
    const guardianOnly = await service.searchCardsForHero({ heroClasses: ['guardian'] });
    const guardianLight = await service.searchCardsForHero({
      heroClasses: ['guardian'],
      heroTalents: ['light'],
    });

    expect(guardianOnly.success).toBe(true);
    expect(guardianLight.success).toBe(true);
    if (!guardianOnly.success || !guardianLight.success) return;

    // The light-talent pool should differ from class-only — either includes
    // light cards (more) or excludes non-light pure-guardian (depends on
    // precise-mode logic). Either way the sets are not identical.
    const onlyIds = new Set(guardianOnly.data.map((c) => c.cardUniqueId));
    const lightIds = new Set(guardianLight.data.map((c) => c.cardUniqueId));
    const symDiff = [...onlyIds].filter((id) => !lightIds.has(id)).length +
                    [...lightIds].filter((id) => !onlyIds.has(id)).length;
    expect(symDiff).toBeGreaterThan(0);
  });

  it('populates classes and talents arrays so the client can filter by class/talent chip', async () => {
    const result = await service.searchCardsForHero({ heroClasses: ['guardian'] });
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Every row must expose these as arrays (possibly empty for generics).
    for (const card of result.data) {
      expect(Array.isArray(card.classes)).toBe(true);
      expect(Array.isArray(card.talents)).toBe(true);
    }
    // At least one Guardian-locked card should report classes including "guardian".
    const hasGuardianClass = result.data.some((c) => c.classes.includes('guardian'));
    expect(hasGuardianClass).toBe(true);
  });

  it('handles an unknown hero class without throwing (generic cards still allowed)', async () => {
    const result = await service.searchCardsForHero({
      heroClasses: ['__nonexistent_class__'],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    // Generic cards still come through under "precise mode" because generic
    // is always allowed. Just assert it returns an array and didn't error.
    expect(Array.isArray(result.data)).toBe(true);
  });
});
