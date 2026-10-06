/**
 * GET /api/sets/overlay — the runtime set overlay for browsers whose page was
 * rendered before the latest set registration (statically built pages).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/fab-constants/set-overlay-server', () => ({ getSetOverlay: vi.fn() }));

import { GET } from './route';
import { getSetOverlay } from '@/lib/fab-constants/set-overlay-server';

describe('GET /api/sets/overlay', () => {
  it('returns the overlay, publicly cacheable for a minute', async () => {
    const overlay = { version: 'v1', meta: {}, images: {}, filterSets: null };
    vi.mocked(getSetOverlay).mockResolvedValue(overlay);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: overlay });
    expect(res.headers.get('cache-control')).toMatch(/public.*max-age=60/);
  });
});
