import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/postgres/db', () => ({ db: { execute: vi.fn(async () => [{ '?column?': 1 }]) } }));
const ready = vi.fn();
vi.mock('@/lib/redis', () => ({ getReadyRedisClient: (...a: unknown[]) => ready(...a) }));

import { GET } from './route';

const saved = process.env.REDIS_URL;
beforeEach(() => { ready.mockReset(); process.env.REDIS_URL = 'redis://example:6379'; });

describe('GET /api/health — Redis', () => {
  it('waits for a first connect instead of pinging a still-connecting client', async () => {
    ready.mockResolvedValue({ ping: vi.fn(async () => 'PONG') });
    const res = await GET();
    expect(ready).toHaveBeenCalled();
    expect(await res.json()).toEqual({ status: 'ok', checks: { postgres: 'ok', redis: 'ok' } });
  });

  it('reports a configured-but-down Redis as an error (503)', async () => {
    ready.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).checks.redis).toBe('error');
  });

  it('says "not configured" when REDIS_URL is unset', async () => {
    delete process.env.REDIS_URL;
    const res = await GET();
    expect((await res.json()).checks.redis).toBe('not configured');
    process.env.REDIS_URL = saved;
  });
});
