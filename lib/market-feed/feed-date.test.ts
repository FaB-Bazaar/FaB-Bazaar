import { describe, it, expect } from 'vitest';
import { marketFeedToday } from './feed-date';

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
