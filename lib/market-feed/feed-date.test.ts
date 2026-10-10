import { describe, it, expect } from 'vitest';
import { marketFeedToday, resolveFeedDay } from './feed-date';

describe('marketFeedToday', () => {
  it('uses the US Eastern calendar date, not UTC', () => {
    // 2026-09-25 02:00 UTC is still 2026-09-24 in New York (EDT, UTC-4).
    expect(marketFeedToday(new Date('2026-09-25T02:00:00Z'))).toBe('2026-09-24');
    // 05:00 UTC is 01:00 EDT — the new day has started.
    expect(marketFeedToday(new Date('2026-09-25T05:00:00Z'))).toBe('2026-09-25');
  });

  it('follows standard time in winter (UTC-5)', () => {
    expect(marketFeedToday(new Date('2026-01-10T04:30:00Z'))).toBe('2026-01-09');
    expect(marketFeedToday(new Date('2026-01-10T05:30:00Z'))).toBe('2026-01-10');
  });
});

describe('resolveFeedDay', () => {
  const dates = ['2026-10-09', '2026-10-08', '2026-10-06']; // newest first, days with listings

  it('shows today when today has listings', () => {
    expect(resolveFeedDay({ today: '2026-10-09', datesWithListings: dates })).toEqual({ feedDate: '2026-10-09', fellBackFrom: null });
  });

  // An empty default page was the worst first impression of the feed.
  it('falls back to the newest day with listings when today has none yet', () => {
    expect(resolveFeedDay({ today: '2026-10-10', datesWithListings: dates })).toEqual({ feedDate: '2026-10-09', fellBackFrom: '2026-10-10' });
  });

  it('respects an explicitly requested day even when it is empty', () => {
    expect(resolveFeedDay({ requested: '2026-10-07', today: '2026-10-10', datesWithListings: dates })).toEqual({ feedDate: '2026-10-07', fellBackFrom: null });
  });

  it('stays on today when the region has no listings at all', () => {
    expect(resolveFeedDay({ today: '2026-10-10', datesWithListings: [] })).toEqual({ feedDate: '2026-10-10', fellBackFrom: null });
  });

  it('never falls forward to a date after today', () => {
    expect(resolveFeedDay({ today: '2026-10-07', datesWithListings: dates })).toEqual({ feedDate: '2026-10-06', fellBackFrom: '2026-10-07' });
  });
});
