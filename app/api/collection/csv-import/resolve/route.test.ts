/**
 * Route unit tests: POST /api/collection/csv-import/resolve — the print-code
 * CSV import (partner contract). Parses the upload, resolves every code in one
 * service call and returns review rows; never writes anything.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({ printingsService: { resolvePrintCodes: vi.fn() } }));
vi.mock('@/lib/auth/multi-auth', () => ({ authenticateRequest: vi.fn() }));

// Import AFTER mocks (vi.mock is hoisted)
import { POST } from './route';
import { printingsService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import type { PrintingDTO } from '@/lib/services/contracts/IPrintingsService';

const mockResolve = vi.mocked(printingsService.resolvePrintCodes);
const mockAuth = vi.mocked(authenticateRequest);

function upload(csv: string | null) {
  const fd = new FormData();
  if (csv !== null) fd.append('csv', new File([csv], 'nanza.csv', { type: 'text/csv' }));
  return new NextRequest('http://localhost/api/collection/csv-import/resolve', { method: 'POST', body: fd });
}

const cnc = { printing_id: 'p1', name: 'Command and Conquer' } as PrintingDTO;

beforeEach(() => {
  mockResolve.mockReset();
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ success: true, userId: 'u1' } as Awaited<ReturnType<typeof authenticateRequest>>);
});

describe('POST /api/collection/csv-import/resolve', () => {
  it('401s when signed out', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'Unauthorized' } as Awaited<ReturnType<typeof authenticateRequest>>);
    const res = await POST(upload('print_code\nARC159'));
    expect(res.status).toBe(401);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it('allows OAuth bearers (partner tools / MCP)', async () => {
    mockResolve.mockResolvedValue({ success: true, data: [{ code: 'ARC159', status: 'ok', printing: cnc }] });
    await POST(upload('print_code\nARC159'));
    expect(mockAuth.mock.calls[0][2]).toMatchObject({ allowOAuth: true });
  });

  it('400s without a file', async () => {
    const res = await POST(upload(null));
    expect(res.status).toBe(400);
  });

  it('400s when the header is wrong', async () => {
    const res = await POST(upload('code,qty\nARC159,1'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/print_code/);
  });

  it('resolves all codes in one call and returns review rows plus parse errors', async () => {
    mockResolve.mockResolvedValue({
      success: true,
      data: [
        { code: 'ARC159-RF-1E', status: 'ok', printing: cnc },
        { code: 'ZZZ999', status: 'not_found' },
      ],
    });
    const res = await POST(upload([
      'print_code,name,quantity,condition,for_trade',
      'ARC159-RF-1E,Command and Conquer,2,LP,yes',
      'ZZZ999,,1,,',
      'WTR001,,1,MINT,',
    ].join('\n')));

    expect(res.status).toBe(200);
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(mockResolve).toHaveBeenCalledWith(['ARC159-RF-1E', 'ZZZ999']);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.rows).toMatchObject([
      { line: 2, status: 'ok', quantity: 2, condition: 'LP', forTrade: true, printing: { printing_id: 'p1' } },
      { line: 3, status: 'unresolved' },
    ]);
    expect(body.data.parseErrors).toHaveLength(1);
    expect(body.data.parseErrors[0]).toMatch(/Row 4/);
  });

  it('500s when the lookup fails', async () => {
    mockResolve.mockResolvedValue({ success: false, error: 'db down' });
    const res = await POST(upload('print_code\nARC159'));
    expect(res.status).toBe(500);
  });
});
