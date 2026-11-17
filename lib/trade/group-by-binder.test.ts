import { describe, it, expect } from 'vitest';
import { groupTradeCardsByBinder, tradeBinderHref } from './group-by-binder';

const card = (binderId: string, tcgLow: number | null, quantity = 1) => ({
  binderId, binderName: `Binder ${binderId}`, binderViewable: binderId !== 'private',
  displayName: `${binderId}-${tcgLow}`, tcgLow, quantity,
});

describe('groupTradeCardsByBinder', () => {
  it('groups by binder and ranks groups by tcg_low value (quantity-weighted)', () => {
    const groups = groupTradeCardsByBinder([card('a', 1, 3), card('b', 10), card('a', 0.5)]);
    expect(groups.map((g) => [g.binderId, g.totalValue, g.cards.length])).toEqual([
      ['b', 10, 1],
      ['a', 3.5, 2],
    ]);
  });

  it('treats unpriced cards as $0 and keeps the binder flags', () => {
    const [group] = groupTradeCardsByBinder([card('private', null, 2)]);
    expect(group).toMatchObject({ binderId: 'private', binderName: 'Binder private', binderViewable: false, totalValue: 0 });
  });
});

describe('tradeBinderHref', () => {
  it('opens the binder with the wants auto-add and the match mode', () => {
    expect(tradeBinderHref('b1', 'exact')).toBe('/binder/b1?trade=wants');
    expect(tradeBinderHref('b1', 'loose')).toBe('/binder/b1?trade=wants&match=loose');
  });
});
