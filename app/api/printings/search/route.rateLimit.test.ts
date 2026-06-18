/**
 * Global (all-users) rate limit on the search endpoint. A single shared counter
 * — not per-IP — caps total /api/printings/search throughput so a broad/
 * distributed spike can't saturate the Postgres pool. Default 5000/min,
 * tunable via SEARCH_GLOBAL_RATE_LIMIT_PER_MIN.
 *
 * resetModules per test gives each case a fresh in-memory rate-limit store.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  printingsService: {
    searchPrintings: vi.fn().mockResolvedValue({
      success: true,
      data: { printings: [], total: 0, page: 1, pages: 0, queryInfo: { executionTime: 1, filters: {} } },
    }),
  },
}));
vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
  hasAuthParams: () => false,
}));

async function freshGet() {
  const { GET } = await import('./route');
  const { NextRequest } = await import('next/server');
  return (i: number) => GET(new NextRequest(`http://localhost/api/printings/search?name=x${i}`));
}

describe('GET /api/printings/search — global rate limit', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SEARCH_GLOBAL_RATE_LIMIT_PER_MIN = '3';
  });

  it('429s once the global per-minute cap is exceeded (shared across all callers)', async () => {
    const call = await freshGet();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await call(i)).status);

    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses[3]).toBe(429);
  });

  it('429 response carries Retry-After', async () => {
    const call = await freshGet();
    for (let i = 0; i < 3; i++) await call(i);
    const res = await call(99);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('logs a warning when the global cap sheds load (visibility into real pressure)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const call = await freshGet();
    for (let i = 0; i < 3; i++) await call(i);
    await call(99); // 4th trips the cap
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays under the default 5000 cap for ordinary traffic', async () => {
    delete process.env.SEARCH_GLOBAL_RATE_LIMIT_PER_MIN; // default 5000
    const call = await freshGet();
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await call(i)).status);
    expect(statuses.every(s => s === 200)).toBe(true);
  });
});
