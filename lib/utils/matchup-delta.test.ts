import { describe, it, expect } from 'vitest';
import { computeMatchupDelta } from './matchup-delta';

describe('computeMatchupDelta', () => {
  it('returns hero swaps unchanged when core is empty', () => {
    const delta = computeMatchupDelta(
      { in: [], out: [] },
      { in: ['frost_red'], out: ['poke_red'] }
    );
    expect(delta).toEqual({ in: ['frost_red'], out: ['poke_red'] });
  });

  it('returns empty when hero matches core exactly', () => {
    const delta = computeMatchupDelta(
      { in: ['shock_red', 'shock_red'], out: ['poke_red', 'poke_red'] },
      { in: ['shock_red', 'shock_red'], out: ['poke_red', 'poke_red'] }
    );
    expect(delta).toEqual({ in: [], out: [] });
  });

  it('returns only the additional swaps the hero plan needs beyond core', () => {
    // core: -2 poke, +2 shock
    // hero: -2 poke, +2 shock, -1 jab, +1 frost
    const delta = computeMatchupDelta(
      { in: ['shock_red', 'shock_red'], out: ['poke_red', 'poke_red'] },
      { in: ['shock_red', 'shock_red', 'frost_red'], out: ['poke_red', 'poke_red', 'jab_red'] }
    );
    expect(delta.in.sort()).toEqual(['frost_red']);
    expect(delta.out.sort()).toEqual(['jab_red']);
  });

  it('treats multiset counts correctly when core has more copies than hero', () => {
    // core: +2 shock; hero: +1 shock → hero has one fewer "in" than core
    // delta.in: hero.in minus core.in = (1) - (2) = empty (cannot go negative)
    // but hero ALSO needs to undo one of core's shock additions, so delta.out includes 'shock_red' once
    const delta = computeMatchupDelta(
      { in: ['shock_red', 'shock_red'], out: ['poke_red', 'poke_red'] },
      { in: ['shock_red'], out: ['poke_red'] }
    );
    expect(delta.in.sort()).toEqual(['poke_red']);
    expect(delta.out.sort()).toEqual(['shock_red']);
  });

  it('handles disjoint card sets — undoes core and applies hero', () => {
    // core does +a, −b; hero does +c, −d.
    // To go from "core-applied deck" to "hero-applied deck": undo core (+b, −a) and apply hero (+c, −d).
    const delta = computeMatchupDelta(
      { in: ['a'], out: ['b'] },
      { in: ['c'], out: ['d'] }
    );
    expect(delta.in.sort()).toEqual(['b', 'c']);
    expect(delta.out.sort()).toEqual(['a', 'd']);
  });
});
