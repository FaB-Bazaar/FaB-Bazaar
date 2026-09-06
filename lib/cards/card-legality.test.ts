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

describe('deckLegalityVerdict — Future Classic Constructed', () => {
  it('reuses the CC verdict for a card that is CC-legal today', () => {
    const rows = formatLegalityRows({ cc_legal: true, blitz_legal: true });
    expect(deckLegalityVerdict(rows, 'Future Classic Constructed', { future_release: false }))
      .toMatchObject({ format: 'Future Classic Constructed', short: 'Future CC', status: 'legal' });
  });

  it('marks a not-yet-legal card from a future-dated set as legal', () => {
    const rows = formatLegalityRows({ cc_legal: false, blitz_legal: false, future_release: true });
    expect(deckLegalityVerdict(rows, 'Future Classic Constructed', { future_release: true })?.status).toBe('legal');
  });

  it('keeps a CC ban even for a future-set card', () => {
    const rows = formatLegalityRows({ cc_legal: true, cc_banned: true });
    expect(deckLegalityVerdict(rows, 'Future Classic Constructed', { future_release: true })?.status).toBe('banned');
  });

  it('does not add a sixth row to the per-card legality strip', () => {
    expect(formatLegalityRows({ cc_legal: true, future_release: true })).toHaveLength(5);
  });
});
