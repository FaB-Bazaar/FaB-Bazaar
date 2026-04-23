/**
 * Unit tests for GET / POST /api/portal/token-cards.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/services', () => ({
  customTokenCardService: {
    listTokenCardsByCreator: vi.fn(),
    createTokenCard: vi.fn(),
  },
}));
vi.mock('@/lib/auth/require-creator', () => ({
  requireCreatorProfile: vi.fn(),
}));

import { GET, POST } from './route';
import { customTokenCardService } from '@/lib/services';
import { requireCreatorProfile } from '@/lib/auth/require-creator';

const mockGate = vi.mocked(requireCreatorProfile);
const mockList = vi.mocked(customTokenCardService.listTokenCardsByCreator);
const mockCreate = vi.mocked(customTokenCardService.createTokenCard);

const makeReq = (method = 'GET', body?: unknown) => new NextRequest('http://localhost/api/portal/token-cards', {
  method,
  ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
});

const gateFail = (status: number) => ({
  success: false as const,
  response: NextResponse.json({ error: 'gate' }, { status }),
});

beforeEach(() => vi.clearAllMocks());

describe('GET /api/portal/token-cards', () => {
  it('forwards the gate response when the gate fails', async () => {
    mockGate.mockResolvedValue(gateFail(401) as any);

    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('scopes listing to the caller creator.id', async () => {
    mockGate.mockResolvedValue({ success: true, userId: 'u1', creator: { id: 'c1' } } as any);
    mockList.mockResolvedValue({ success: true, data: [{ id: 't1' }] } as any);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith('c1');
  });
});

describe('POST /api/portal/token-cards', () => {
  it('passes creator.id + body to createTokenCard and returns 201', async () => {
    mockGate.mockResolvedValue({ success: true, userId: 'u1', creator: { id: 'c1' } } as any);
    mockCreate.mockResolvedValue({ success: true, data: { id: 't1' } } as any);

    const res = await POST(makeReq('POST', { name: 'Ponder Token' }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith('c1', { name: 'Ponder Token' });
  });

  it('returns 400 when the service rejects the input', async () => {
    mockGate.mockResolvedValue({ success: true, userId: 'u1', creator: { id: 'c1' } } as any);
    mockCreate.mockResolvedValue({ success: false, error: 'name is required' } as any);

    const res = await POST(makeReq('POST', {}));
    expect(res.status).toBe(400);
  });
});
