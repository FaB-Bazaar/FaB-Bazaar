/**
 * Unit tests for the canonical-filters → /opt deep-link mapper (Bridge A of
 * hybrid search): AI/MCP searches emit an /opt URL whose params hydrate the
 * same filters as editable chips. Param names must match opt-url-state.ts.
 */

import { describe, it, expect } from 'vitest';
import { filtersToOptParams, buildOptSearchUrl } from './filters-to-opt-url';

describe('filtersToOptParams', () => {
  it('maps the common facets to opt param names', () => {
    const p = filtersToOptParams({
      name: 'snatch',
      sets: ['wtr', 'arc'],
      rarities: ['m', 'l'],
      foilings: ['r'],
      editions: ['f'],
      classes: ['brute'],
      talents: ['shadow'],
      keywords: ['go again'],
      pitch: 1,
      format: 'cc',
      priceMin: 5,
      priceMax: 25,
      powerMin: 4,
      defenseMax: 3,
      costMin: 2,
    });

    expect(p.get('q')).toBe('snatch');
    expect(p.get('sets')).toBe('wtr,arc');
    expect(p.get('rarities')).toBe('m,l');
    expect(p.get('foilings')).toBe('r');
    expect(p.get('editions')).toBe('f');
    expect(p.get('classes')).toBe('brute');
    expect(p.get('talents')).toBe('shadow');
    expect(p.get('keywords')).toBe('go again');
    expect(p.get('pitch')).toBe('1');
    expect(p.get('format')).toBe('cc');
    expect(p.get('priceMin')).toBe('5');
    expect(p.get('priceMax')).toBe('25');
    expect(p.get('powerMin')).toBe('4');
    expect(p.get('defMax')).toBe('3');
    expect(p.get('costMin')).toBe('2');
  });

  it('maps text search to q + mode=text', () => {
    const p = filtersToOptParams({ text: 'create a frostbite' });
    expect(p.get('q')).toBe('create a frostbite');
    expect(p.get('mode')).toBe('text');
  });

  it('maps a single type; skips multi-type (no /opt chip equivalent)', () => {
    expect(filtersToOptParams({ types: ['equipment'] }).get('type')).toBe('equipment');
    expect(filtersToOptParams({ types: ['action', 'attack'] }).get('type')).toBeNull();
  });

  it('omits unmappable fields (hero expansions, negations, booleans) without error', () => {
    const p = filtersToOptParams({
      name: 'x',
      heroClasses: ['guardian'],
      heroTalents: ['elemental'],
      setsNot: ['1hp'],
      isExtendedArt: true,
    } as any);
    expect([...p.keys()].sort()).toEqual(['q']);
  });

  it('returns empty params for empty filters', () => {
    expect([...filtersToOptParams({}).keys()]).toEqual([]);
  });
});

describe('buildOptSearchUrl', () => {
  it('builds an absolute /opt URL from a base', () => {
    const url = buildOptSearchUrl({ name: 'pummel', pitch: 1 }, 'https://fabbazaar.app');
    expect(url).toBe('https://fabbazaar.app/opt?q=pummel&pitch=1');
  });

  it('returns a bare /opt URL when no filters map', () => {
    expect(buildOptSearchUrl({}, 'https://fabbazaar.app')).toBe('https://fabbazaar.app/opt');
  });
});

// Bare type-phrase searches ("red defense reactions") produce boolean type
// flags + color — map them to /opt chips so the deep link isn't a bare /opt.
describe('type-flag and color mapping', () => {
  it('maps boolean type flags to the /opt type chip slug', () => {
    expect(filtersToOptParams({ isDefenseReaction: true } as any).get('type')).toBe('defense-reaction');
    expect(filtersToOptParams({ isAttack: true } as any).get('type')).toBe('attack');
    expect(filtersToOptParams({ isInstant: true } as any).get('type')).toBe('instant');
    expect(filtersToOptParams({ isEquipment: true } as any).get('type')).toBe('equipment');
    expect(filtersToOptParams({ isWeapon: true } as any).get('type')).toBe('weapon');
  });

  it('normalizes a single multi-word types[] value to the chip slug', () => {
    expect(filtersToOptParams({ types: ['attack reaction'] } as any).get('type')).toBe('attack-reaction');
    expect(filtersToOptParams({ types: ['defense reaction'] } as any).get('type')).toBe('defense-reaction');
  });

  it('serializes a pitch array (multi-select OR) as csv', () => {
    expect(filtersToOptParams({ pitch: [1, 3] } as any).get('pitch')).toBe('1,3');
  });

  it('maps a color word to the pitch chip when pitch is absent (explicit pitch wins)', () => {
    expect(filtersToOptParams({ color: 'red' } as any).get('pitch')).toBe('1');
    expect(filtersToOptParams({ color: 'yellow' } as any).get('pitch')).toBe('2');
    expect(filtersToOptParams({ color: 'blue', pitch: 2 } as any).get('pitch')).toBe('2');
  });
});

describe('arcane deep-link params', () => {
  it('maps arcaneMin/arcaneMax to arcMin/arcMax', () => {
    const p = filtersToOptParams({ types: ['action'], arcaneMin: 3 });
    expect(p.get('arcMin')).toBe('3');
    expect(p.get('type')).toBe('non-attack-action');
  });

  it('an arcane-only search no longer produces a bare /opt link', () => {
    expect(buildOptSearchUrl({ arcaneMin: 3 }, 'https://fabbazaar.app'))
      .toBe('https://fabbazaar.app/opt?arcMin=3');
  });
});
