import Redis from 'ioredis';

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    client.on('error', (err) => console.error('[Redis]', err.message));
  }
  return client;
}
