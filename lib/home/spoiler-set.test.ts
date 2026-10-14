import { describe, it, expect } from 'vitest';
import { pickSpoilerSet } from './spoiler-set';

const set = (over: Record<string, unknown>) => ({
  code: 'x', name: 'X', releaseDate: null, category: 'standard', tier: 1, imageId: null, ...over,
}) as any;

describe('pickSpoilerSet', () => {
  const today = '2026-10-14';

  it('picks the soonest upcoming main booster set (tier 1, standard)', () => {
    const picked = pickSpoilerSet([
      set({ code: 'iar', name: 'Usurp the Shadow Throne', releaseDate: '2026-09-25' }),
      set({ code: 'mpa', name: 'Mastery Pack Assassin', releaseDate: '2026-11-13', tier: 2 }),
      set({ code: 'zzz', name: 'Later Set', releaseDate: '2027-06-01' }),
      set({ code: 'obk', name: 'Outbreak', releaseDate: '2027-02-12', imageId: 'set-obk-logo' }),
    ], today);
    expect(picked).toEqual({ code: 'obk', name: 'Outbreak', releaseDate: '2027-02-12', imageId: 'set-obk-logo' });
  });

  it('ignores released, undated, excluded and non-booster sets', () => {
    expect(pickSpoilerSet([
      set({ code: 'old', releaseDate: '2026-10-14' }), // releases today = no longer a spoiler
      set({ code: 'tba', releaseDate: null }),
      set({ code: 'demo', releaseDate: '2027-01-01', category: 'excluded' }),
      set({ code: 'deck', releaseDate: '2027-01-01', category: 'non-standard', tier: 3 }),
    ], today)).toBeNull();
  });
});
