/**
 * buildWarmTargets — the /opt query strings the nightly cache warm-up loads.
 * "Latest" sets are derived from the sets table at run time so the list never
 * goes stale on a new release.
 */
import { describe, it, expect } from 'vitest';
import { buildWarmTargets } from './warm-targets';
import { HERO_CLASSES } from '@/lib/fab-constants/classes';
import { OFFICIAL_TALENTS } from '@/lib/talent-constants';
import type { SetDTO } from '@/lib/services/contracts/ISetsService';

let order = 0;
const set = (code: string, category: SetDTO['category'], releaseDate: string | null): SetDTO => ({
  code, displayCode: code.toUpperCase(), name: code, releaseDate, releaseOrder: (order += 10), displayOrder: order,
  category, tier: 1, isCore: false, hasFirstEdition: false, unlimitedBeforeFirst: false, defaultRarity: null, imageId: null,
});

const SETS: SetDTO[] = [
  set('old', 'standard', '2020-01-01'),
  set('s1', 'standard', '2025-01-01'),
  set('s2', 'standard', '2025-06-01'),
  set('s3', 'standard', '2026-02-13'),
  set('s4', 'standard', '2026-02-13'),
  set('a1', 'armory', '2026-04-17'),
  set('s5', 'standard', '2026-06-05'),
  set('sa', 'non-standard', '2026-06-05'),
  set('a2', 'armory', '2026-08-07'),
  set('s6', 'standard', '2026-09-25'),
  set('a3', 'armory', '2026-09-25'),
  set('future', 'standard', '2026-12-01'),
  set('afuture', 'armory', '2027-01-01'),
  set('tba', 'standard', null),
];
const GEM_PACKS = [
  { groupId: 1, name: 'GEM Pack 1', count: 10 },
  { groupId: 5, name: 'GEM Pack 5', count: 10 },
];

const targets = buildWarmTargets({ sets: SETS, gemPacks: GEM_PACKS, today: '2026-09-26' });

describe('buildWarmTargets', () => {
  it('covers Generic and every hero class, default + rarity sort', () => {
    for (const c of ['generic', ...HERO_CLASSES]) {
      expect(targets).toContain(`classes=${c}`);
      expect(targets).toContain(`classes=${c}&sortBy=rarity`);
    }
  });

  it('covers every official talent, default + rarity sort', () => {
    for (const t of OFFICIAL_TALENTS) {
      expect(targets).toContain(`talents=${t}`);
      expect(targets).toContain(`talents=${t}&sortBy=rarity`);
    }
  });

  it('covers the class + talent pairs heroes play (hero pools)', () => {
    expect(targets).toContain('classes=ninja&talents=draconic');
    expect(targets).toContain('classes=ninja&talents=draconic&sortBy=rarity');
    expect(targets).toContain('classes=guardian&talents=elemental');
  });

  it('takes the five newest RELEASED standard sets, in three sorts each', () => {
    for (const code of ['s2', 's3', 's4', 's5', 's6']) {
      expect(targets).toContain(`sets=${code}`);
      expect(targets).toContain(`sets=${code}&sortBy=rarity`);
      expect(targets).toContain(`sets=${code}&sortBy=set`);
    }
    for (const code of ['s1', 'old', 'future', 'tba', 'sa']) {
      expect(targets).not.toContain(`sets=${code}`);
    }
  });

  it('covers the Armory group plus the two newest released Armory decks', () => {
    expect(targets).toContain('sets=grp%3Aarmory');
    expect(targets).toContain('sets=a3');
    expect(targets).toContain('sets=a2&sortBy=set');
    expect(targets).not.toContain('sets=a1');
    expect(targets).not.toContain('sets=afuture');
  });

  it('covers all of GEM and its newest pack', () => {
    expect(targets).toContain('sets=gem');
    expect(targets).toContain('sets=gem&pack=5&sortBy=rarity');
    expect(targets).not.toContain('sets=gem&pack=1');
  });

  it('skips GEM packs when none are listed', () => {
    const t = buildWarmTargets({ sets: SETS, gemPacks: [], today: '2026-09-26' });
    expect(t.some((q) => q.includes('pack='))).toBe(false);
  });

  it('has no duplicates', () => {
    expect(new Set(targets).size).toBe(targets.length);
  });
});
