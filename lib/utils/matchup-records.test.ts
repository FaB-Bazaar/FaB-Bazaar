import { describe, it, expect } from 'vitest';
import { computeMatchupRecords } from './matchup-records';

describe('computeMatchupRecords', () => {
  it('returns an empty record for an empty results list', () => {
    expect(computeMatchupRecords([])).toEqual({});
  });

  it('aggregates wins and losses by opponentHero', () => {
    const records = computeMatchupRecords([
      { opponentHero: 'bravo_showstopper', result: 'win' },
      { opponentHero: 'bravo_showstopper', result: 'loss' },
      { opponentHero: 'bravo_showstopper', result: 'win' },
      { opponentHero: 'fai_rising_rebellion', result: 'loss' },
    ]);

    expect(records).toEqual({
      bravo_showstopper: { wins: 2, losses: 1 },
      fai_rising_rebellion: { wins: 0, losses: 1 },
    });
  });

  it('skips results without an opponentHero', () => {
    const records = computeMatchupRecords([
      { opponentHero: null, result: 'win' },
      { opponentHero: undefined, result: 'loss' },
      { opponentHero: 'kano_dracai_of_aether', result: 'win' },
    ]);

    expect(records).toEqual({
      kano_dracai_of_aether: { wins: 1, losses: 0 },
    });
  });

  it('treats opponentHero matching as case-insensitive', () => {
    const records = computeMatchupRecords([
      { opponentHero: 'Bravo_Showstopper', result: 'win' },
      { opponentHero: 'bravo_showstopper', result: 'loss' },
    ]);

    expect(records).toEqual({
      bravo_showstopper: { wins: 1, losses: 1 },
    });
  });
});
