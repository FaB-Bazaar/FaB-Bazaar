import { describe, expect, it } from 'vitest';
import { computeCardPool, capForCard, buildKitOptions, formatSetCollector, sortPoolCards } from './card-pool';
import type { PoolCard } from './card-pool';
import type { CuratedListDTO, CuratedListCardDTO } from '@/lib/services/contracts/ICuratedListService';

function card(overrides: Partial<CuratedListCardDTO> & { cardUniqueId: string; displayName: string }): CuratedListCardDTO {
  return {
    id: Math.random().toString(36),
    listId: 'list-x',
    printingId: `p-${overrides.cardUniqueId}`,
    sortOrder: 0,
    comment: null,
    ...overrides,
  } as CuratedListCardDTO;
}

function list(id: string, name: string, cards: CuratedListCardDTO[]): CuratedListDTO {
  return {
    id,
    name,
    description: null,
    heroName: 'test',
    className: null,
    format: 'Classic Constructed',
    tags: [],
    isPublished: true,
    sortOrder: 0,
    parentId: null,
    variantType: null,
    createdBy: null,
    curatorUser: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    cards,
  };
}

describe('capForCard', () => {
  it('caps weapons at 2', () => {
    expect(capForCard({ types: ['weapon'] })).toBe(2);
  });

  it('caps non-weapon non-evo equipment at 1', () => {
    expect(capForCard({ types: ['equipment', 'chest'] })).toBe(1);
  });

  it('caps evo equipment at 3', () => {
    expect(capForCard({ types: ['equipment', 'evo', 'arms'] })).toBe(3);
  });

  it('caps regular action cards at 3', () => {
    expect(capForCard({ types: ['action', 'attack'] })).toBe(3);
  });

  it('defaults to 3 when types unknown', () => {
    expect(capForCard({})).toBe(3);
  });
});

