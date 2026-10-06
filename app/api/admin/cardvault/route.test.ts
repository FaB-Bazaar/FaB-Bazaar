/**
 * Unit tests for the /admin/cardvault API (superadmin set ingest from CardVault).
 * Mocked gate, service and job registry — tests auth, validation and shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth/require-superadmin', () => ({ requireSuperAdmin: vi.fn() }));
vi.mock('@/lib/services', () => ({
  cardVaultService: { listSets: vi.fn(), getSet: vi.fn() },
}));
vi.mock('@/lib/import/cardvault-job', () => ({
  startCardVaultJob: vi.fn(),
  getCardVaultJob: vi.fn(),
  listCardVaultJobs: vi.fn(),
  cancelCardVaultJob: vi.fn(),
  DEFAULT_MAX_REQUESTS: 300,
}));

import { GET as getOverview } from './route';
import { POST as startJob } from './jobs/route';
import { GET as getJob } from './jobs/[jobId]/route';
import { POST as cancelJob } from './jobs/[jobId]/cancel/route';
import { requireSuperAdmin } from '@/lib/auth/require-superadmin';
import { cardVaultService } from '@/lib/services';
import { startCardVaultJob, getCardVaultJob, listCardVaultJobs, cancelCardVaultJob } from '@/lib/import/cardvault-job';

const gate = vi.mocked(requireSuperAdmin);
const req = (url: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, body === undefined ? {} : {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });
const params = (jobId: string) => ({ params: Promise.resolve({ jobId }) });
const job = { id: 'j1', set: 'iar', action: 'preview', status: 'running', log: [{ msg: 'x' }] } as any;

beforeEach(() => {
  vi.clearAllMocks();
  gate.mockResolvedValue({ ok: true, userId: 'admin-1' });
  vi.mocked(cardVaultService.getSet).mockResolvedValue({ success: true, data: { code: 'iar', name: 'Usurp', hasFirstEdition: false } });
});

describe('auth', () => {
  it('every endpoint returns the gate response for non-superadmins', async () => {
    gate.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });
    const responses = await Promise.all([
      getOverview(req('/api/admin/cardvault')),
      startJob(req('/api/admin/cardvault/jobs', { set: 'iar', action: 'preview' })),
      getJob(req('/api/admin/cardvault/jobs/j1'), params('j1')),
      cancelJob(req('/api/admin/cardvault/jobs/j1/cancel', {}), params('j1')),
    ]);
    expect(responses.map((r) => r.status)).toEqual([403, 403, 403, 403]);
    expect(startCardVaultJob).not.toHaveBeenCalled();
    expect(cancelCardVaultJob).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/cardvault', () => {
  it('returns sets, recent jobs without their logs, and whether Cloudflare is configured', async () => {
    vi.mocked(cardVaultService.listSets).mockResolvedValue({ success: true, data: [{ code: 'iar' } as any] });
    vi.mocked(listCardVaultJobs).mockReturnValue([job]);
    const res = await getOverview(req('/api/admin/cardvault'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.sets).toEqual([{ code: 'iar' }]);
    expect(body.data.jobs[0]).toMatchObject({ id: 'j1' });
    expect(body.data.jobs[0].log).toBeUndefined();
    expect(typeof body.data.cloudflareConfigured).toBe('boolean');
  });
});

describe('POST /api/admin/cardvault/jobs', () => {
  it('starts a job for a registered set and returns 202', async () => {
    vi.mocked(startCardVaultJob).mockReturnValue({ success: true, data: job });
    const res = await startJob(req('/api/admin/cardvault/jobs', {
      set: 'IAR', action: 'ingest', maxRequests: 200, skipCollectors: ['fab400', ' FAB401 '],
    }));
    expect(res.status).toBe(202);
    expect(vi.mocked(startCardVaultJob).mock.calls[0][0]).toEqual({
      set: 'iar', action: 'ingest', startedBy: 'admin-1', maxRequests: 200, skipCollectors: ['FAB400', 'FAB401'],
    });
  });

  it.each([
    [{ set: 'iar', action: 'delete' }, /action/],
    [{ set: 'i a r', action: 'preview' }, /set/],
    [{ action: 'preview' }, /set/],
    [{ set: 'iar', action: 'preview', maxRequests: 0 }, /maxRequests/],
    [{ set: 'iar', action: 'preview', maxRequests: 5000 }, /maxRequests/],
    [{ set: 'iar', action: 'preview', skipCollectors: ['FAB400; drop'] }, /skipCollectors/],
  ])('rejects %j with 400', async (body, msg) => {
    const res = await startJob(req('/api/admin/cardvault/jobs', body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(msg);
    expect(startCardVaultJob).not.toHaveBeenCalled();
  });

  it('404s an unregistered set', async () => {
    vi.mocked(cardVaultService.getSet).mockResolvedValue({ success: true, data: null });
    const res = await startJob(req('/api/admin/cardvault/jobs', { set: 'zzz', action: 'preview' }));
    expect(res.status).toBe(404);
  });

  it('409s while another job is running', async () => {
    vi.mocked(startCardVaultJob).mockReturnValue({ success: false, error: 'a preview job for IAR is still running' });
    const res = await startJob(req('/api/admin/cardvault/jobs', { set: 'iar', action: 'probe' }));
    expect(res.status).toBe(409);
  });
});

describe('GET /api/admin/cardvault/jobs/[jobId]', () => {
  it('returns the job with its log', async () => {
    vi.mocked(getCardVaultJob).mockReturnValue(job);
    const res = await getJob(req('/api/admin/cardvault/jobs/j1'), params('j1'));
    expect((await res.json()).data.log).toEqual([{ msg: 'x' }]);
  });

  it('404s an unknown job', async () => {
    vi.mocked(getCardVaultJob).mockReturnValue(null);
    expect((await getJob(req('/api/admin/cardvault/jobs/nope'), params('nope'))).status).toBe(404);
  });
});

describe('POST /api/admin/cardvault/jobs/[jobId]/cancel', () => {
  it('cancels a running job', async () => {
    vi.mocked(cancelCardVaultJob).mockReturnValue(true);
    const res = await cancelJob(req('/api/admin/cardvault/jobs/j1/cancel', {}), params('j1'));
    expect(res.status).toBe(200);
    expect(cancelCardVaultJob).toHaveBeenCalledWith('j1');
  });

  it('409s when the job is not running', async () => {
    vi.mocked(cancelCardVaultJob).mockReturnValue(false);
    expect((await cancelJob(req('/api/admin/cardvault/jobs/j1/cancel', {}), params('j1'))).status).toBe(409);
  });
});
