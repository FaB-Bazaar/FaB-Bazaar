import { describe, it, expect } from 'vitest';
import { whoHasUrl, whoHasRows } from './who-has';

describe('whoHasUrl', () => {
  it('asks for for-trade copies of the exact printing, or of any version of the card', () => {
    expect(whoHasUrl({ printingId: 'P1' })).toBe('/api/whohas?printingIds=P1&forTradeOnly=true&limit=20');
    expect(whoHasUrl({ cardUniqueId: 'C 1' }, 'https://fabbazaar.app')).toBe('https://fabbazaar.app/api/whohas?cardUniqueIds=C%201&forTradeOnly=true&limit=20');
  });
});

describe('whoHasRows', () => {
  const response = {
    success: true,
    owners: [
      { username: 'CrystalMath', binders: [{ binder_id: 'b1', binder_name: 'Trade Binder', total_cards_found: 1 }] },
      { username: 'dc_animalfeelings', binders: [
        { binder_id: 'b2', binder_name: 'Main', total_cards_found: 3 },
        { binder_id: 'b3', binder_name: 'Extras', total_cards_found: 1 },
      ] },
    ],
  };

  it('one row per owner binder, linking to the binder', () => {
    expect(whoHasRows(response)).toEqual([
      { name: 'CrystalMath', binderName: 'Trade Binder', count: 1, href: '/binder/b1' },
      { name: 'animalfeelings', binderName: 'Main', count: 3, href: '/binder/b2' },
      { name: 'animalfeelings', binderName: 'Extras', count: 1, href: '/binder/b3' },
    ]);
  });

  it('shows usernames without the internal dc_/gh_ prefix', () => {
    expect(whoHasRows(response).map(r => r.name)).not.toContain('dc_animalfeelings');
  });

  it('a failed or empty response gives no rows', () => {
    expect(whoHasRows({ success: false })).toEqual([]);
    expect(whoHasRows(null)).toEqual([]);
    expect(whoHasRows({ success: true, owners: [] })).toEqual([]);
  });
});
