import { describe, it, expect } from 'vitest';
import { formatLegalityRows, deckLegalityVerdict } from './card-legality';

describe('formatLegalityRows', () => {
  it('lists the five constructed formats in display order with legal / not-legal from the flags', () => {
    // Ancestral Harmony (HVY247): CC/Blitz/LL legal, Silver Age + Commoner not.
    const rows = formatLegalityRows({
      cc_legal: true, blitz_legal: true, ll_legal: true, silver_age_legal: false, commoner_legal: false,
    });
    expect(rows.map(r => [r.format, r.status])).toEqual([
      ['Classic Constructed', 'legal'],
      ['Blitz', 'legal'],
      ['Living Legend', 'legal'],
      ['Silver Age', 'not-legal'],
      ['Commoner', 'not-legal'],
    ]);
  });

  it('banned overrides the legal flag (banned cards keep *_legal = true in the DB)', () => {
    const rows = formatLegalityRows({ cc_legal: true, cc_banned: true, blitz_legal: true });
    expect(rows.find(r => r.key === 'cc')?.status).toBe('banned');
    expect(rows.find(r => r.key === 'blitz')?.status).toBe('legal');
  });

  it('suspended and LL-restricted are reported as their own statuses', () => {
    const rows = formatLegalityRows({ cc_legal: true, cc_suspended: true, ll_legal: true, ll_restricted: true });
    expect(rows.find(r => r.key === 'cc')?.status).toBe('suspended');
    expect(rows.find(r => r.key === 'll')?.status).toBe('restricted');
  });

  it('returns no rows when the row carries no legality data at all (lazy printing rows)', () => {
    expect(formatLegalityRows({})).toEqual([]);
    expect(formatLegalityRows({ name: 'x' } as Record<string, unknown>)).toEqual([]);
  });
});

describe('deckLegalityVerdict', () => {
  const rows = formatLegalityRows({ cc_legal: true, cc_banned: true, blitz_legal: true, silver_age_legal: false });

  it('picks the row for the deck format display string', () => {
    expect(deckLegalityVerdict(rows, 'Blitz')).toMatchObject({ key: 'blitz', format: 'Blitz', status: 'legal' });
    expect(deckLegalityVerdict(rows, 'Silver Age')).toMatchObject({ key: 'silver_age', format: 'Silver Age', status: 'not-legal' });
    expect(deckLegalityVerdict(rows, 'Classic Constructed')?.status).toBe('banned');
  });

  it('returns null for an unknown / missing deck format or no legality data', () => {
    expect(deckLegalityVerdict(rows, undefined)).toBeNull();
    expect(deckLegalityVerdict(rows, 'Draft')).toBeNull();
    expect(deckLegalityVerdict([], 'Blitz')).toBeNull();
  });

  it('exposes a short code per format for the compact strip', () => {
    expect(rows.map(r => r.short)).toEqual(['CC', 'Blitz', 'LL', 'SA', 'Commoner']);
  });
});
