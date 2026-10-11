import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ printingsService: { getScanNameIndex: vi.fn() } }));

// Import AFTER mocks
import { GET } from './route';
import { printingsService } from '@/lib/services';

const mockIndex = vi.mocked(printingsService.getScanNameIndex);

describe('GET /api/scan/name-index', () => {
  beforeEach(() => { mockIndex.mockReset(); });

  it('returns the name vocabulary, public and cacheable (no sign-in: card names are public data)', async () => {
    mockIndex.mockResolvedValue({ success: true, data: [{ name: 'Sink Below', pitches: [1, 2, 3], translations: ['Couler'] }] });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.entries).toEqual([{ name: 'Sink Below', pitches: [1, 2, 3], translations: ['Couler'] }]);
    expect(res.headers.get('Cache-Control')).toMatch(/public/);
  });

  it('500s when the service fails', async () => {
    mockIndex.mockResolvedValue({ success: false, error: 'db down' });
    const res = await GET();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBeTruthy();
  });
});
