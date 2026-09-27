import Redis from 'ioredis';

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      // Fail fast while disconnected. Every caller is a cache with a DB
      // fallback; with the offline queue on, a command waited for the next
      // reconnect attempt, whose backoff grows to ~4s — so a Redis outage made
      // each cached search (get + set) take ~8s instead of skipping the cache.
      enableOfflineQueue: false,
      // Connect at creation (not on first command) so the queue-less client is
      // usually ready before the first request; one that races the initial
      // connect just misses the cache once.
      lazyConnect: false,
    });
    client.on('error', (err) => console.error('[Redis]', err.message));
  }
  return client;
}

/**
 * The client, once usable — for callers that ping right away (health, cron).
 * Waits (bounded) only while the FIRST connection is in progress; a Redis that
 * is down/reconnecting returns null at once, never a wait.
 */
export async function getReadyRedisClient(timeoutMs = 1000): Promise<Redis | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  if (redis.status === 'ready') return redis;
  if (redis.status !== 'connecting' && redis.status !== 'connect' && redis.status !== 'wait') return null;
  return new Promise((resolve) => {
    const done = (value: Redis | null) => {
      clearTimeout(timer);
      redis.off('ready', onReady);
      redis.off('close', onClose);
      resolve(value);
    };
    const onReady = () => done(redis);
    const onClose = () => done(null); // first connect failed — Redis is down
    const timer = setTimeout(() => done(null), timeoutMs);
    redis.once('ready', onReady);
    redis.once('close', onClose);
  });
}
