import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCachedPublicProfile, setCachedPublicProfile, invalidatePublicProfile } from './public-profile-cache';

afterEach(() => {
  vi.useRealTimers();
});

describe('public profile cache', () => {
  it('returns what was cached, ignoring username case', () => {
    setCachedPublicProfile('CacheUser1', { a: 1 });
    expect(getCachedPublicProfile('cacheuser1')).toEqual({ a: 1 });
  });

  it('expires after 5 minutes', () => {
    vi.useFakeTimers();
    setCachedPublicProfile('cacheuser2', { a: 1 });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(getCachedPublicProfile('cacheuser2')).toBeNull();
  });

  it('forgets a user on invalidate so a profile edit shows at once', () => {
    setCachedPublicProfile('cacheuser3', { a: 1 });
    invalidatePublicProfile('CacheUser3');
    expect(getCachedPublicProfile('cacheuser3')).toBeNull();
  });

  it('ignores an invalidate without a username', () => {
    expect(() => invalidatePublicProfile(undefined)).not.toThrow();
  });
});
