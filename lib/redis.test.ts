import { describe, it, expect, vi, afterAll } from 'vitest';

// A Redis that's configured but unreachable must not slow requests down. The
// client used to queue each command until its next reconnect attempt, and the
// backoff grows to ~4s — so every cached search (get + set) took ~8s while the
// database answered in ~50ms. Now commands fail fast while disconnected and
// the cache falls straight through to the computed value.

describe('getRedisClient — Redis unreachable', () => {
  const saved = process.env.REDIS_URL;
  afterAll(async () => {
    const { getRedisClient } = await import('./redis');
    getRedisClient()?.disconnect();
    process.env.REDIS_URL = saved;
  });

  it('getOrSet falls through to the computed value without waiting on Redis', async () => {
    vi.resetModules();
    process.env.REDIS_URL = 'redis://127.0.0.1:6391'; // nothing listens here
    const { getRedisClient } = await import('./redis');
    const { getOrSet } = await import('./cache');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    getRedisClient()!.get('warm-up').catch(() => {}); // start connecting / backing off
    await new Promise(r => setTimeout(r, 4000)); // let the reconnect backoff grow

    const t = Date.now();
    const value = await getOrSet('redis-test-key', async () => 'computed', 60);
    expect(value).toBe('computed');
    expect(Date.now() - t).toBeLessThan(300);
    errors.mockRestore();
  }, 15000);
});

// Health / cron call ping() right away; on a fresh process the client is still
// on its first connect, and with no offline queue that ping failed ("degraded"
// on the first health probe after a deploy). getReadyRedisClient waits for the
// FIRST connection (bounded) but never for a reconnect — a down Redis stays fast.
describe('getReadyRedisClient', () => {
  const saved = process.env.REDIS_URL;
  afterAll(() => { process.env.REDIS_URL = saved; });

  it('returns null quickly when Redis is unreachable', async () => {
    vi.resetModules();
    process.env.REDIS_URL = 'redis://127.0.0.1:6391';
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getReadyRedisClient, getRedisClient } = await import('./redis');
    const t = Date.now();
    expect(await getReadyRedisClient(1000)).toBeNull();
    expect(Date.now() - t).toBeLessThan(1200);
    getRedisClient()?.disconnect();
    errors.mockRestore();
  });

  it.skipIf(!saved)('a brand-new client is usable at once when Redis is up', async () => {
    vi.resetModules();
    process.env.REDIS_URL = saved;
    const { getReadyRedisClient, getRedisClient } = await import('./redis');
    const redis = await getReadyRedisClient(2000);
    if (!redis) return; // local Redis not running — nothing to prove here
    expect(await redis.ping()).toBe('PONG');
    getRedisClient()?.disconnect();
  });
});
