/**
 * Unit tests for GET /api/sets/[setCode]/languages
 *
 * Mocked service — tests HTTP shape only. Public reference data, no auth
 * (mirrors /api/sets/[setCode]/packs).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  printingsService: { getSetLanguages: vi.fn() },
}));

import { GET } from './route';
import { printingsService } from '@/lib/services';

const mockGetSetLanguages = vi.mocked(printingsService.getSetLanguages);

const makeRequest = () => new NextRequest('http://localhost/api/sets/hvy/languages');
const params = { params: Promise.resolve({ setCode: 'hvy' }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/sets/[setCode]/languages', () => {
  it('returns the languages from the service', async () => {
    mockGetSetLanguages.mockResolvedValue({ success: true, data: ['en', 'fr', 'ja'] } as any);

    const res = await GET(makeRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, data: ['en', 'fr', 'ja'] });
    expect(mockGetSetLanguages).toHaveBeenCalledWith('hvy');
  });

  it('returns 500 when the service fails', async () => {
    mockGetSetLanguages.mockResolvedValue({ success: false, error: 'db down' } as any);

    const res = await GET(makeRequest(), params);

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('db down');
  });
});
