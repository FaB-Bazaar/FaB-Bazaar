/**
 * Unit tests for set registration in /admin/cardvault: register, read, edit,
 * logo upload, and the tcgcsv group list. Mocked gate/service/overlay/fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth/require-superadmin', () => ({ requireSuperAdmin: vi.fn() }));
vi.mock('@/lib/services', () => ({
  setsService: { registerSet: vi.fn(), updateSet: vi.fn(), getSetByCode: vi.fn(), listTcgGroupSets: vi.fn() },
}));
vi.mock('@/lib/fab-constants/set-overlay-server', () => ({ refreshSetOverlay: vi.fn() }));
vi.mock('@/lib/images/set-logo-upload', () => ({ uploadSetLogo: vi.fn() }));

import { POST as register } from './route';
import { GET as getSet, PATCH as editSet } from './[code]/route';
import { POST as uploadLogo } from './[code]/logo/route';
import { GET as tcgGroups } from '../tcg-groups/route';
import { __clearTcgcsvGroupsCacheForTests as __clearTcgGroupsCacheForTests } from '@/lib/sets/tcgcsv-groups';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { setsService } from '@/lib/services';
import { refreshSetOverlay } from '@/lib/fab-constants/set-overlay-server';
import { uploadSetLogo } from '@/lib/images/set-logo-upload';

const gate = vi.mocked(requireSuperAdmin);
const jsonReq = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) });
const params = (code: string) => ({ params: Promise.resolve({ code }) });
const SET = { code: 'spw', displayCode: 'SPW', name: 'Smash Palace: Chorus of Steel', releaseDate: '2026-10-30', imageId: null } as any;
const valid = { code: 'SPW', name: 'Smash Palace: Chorus of Steel', releaseDate: '2026-10-30', kind: 'booster', inCardFilters: true, tcgGroups: [{ groupId: 24773, name: 'Smash Palace: Chorus of Steel' }] };

const env = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  gate.mockResolvedValue({ ok: true, userId: 'admin-1' });
  process.env.CLOUDFLARE_ACCOUNT_ID = 'acc';
  process.env.CLOUDFLARE_API_TOKEN = 'tok';
});
afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); });

describe('auth', () => {
  it('every endpoint returns the gate response for non-superadmins', async () => {
    gate.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });
    const form = new FormData();
    const statuses = await Promise.all([
      register(jsonReq('/api/admin/cardvault/sets', 'POST', valid)),
      getSet(jsonReq('/api/admin/cardvault/sets/spw', 'GET'), params('spw')),
      editSet(jsonReq('/api/admin/cardvault/sets/spw', 'PATCH', { name: 'x' }), params('spw')),
      uploadLogo(new NextRequest('http://localhost/api/admin/cardvault/sets/spw/logo', { method: 'POST', body: form }), params('spw')),
      tcgGroups(jsonReq('/api/admin/cardvault/tcg-groups', 'GET')),
    ].map((p) => p.then((r) => r.status)));
    expect(statuses).toEqual([403, 403, 403, 403, 403]);
    expect(setsService.registerSet).not.toHaveBeenCalled();
    expect(setsService.updateSet).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/cardvault/sets', () => {
  it('registers the set, refreshes the site-wide overlay, returns 201', async () => {
    vi.mocked(setsService.registerSet).mockResolvedValue({ success: true, data: SET });
    const res = await register(jsonReq('/api/admin/cardvault/sets', 'POST', valid));
    expect(res.status).toBe(201);
    expect(vi.mocked(setsService.registerSet).mock.calls[0][0]).toMatchObject({ code: 'spw', category: 'standard', tier: 1 });
    expect(refreshSetOverlay).toHaveBeenCalled();
  });

  it('400s with per-field messages', async () => {
    const res = await register(jsonReq('/api/admin/cardvault/sets', 'POST', { ...valid, code: 'x y', releaseDate: 'soon' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(Object.keys(body.fields).sort()).toEqual(['code', 'releaseDate']);
    expect(setsService.registerSet).not.toHaveBeenCalled();
  });

  it('409s when the code is taken', async () => {
    vi.mocked(setsService.registerSet).mockResolvedValue({ success: false, error: "set 'spw' is already registered" });
    expect((await register(jsonReq('/api/admin/cardvault/sets', 'POST', valid))).status).toBe(409);
    expect(refreshSetOverlay).not.toHaveBeenCalled();
  });
});

describe('GET / PATCH /api/admin/cardvault/sets/[code]', () => {
  it('returns the set with its TCGplayer groups', async () => {
    vi.mocked(setsService.getSetByCode).mockResolvedValue({ success: true, data: SET });
    vi.mocked(setsService.listTcgGroupSets).mockResolvedValue({ success: true, data: [
      { groupId: 24773, setCode: 'spw', setName: 'Smash Palace: Chorus of Steel' },
      { groupId: 1, setCode: 'wtr', setName: 'WTR' },
    ] });
    const body = await (await getSet(jsonReq('/api/admin/cardvault/sets/spw', 'GET'), params('spw'))).json();
    expect(body.data.set.code).toBe('spw');
    expect(body.data.tcgGroups).toEqual([{ groupId: 24773, name: 'Smash Palace: Chorus of Steel' }]);
  });

  it('404s an unknown set', async () => {
    vi.mocked(setsService.getSetByCode).mockResolvedValue({ success: true, data: null });
    expect((await getSet(jsonReq('/api/admin/cardvault/sets/zzz', 'GET'), params('zzz'))).status).toBe(404);
  });

  it('edits only the fields sent and refreshes the overlay', async () => {
    vi.mocked(setsService.updateSet).mockResolvedValue({ success: true, data: SET });
    const res = await editSet(jsonReq('/api/admin/cardvault/sets/spw', 'PATCH', { releaseDate: '2026-11-01', kind: 'supplemental' }), params('spw'));
    expect(res.status).toBe(200);
    expect(vi.mocked(setsService.updateSet).mock.calls[0]).toEqual(['spw', { releaseDate: '2026-11-01', category: 'standard', tier: 2 }]);
    expect(refreshSetOverlay).toHaveBeenCalled();
  });

  it('404s editing an unknown set', async () => {
    vi.mocked(setsService.updateSet).mockResolvedValue({ success: false, error: "unknown set 'zzz'" });
    expect((await editSet(jsonReq('/api/admin/cardvault/sets/zzz', 'PATCH', { name: 'x' }), params('zzz'))).status).toBe(404);
  });
});

describe('POST /api/admin/cardvault/sets/[code]/logo', () => {
  const upload = (file?: File) => {
    const form = new FormData();
    if (file) form.append('file', file);
    return uploadLogo(new NextRequest('http://localhost/api/admin/cardvault/sets/spw/logo', { method: 'POST', body: form }), params('spw'));
  };
  const png = new File(['png'], 'logo.png', { type: 'image/png' });

  it('uploads, records the id on the set, refreshes the overlay', async () => {
    vi.mocked(setsService.getSetByCode).mockResolvedValue({ success: true, data: SET });
    vi.mocked(uploadSetLogo).mockResolvedValue({ ok: true, imageId: 'set-spw-logo' });
    vi.mocked(setsService.updateSet).mockResolvedValue({ success: true, data: { ...SET, imageId: 'set-spw-logo' } });
    const res = await upload(png);
    expect(res.status).toBe(200);
    expect((await res.json()).data.url).toMatch(/\/set-spw-logo\/public$/);
    expect(setsService.updateSet).toHaveBeenCalledWith('spw', { imageId: 'set-spw-logo' });
    expect(refreshSetOverlay).toHaveBeenCalled();
  });

  it('rejects a missing file, an SVG and an oversized image', async () => {
    vi.mocked(setsService.getSetByCode).mockResolvedValue({ success: true, data: SET });
    expect((await upload()).status).toBe(400);
    expect((await upload(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }))).status).toBe(400);
    expect((await upload(new File([new Uint8Array(11 * 1024 * 1024)], 'big.png', { type: 'image/png' }))).status).toBe(400);
    expect(uploadSetLogo).not.toHaveBeenCalled();
  });

  it('503s without Cloudflare credentials', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    vi.mocked(setsService.getSetByCode).mockResolvedValue({ success: true, data: SET });
    expect((await upload(png)).status).toBe(503);
  });
});

describe('GET /api/admin/cardvault/tcg-groups', () => {
  it('lists tcgcsv groups newest first with the sets each already prices', async () => {
    __clearTcgGroupsCacheForTests();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, results: [
      { groupId: 24640, name: 'Omens of the Third Age', abbreviation: 'OMN', publishedOn: '2026-06-05T00:00:00' },
      { groupId: 24773, name: 'Smash Palace: Chorus of Steel', abbreviation: 'SPW', publishedOn: '2026-10-30T00:00:00' },
    ] }))));
    vi.mocked(setsService.listTcgGroupSets).mockResolvedValue({ success: true, data: [
      { groupId: 24640, setCode: 'omn', setName: 'Omens' }, { groupId: 24640, setCode: 'iar', setName: 'Omens' },
    ] });
    const body = await (await tcgGroups(jsonReq('/api/admin/cardvault/tcg-groups', 'GET'))).json();
    expect(body.data.map((g: any) => [g.groupId, g.abbreviation, g.publishedOn, g.mappedTo])).toEqual([
      [24773, 'SPW', '2026-10-30', []],
      [24640, 'OMN', '2026-06-05', ['iar', 'omn']],
    ]);
  });

  it('502s when tcgcsv is unreachable', async () => {
    __clearTcgGroupsCacheForTests();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    vi.mocked(setsService.listTcgGroupSets).mockResolvedValue({ success: true, data: [] });
    expect((await tcgGroups(jsonReq('/api/admin/cardvault/tcg-groups', 'GET'))).status).toBe(502);
  });
});
