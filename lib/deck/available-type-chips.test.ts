import { describe, it, expect } from 'vitest';
import { availableTypeChips, poolTypeSet } from './available-type-chips';
import { TYPE_CHIPS } from '@/lib/search/card-filter-chips';

const chip = (apiType: string) => TYPE_CHIPS.find((c) => c.apiType === apiType)!;

describe('availableTypeChips', () => {
  it('returns every chip while the pool is unknown (null) so the facet never flashes empty', () => {
    expect(availableTypeChips(null)).toEqual(TYPE_CHIPS);
  });

  it('drops chips whose type has no card in the hero pool', () => {
    // Malice-shaped pool: actions, attacks, allies, equipment, zombies — no arrows/dragons/figments
    const pool = new Set(['action', 'attack', 'ally', 'equipment', 'zombie', 'aura', 'instant', 'generic', 'necromancer']);
    const out = availableTypeChips(pool);
    expect(out).toContain(chip('attack'));
    expect(out).toContain(chip('zombie'));
    expect(out).toContain(chip('aura'));
    expect(out).not.toContain(chip('arrow'));
    expect(out).not.toContain(chip('dragon'));
    expect(out).not.toContain(chip('figment'));
    expect(out).not.toContain(chip('invocation'));
  });

  it('keeps TYPE_CHIPS order', () => {
    const pool = new Set(['weapon', 'attack', 'trap']);
    expect(availableTypeChips(pool).map((c) => c.apiType)).toEqual(['attack', 'weapon', 'trap']);
  });

  it('an empty (loaded but hero-less) pool hides every chip', () => {
    expect(availableTypeChips(new Set())).toEqual([]);
  });
});

describe('poolTypeSet', () => {
  it('collects the lower-cased union of every card\'s types', () => {
    const set = poolTypeSet([{ types: ['Action', 'Attack'] }, { types: ['action', 'Aura'] }, { types: [] }]);
    expect([...set].sort()).toEqual(['action', 'attack', 'aura']);
  });
});