describe('computeCardPool', () => {
  it('deduplicates cards across lists by cardUniqueId', () => {
    const lists = [
      list('l1', 'Core', [
        card({ cardUniqueId: 'cu1', displayName: 'Surging Strike', rarity: 'r', types: ['action', 'attack'] }),
        card({ cardUniqueId: 'cu1', displayName: 'Surging Strike', rarity: 'r', types: ['action', 'attack'] }),
      ]),
      list('l2', 'Upgrades', [
        card({ cardUniqueId: 'cu1', displayName: 'Surging Strike', rarity: 'r', types: ['action', 'attack'] }),
      ]),
    ];
    const pool = computeCardPool(lists);
    expect(pool.cards).toHaveLength(1);
    expect(pool.cards[0].cardUniqueId).toBe('cu1');
    expect(pool.cards[0].rawCount).toBe(3);
  });

  it('applies cap: raw 4 copies of a regular action → capped at 3', () => {
    const lists = [
      list('l1', 'A', [
        card({ cardUniqueId: 'cu1', displayName: 'X', rarity: 'c', types: ['action'] }),
        card({ cardUniqueId: 'cu1', displayName: 'X', rarity: 'c', types: ['action'] }),
        card({ cardUniqueId: 'cu1', displayName: 'X', rarity: 'c', types: ['action'] }),
        card({ cardUniqueId: 'cu1', displayName: 'X', rarity: 'c', types: ['action'] }),
      ]),
    ];
    const pool = computeCardPool(lists);
    expect(pool.cards[0].rawCount).toBe(4);
    expect(pool.cards[0].cappedCount).toBe(3);
    expect(pool.cards[0].cap).toBe(3);
  });

  it('equipment cap = 1 even if multiple kits include it', () => {
    const lists = [
      list('l1', 'A', [card({ cardUniqueId: 'eq', displayName: 'Shock Charmers', rarity: 's', types: ['equipment', 'arms'] })]),
      list('l2', 'B', [card({ cardUniqueId: 'eq', displayName: 'Shock Charmers', rarity: 's', types: ['equipment', 'arms'] })]),
    ];
    const pool = computeCardPool(lists);
    expect(pool.cards[0].rawCount).toBe(2);
    expect(pool.cards[0].cappedCount).toBe(1);
  });

  it('weapon cap = 2', () => {
    const lists = [
      list('l1', 'A', [
        card({ cardUniqueId: 'w', displayName: 'Dawnblade', rarity: 'l', types: ['weapon', '1h'] }),
        card({ cardUniqueId: 'w', displayName: 'Dawnblade', rarity: 'l', types: ['weapon', '1h'] }),
        card({ cardUniqueId: 'w', displayName: 'Dawnblade', rarity: 'l', types: ['weapon', '1h'] }),
      ]),
    ];
    const pool = computeCardPool(lists);
    expect(pool.cards[0].cappedCount).toBe(2);
  });

  it('evo equipment cap = 3', () => {
    const lists = [
      list('l1', 'A', [
        card({ cardUniqueId: 'evo1', displayName: 'Evo Smoothbore', rarity: 'r', types: ['equipment', 'evo', 'arms'] }),
        card({ cardUniqueId: 'evo1', displayName: 'Evo Smoothbore', rarity: 'r', types: ['equipment', 'evo', 'arms'] }),
        card({ cardUniqueId: 'evo1', displayName: 'Evo Smoothbore', rarity: 'r', types: ['equipment', 'evo', 'arms'] }),
      ]),
    ];
    const pool = computeCardPool(lists);
    expect(pool.cards[0].cappedCount).toBe(3);
  });

  it('records source lists with per-list counts and heroName', () => {
    const l1 = list('l1', 'Core', [
      card({ cardUniqueId: 'cu1', displayName: 'X', rarity: 'c', types: ['action'] }),
      card({ cardUniqueId: 'cu1', displayName: 'X', rarity: 'c', types: ['action'] }),
    ]);
    l1.heroName = 'Kano';
    const l2 = list('l2', 'Budget', [
      card({ cardUniqueId: 'cu1', displayName: 'X', rarity: 'c', types: ['action'] }),
    ]);
    l2.heroName = 'Iyslander';
    const pool = computeCardPool([l1, l2]);
    expect(pool.cards[0].sources).toEqual([
      { listId: 'l1', listName: 'Core', heroName: 'Kano', count: 2 },
      { listId: 'l2', listName: 'Budget', heroName: 'Iyslander', count: 1 },
    ]);
  });

  it('filters to a single list when listIdFilter is provided', () => {
    const lists = [
      list('l1', 'Core', [card({ cardUniqueId: 'a', displayName: 'A', rarity: 'c', types: ['action'] })]),
      list('l2', 'Budget', [card({ cardUniqueId: 'b', displayName: 'B', rarity: 'c', types: ['action'] })]),
    ];
    const pool = computeCardPool(lists, { listIdFilter: 'l1' });
    expect(pool.cards.map(c => c.cardUniqueId)).toEqual(['a']);
  });

  it('prefixes kit option labels with hero when lists span multiple heroes', () => {
    const l1 = { ...list('l1', 'Core', []), heroName: 'katsu-the-wanderer' };
    const l2 = { ...list('l2', 'Boost Core', []), heroName: 'dash-io' };
    expect(buildKitOptions([l1, l2])).toEqual([
      { id: 'l1', label: 'katsu-the-wanderer · Core' },
      { id: 'l2', label: 'dash-io · Boost Core' },
    ]);
  });

  it('omits hero prefix when all kits share a single hero', () => {
    const l1 = { ...list('l1', 'Core', []), heroName: 'katsu-the-wanderer' };
    const l2 = { ...list('l2', 'Budget', []), heroName: 'katsu-the-wanderer' };
    expect(buildKitOptions([l1, l2])).toEqual([
      { id: 'l1', label: 'Core' },
      { id: 'l2', label: 'Budget' },
    ]);
  });

  it('preserves pricing, tcgplayerUrl, foiling, edition, typeTextDisplay, and art-style fields', () => {
    const lists = [
      list('l1', 'A', [
        card({
          cardUniqueId: 'cu1',
          displayName: 'X',
          rarity: 'r',
          types: ['action'],
          foiling: 'R',
          edition: 'f',
          tcgLow: 1.23,
          tcgMarket: 2.34,
          tcgMid: 2.0,
          tcgHigh: 3.5,
          tcgplayerUrl: 'https://tcgplayer.com/foo',
          typeTextDisplay: 'Action - Attack',
          isExtendedArt: true,
          artVariations: ['AA'],
          foilInsetTop: 1.5,
        } as any),
      ]),
    ];
    const pool = computeCardPool(lists);
    const pc = pool.cards[0] as any;
    expect(pc.foiling).toBe('R');
    expect(pc.edition).toBe('f');
    expect(pc.tcgLow).toBe(1.23);
    expect(pc.tcgMarket).toBe(2.34);
    expect(pc.tcgMid).toBe(2.0);
    expect(pc.tcgHigh).toBe(3.5);
    expect(pc.tcgplayerUrl).toBe('https://tcgplayer.com/foo');
    expect(pc.typeTextDisplay).toBe('Action - Attack');
    expect(pc.isExtendedArt).toBe(true);
    expect(pc.artVariations).toEqual(['AA']);
    expect(pc.foilInsetTop).toBe(1.5);
  });

  it('preserves collectorNumber from source cards', () => {
    const lists = [
      list('l1', 'A', [
        card({ cardUniqueId: 'cu1', displayName: 'X', rarity: 'r', types: ['action'], setCode: 'arc', collectorNumber: '123' } as any),
      ]),
    ];
    const pool = computeCardPool(lists);
    expect(pool.cards[0].collectorNumber).toBe('123');
  });

  it('groups cards by rarity in descending prestige order', () => {
    const lists = [
      list('l1', 'A', [
        card({ cardUniqueId: 'c1', displayName: 'Common', rarity: 'c', types: ['action'] }),
        card({ cardUniqueId: 'l1', displayName: 'Legend', rarity: 'l', types: ['action'] }),
        card({ cardUniqueId: 'r1', displayName: 'Rare', rarity: 'r', types: ['action'] }),
      ]),
    ];
    const pool = computeCardPool(lists);
    expect(pool.byRarity.map(g => g.rarity)).toEqual(['Legendary', 'Rare', 'Common']);
  });
});

