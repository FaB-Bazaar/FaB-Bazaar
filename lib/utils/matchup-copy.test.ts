import { describe, it, expect } from 'vitest';
import { getCopyTargets, buildCopiedMatchup } from './matchup-copy';

const heroes = [
  { talisharId: 'briar_warden_of_thorns', displayName: 'Briar' },
  { talisharId: 'katsu_the_wanderer',     displayName: 'Katsu' },
  { talisharId: 'benji_the_piercing_wind',displayName: 'Benji' },
  { talisharId: 'ira_crimson_haze',       displayName: 'Ira' },
];

const baseMatchup = {
  heroId: 'katsu_the_wanderer',
  preferredTurnOrder: 'Second' as const,
  notes: 'Pressure their hand',
  sideboard: { in: ['frost_red', 'frost_red'], out: ['poke_red', 'poke_red'] },
};

describe('getCopyTargets', () => {
  it('excludes the source hero', () => {
    const targets = getCopyTargets('katsu_the_wanderer', [baseMatchup], heroes);
    expect(targets.map(t => t.talisharId)).not.toContain('katsu_the_wanderer');
  });

  it('excludes heroes that already have a matchup', () => {
    const matchups = [
      baseMatchup,
      { ...baseMatchup, heroId: 'briar_warden_of_thorns' },
    ];
    const targets = getCopyTargets('katsu_the_wanderer', matchups, heroes);
    const ids = targets.map(t => t.talisharId);
    expect(ids).not.toContain('briar_warden_of_thorns');
    expect(ids).toContain('benji_the_piercing_wind');
    expect(ids).toContain('ira_crimson_haze');
  });

  it('returns empty when every other hero already has a matchup', () => {
    const matchups = heroes.map(h => ({ ...baseMatchup, heroId: h.talisharId }));
    const targets = getCopyTargets('katsu_the_wanderer', matchups, heroes);
    expect(targets).toEqual([]);
  });

  it('preserves the input order of remaining heroes', () => {
    const targets = getCopyTargets('katsu_the_wanderer', [baseMatchup], heroes);
    expect(targets.map(t => t.talisharId)).toEqual([
      'briar_warden_of_thorns',
      'benji_the_piercing_wind',
      'ira_crimson_haze',
    ]);
  });
});

describe('buildCopiedMatchup', () => {
  it('clones sideboard, notes, and turn order onto the target hero', () => {
    const copy = buildCopiedMatchup(baseMatchup, 'benji_the_piercing_wind');
    expect(copy).toEqual({
      heroId: 'benji_the_piercing_wind',
      preferredTurnOrder: 'Second',
      notes: 'Pressure their hand',
      sideboard: { in: ['frost_red', 'frost_red'], out: ['poke_red', 'poke_red'] },
    });
  });

  it('returns independent sideboard arrays (mutation safe)', () => {
    const copy = buildCopiedMatchup(baseMatchup, 'benji_the_piercing_wind');
    copy.sideboard.in.push('mutated');
    copy.sideboard.out.push('mutated');
    expect(baseMatchup.sideboard.in).toEqual(['frost_red', 'frost_red']);
    expect(baseMatchup.sideboard.out).toEqual(['poke_red', 'poke_red']);
  });

  it('handles null notes and null turn order', () => {
    const source = { ...baseMatchup, notes: null, preferredTurnOrder: null };
    const copy = buildCopiedMatchup(source, 'benji_the_piercing_wind');
    expect(copy.notes).toBeNull();
    expect(copy.preferredTurnOrder).toBeNull();
  });
});
