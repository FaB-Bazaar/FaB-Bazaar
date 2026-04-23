/**
 * Unit tests for PATCH / DELETE /api/portal/token-cards/[tokenCardId].
 * Critically verifies the service-error → HTTP status mapping for the
 * ownership-enforcement paths (403 not authorized, 404 not found).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/services', () => ({
  customTokenCardService: {
    updateTokenCard: vi.fn(),
    deleteTokenCard: vi.fn(),
  },
}));
vi.mock('@/lib/auth/require-creator', () => ({
  requireCreatorProfile: vi.fn(),
}));

import { PATCH, DELETE } from './route';
import { customTokenCardService } from '@/lib/services';
import { requireCreatorProfile } from '@/lib/auth/require-creator';

const mockGate = vi.mocked(requireCreatorProfile);
const mockUpdate = vi.mocked(customTokenCardService.updateTokenCard);
const mockDelete = vi.mocked(customTokenCardService.deleteTokenCard);

const makeReq = (method: 'PATCH' | 'DELETE', body?: unknown) => new NextRequest('http://localhost/api/portal/token-cards/t1', {
  method,
  ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
});

const ctx = (tokenCardId = 't1') => ({ params: Promise.resolve({ tokenCardId }) });
const gateFail = (status: number) => ({
  success: false as const,
  response: NextResponse.json({ error: 'gate' }, { status }),
});
const gateOk = { success: true as const, userId: 'u1', creator: { id: 'c1' } } as any;

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/portal/token-cards/[tokenCardId]', () => {
  it('forwards the gate response when the gate fails', async () => {
    mockGate.mockResolvedValue(gateFail(404) as any);

    const res = await PATCH(makeReq('PATCH', { name: 'x' }), ctx());
    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('passes creator.id + tokenCardId + body to updateTokenCard', async () => {
    mockGate.mockResolvedValue(gateOk);
    mockUpdate.mockResolvedValue({ success: true, data: { id: 't1', name: 'x' } } as any);

    const res = await PATCH(makeReq('PATCH', { name: 'x' }), ctx('t1'));
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith('c1', 't1', { name: 'x' });
  });

  it('maps "not found" service errors to 404', async () => {
    mockGate.mockResolvedValue(gateOk);
    mockUpdate.mockResolvedValue({ success: false, error: 'Token card not found' } as any);

    const res = await PATCH(makeReq('PATCH', {}), ctx());
    expect(res.status).toBe(404);
  });

  it('maps "not authorized" service errors to 403 (ownership guard)', async () => {
    mockGate.mockResolvedValue(gateOk);
    mockUpdate.mockResolvedValue({ success: false, error: 'Not authorized to modify this token card' } as any);

    const res = await PATCH(makeReq('PATCH', {}), ctx());
    expect(res.status).toBe(403);
  });

  it('maps other service errors to 400', async () => {
    mockGate.mockResolvedValue(gateOk);
    mockUpdate.mockResolvedValue({ success: false, error: 'something generic' } as any);

    const res = await PATCH(makeReq('PATCH', {}), ctx());
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/portal/token-cards/[tokenCardId]', () => {
  it('forwards the gate response when the gate fails', async () => {
    mockGate.mockResolvedValue(gateFail(401) as any);

    const res = await DELETE(makeReq('DELETE'), ctx());
    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('passes creator.id + tokenCardId to deleteTokenCard on success', async () => {
    mockGate.mockResolvedValue(gateOk);
    mockDelete.mockResolvedValue({ success: true, data: undefined } as any);

    const res = await DELETE(makeReq('DELETE'), ctx('t1'));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith('c1', 't1');
  });

  it('maps "not found" errors to 404', async () => {
    mockGate.mockResolvedValue(gateOk);
    mockDelete.mockResolvedValue({ success: false, error: 'Token card not found' } as any);

    const res = await DELETE(makeReq('DELETE'), ctx());
    expect(res.status).toBe(404);
  });

  it('maps "not authorized" errors to 403', async () => {
    mockGate.mockResolvedValue(gateOk);
    mockDelete.mockResolvedValue({ success: false, error: 'Not authorized to delete this token card' } as any);

    const res = await DELETE(makeReq('DELETE'), ctx());
    expect(res.status).toBe(403);
  });
});
