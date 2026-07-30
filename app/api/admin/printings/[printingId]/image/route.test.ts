/**
 * POST /api/admin/printings/[printingId]/image — hand-upload card art.
 *
 * Contract under test:
 *  - superadmin-only (401 unauth, 403 non-admin)
 *  - uploads to Cloudflare under the DETERMINISTIC image id (not printing_id)
 *  - falls back to printing_id when a sibling printing derives the same key
 *  - persists the new URL into printings.image_url after a successful upload
 *  - replace semantics: a 5409 "already exists" deletes the old image and
 *    retries once, so re-uploading art for the same printing actually works
 *  - a hard Cloudflare failure writes NOTHING to the DB
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/postgres/db', () => ({ pool: { query: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateSession: vi.fn() }));
vi.mock('@/lib/services', () => ({ userService: { getRoles: vi.fn() } }));

import { POST } from './route';
import { pool } from '@/lib/postgres/db';
import { authenticateSession } from '@/lib/auth/multi-auth';
import { userService } from '@/lib/services';

const mockQuery = vi.mocked(pool.query);
const mockAuth = vi.mocked(authenticateSession);
const mockRoles = vi.mocked(userService.getRoles);

const CF_BASE = 'https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg';

function printingRow(over: Record<string, unknown> = {}) {
  return {
    printing_id: 'nanoid-abc',
    language: 'en',
    collector_number: 'MPW029',
    foiling: 'r',
    edition: 'n',
    is_extended_art: false,
    is_front_face: true,
    art_variations: null,
    ...over,
  };
}

function makeRequest(withFile = true) {
  const form = new FormData();
  if (withFile) form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }), 'art.webp');
  return new Request('http://localhost/api/admin/printings/nanoid-abc/image', {
    method: 'POST',
    body: form,
  });
}

const params = Promise.resolve({ printingId: 'nanoid-abc' });

function cfResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  mockQuery.mockReset();
  mockAuth.mockReset();
  mockRoles.mockReset();
  vi.stubGlobal('fetch', vi.fn());
  // default: authorized superadmin
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: true } } as any);
  process.env.CLOUDFLARE_ACCOUNT_ID = 'acc';
  process.env.CLOUDFLARE_API_TOKEN = 'tok';
});

describe('POST /api/admin/printings/[printingId]/image', () => {
  it('401s when unauthenticated', async () => {
    mockAuth.mockResolvedValue({ success: false } as any);
    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('403s for a non-superadmin', async () => {
    mockRoles.mockResolvedValue({ success: true, data: { isSuperAdmin: false } } as any);
    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('400s when no file is attached', async () => {
    const res = await POST(makeRequest(false) as any, { params });
    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('404s for an unknown printing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    const res = await POST(makeRequest() as any, { params });
    expect(res.status).toBe(404);
  });

  it('uploads under the deterministic id and persists image_url', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [printingRow()] } as any) // the printing
      .mockResolvedValueOnce({ rows: [printingRow()] } as any) // universe (self only)
      .mockResolvedValueOnce({ rowCount: 1 } as any); // UPDATE
    vi.mocked(fetch).mockResolvedValueOnce(cfResponse({ success: true }));

    const res = await POST(makeRequest() as any, { params });
    const body = await res.json();

    expect(body).toEqual({
      success: true,
      data: { imageUrl: `${CF_BASE}/MPW029-RF/public`, imageId: 'MPW029-RF', fallback: false },
    });

    // Cloudflare got the deterministic custom id
    const cfCall = vi.mocked(fetch).mock.calls[0]!;
    expect(String(cfCall[0])).toContain('/images/v1');
    const sentForm = (cfCall[1] as RequestInit).body as FormData;
    expect(sentForm.get('id')).toBe('MPW029-RF');

    // image_url persisted
    const updateCall = mockQuery.mock.calls[2]!;
    expect(String(updateCall[0])).toMatch(/UPDATE printings/i);
    expect(updateCall[1]).toEqual([`${CF_BASE}/MPW029-RF/public`, 'nanoid-abc']);
  });

  it('falls back to printing_id when a sibling collides on the key', async () => {
    const sibling = printingRow({ printing_id: 'nanoid-other' }); // identical attrs → same key
    mockQuery
      .mockResolvedValueOnce({ rows: [printingRow()] } as any)
      .mockResolvedValueOnce({ rows: [printingRow(), sibling] } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);
    vi.mocked(fetch).mockResolvedValueOnce(cfResponse({ success: true }));

    const res = await POST(makeRequest() as any, { params });
    const body = await res.json();

    expect(body.data).toEqual({
      imageUrl: `${CF_BASE}/nanoid-abc/public`,
      imageId: 'nanoid-abc',
      fallback: true,
    });
  });

  it('replaces an existing image: 5409 → delete → retry once', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [printingRow()] } as any)
      .mockResolvedValueOnce({ rows: [printingRow()] } as any)
      .mockResolvedValueOnce({ rowCount: 1 } as any);
    vi.mocked(fetch)
      .mockResolvedValueOnce(cfResponse({ success: false, errors: [{ code: 5409, message: 'already exists' }] }, false))
      .mockResolvedValueOnce(cfResponse({ success: true })) // DELETE old image
      .mockResolvedValueOnce(cfResponse({ success: true })); // retry upload

    const res = await POST(makeRequest() as any, { params });
    const body = await res.json();

    expect(body.success).toBe(true);
    const calls = vi.mocked(fetch).mock.calls;
    expect((calls[1]![1] as RequestInit).method).toBe('DELETE');
    expect(String(calls[1]![0])).toContain('/images/v1/MPW029-RF');
    expect(calls).toHaveLength(3);
  });

  it('writes nothing to the DB when Cloudflare hard-fails', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [printingRow()] } as any)
      .mockResolvedValueOnce({ rows: [printingRow()] } as any);
    vi.mocked(fetch).mockResolvedValue(cfResponse({ success: false, errors: [{ code: 5500, message: 'boom' }] }, false));

    const res = await POST(makeRequest() as any, { params });

    expect(res.status).toBe(502);
    // Only the two SELECTs — no UPDATE
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});
