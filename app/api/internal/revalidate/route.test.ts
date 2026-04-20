import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { POST } from './route';
import { revalidateTag } from 'next/cache';

const mockRevalidateTag = vi.mocked(revalidateTag);

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/internal/revalidate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/internal/revalidate', () => {
  const originalEnv = process.env.REVALIDATE_SECRET;

  beforeEach(() => {
    mockRevalidateTag.mockClear();
    process.env.REVALIDATE_SECRET = 'test-secret';
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.REVALIDATE_SECRET;
    else process.env.REVALIDATE_SECRET = originalEnv;
  });

  it('returns 401 when x-api-key header is missing', async () => {
    const res = await POST(makeRequest({ tag: 'kits-summary' }));
    expect(res.status).toBe(401);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 401 when x-api-key does not match', async () => {
    const res = await POST(makeRequest({ tag: 'kits-summary' }, { 'x-api-key': 'wrong' }));
    expect(res.status).toBe(401);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 500 when REVALIDATE_SECRET env is not configured', async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await POST(makeRequest({ tag: 'kits-summary' }, { 'x-api-key': 'test-secret' }));
    expect(res.status).toBe(500);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('returns 400 when body has neither tag nor tags', async () => {
    const res = await POST(makeRequest({}, { 'x-api-key': 'test-secret' }));
    expect(res.status).toBe(400);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  it('calls revalidateTag with the single tag from body.tag', async () => {
    const res = await POST(
      makeRequest({ tag: 'kits-summary' }, { 'x-api-key': 'test-secret' })
    );
    expect(res.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledTimes(1);
    expect(mockRevalidateTag).toHaveBeenCalledWith('kits-summary');
  });

  it('calls revalidateTag for each entry in body.tags', async () => {
    const res = await POST(
      makeRequest({ tags: ['kits-summary', 'decks-index'] }, { 'x-api-key': 'test-secret' })
    );
    expect(res.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledTimes(2);
    expect(mockRevalidateTag).toHaveBeenCalledWith('kits-summary');
    expect(mockRevalidateTag).toHaveBeenCalledWith('decks-index');
  });
});
