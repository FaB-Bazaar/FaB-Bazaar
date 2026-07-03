// app/api/printings/[printingId]/route.test.ts
// Public printing lookup by primary key — the fallback resolver for QR scans
// of cards outside a preloaded decklist. Card identity is immutable, so
// responses are cacheable forever.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  printingsService: { getPrintingById: vi.fn() },
}));

// Import AFTER mocks (vi.mock is hoisted)
import { GET } from './route';
import { printingsService } from '@/lib/services';

const mockGet = vi.mocked(printingsService.getPrintingById);

const makeRequest = (pid: string) =>
  new NextRequest(`http://localhost:3000/api/printings/${pid}`);
const params = (pid: string) => ({ params: Promise.resolve({ printingId: pid }) });

describe('GET /api/printings/[printingId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the printing for a valid id', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: { printing_id: 'cLHGKMCjPb89zwNPmMFBp', display_name: 'Command and Conquer' },
    } as any);
    const res = await GET(makeRequest('cLHGKMCjPb89zwNPmMFBp'), params('cLHGKMCjPb89zwNPmMFBp'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.display_name).toBe('Command and Conquer');
    expect(mockGet).toHaveBeenCalledWith('cLHGKMCjPb89zwNPmMFBp');
  });

  it('marks responses as immutable and long-cacheable', async () => {
    mockGet.mockResolvedValue({ success: true, data: { printing_id: 'x'.repeat(21) } } as any);
    const res = await GET(makeRequest('x'.repeat(21)), params('x'.repeat(21)));
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    expect(res.headers.get('Cache-Control')).toContain('max-age=31536000');
  });

  it('404s for an unknown printing without caching the miss', async () => {
    mockGet.mockResolvedValue({ success: true, data: null } as any);
    const res = await GET(makeRequest('a'.repeat(21)), params('a'.repeat(21)));
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control') ?? '').not.toContain('immutable');
  });

  it('rejects malformed ids before touching the service', async () => {
    const res = await GET(makeRequest('short'), params('short'));
    expect(res.status).toBe(400);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('500s when the service fails', async () => {
    mockGet.mockResolvedValue({ success: false, error: 'db down' } as any);
    const res = await GET(makeRequest('b'.repeat(21)), params('b'.repeat(21)));
    expect(res.status).toBe(500);
  });
});
