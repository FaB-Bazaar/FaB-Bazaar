import { getRedisClient } from '@/lib/redis';

/**
 * Get a cached value or compute it via fn and store the result.
 * If Redis is unavailable, fn() is called directly (graceful degradation).
 */
export async function getOrSet<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      console.error('[Cache] get error:', err);
    }
  }

  const value = await fn();

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      console.error('[Cache] set error:', err);
    }
  }

  return value;
}

/**
 * Delete one or more cache keys. Supports glob patterns (e.g. "search:*")
 * via SCAN + DEL. If Redis is unavailable, this is a no-op.
 */
export async function invalidate(pattern: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  // If no wildcard, do a simple DEL
  if (!pattern.includes('*') && !pattern.includes('?') && !pattern.includes('[')) {
    try {
      await redis.del(pattern);
    } catch (err) {
      console.error('[Cache] del error:', err);
    }
    return;
  }

  // Glob pattern: use SCAN to find matching keys then DEL in batches
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.error('[Cache] scan/del error:', err);
  }
}