describe('formatSetCollector', () => {
  it('uppercases set code and appends collector number', () => {
    expect(formatSetCollector('arc', '123')).toBe('ARC123');
  });

  it('returns uppercase set alone when collector number missing', () => {
    expect(formatSetCollector('arc', undefined)).toBe('ARC');
  });

  it('returns empty string when both set and number missing', () => {
    expect(formatSetCollector(undefined, undefined)).toBe('');
  });

  it('does not double-prefix when collector number already starts with set code', () => {
    expect(formatSetCollector('arc', 'ARC150')).toBe('ARC150');
  });

  it('does not double-prefix case-insensitively', () => {
    expect(formatSetCollector('ARC', 'arc150')).toBe('ARC150');
  });

  it('concatenates when collector number has no leading set prefix', () => {
    expect(formatSetCollector('arc', '150')).toBe('ARC150');
  });
});

function pc(partial: Partial<PoolCard> & { displayName: string }): PoolCard {
  return {
    cardUniqueId: partial.displayName.toLowerCase(),
    rarity: 'Common',
    rarityCode: 'c',
    types: [],
    keywords: [],
    printingId: `p-${partial.displayName}`,
    comment: null,
    rawCount: 1,
    cappedCount: 1,
    cap: 3,
    sources: [],
    ...partial,
  } as PoolCard;
}

describe('sortPoolCards', () => {
  it('alpha mode: sorts by display name ascending', () => {
    const cards = [
      pc({ displayName: 'Zephyr' }),
      pc({ displayName: 'Amulet' }),
      pc({ displayName: 'Mask' }),
    ];
    expect(sortPoolCards(cards, 'alpha').map(c => c.displayName))
      .toEqual(['Amulet', 'Mask', 'Zephyr']);
  });

  it('set mode: groups by set code, then by collector number numerically', () => {
    const cards = [
      pc({ displayName: 'B1', setCode: 'arc', collectorNumber: '100' }),
      pc({ displayName: 'A2', setCode: 'arc', collectorNumber: '9' }),
      pc({ displayName: 'C3', setCode: 'hvy', collectorNumber: '5' }),
      pc({ displayName: 'A1', setCode: 'arc', collectorNumber: '2' }),
    ];
    const sorted = sortPoolCards(cards, 'set');
    expect(sorted.map(c => `${c.setCode}${c.collectorNumber}`))
      .toEqual(['arc2', 'arc9', 'arc100', 'hvy5']);
  });

  it('set mode: parses trailing digits when collectorNumber is prefixed (e.g. ARC150)', () => {
    const cards = [
      pc({ displayName: 'B', setCode: 'arc', collectorNumber: 'ARC100' }),
      pc({ displayName: 'A', setCode: 'arc', collectorNumber: 'ARC9' }),
      pc({ displayName: 'C', setCode: 'arc', collectorNumber: 'ARC2' }),
    ];
    expect(sortPoolCards(cards, 'set').map(c => c.displayName))
      .toEqual(['C', 'A', 'B']);
  });

  it('set mode: cards without set code appear last', () => {
    const cards = [
      pc({ displayName: 'NoSet' }),
      pc({ displayName: 'A', setCode: 'arc', collectorNumber: '1' }),
    ];
    expect(sortPoolCards(cards, 'set').map(c => c.displayName))
      .toEqual(['A', 'NoSet']);
  });
});
