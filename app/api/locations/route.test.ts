/**
 * Unit tests for POST /api/locations — MCP/OAuth callers must be accepted.
 *
 * OAuth bearer auth is opt-in per route ({ allowOAuth: true } third arg —
 * see lib/auth/CLAUDE.md). The create_event MCP tool calls this route with
 * a bearer token, so the opt-in is part of the route's contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  locationService: {
    browseLocations: vi.fn(),
    canManageLocation: vi.fn(),
    createLocation: vi.fn(),
  },
}));

vi.mock('@/lib/auth/multi-auth', () => ({
  authenticateRequest: vi.fn(),
}));

import { POST } from './route';
import { locationService } from '@/lib/services';
import { authenticateRequest } from '@/lib/auth/multi-auth';

const mockAuth = vi.mocked(authenticateRequest);
const mockCanManage = vi.mocked(locationService.canManageLocation);
const mockCreate = vi.mocked(locationService.createLocation);

const makeRequest = () =>
  new NextRequest('http://localhost/api/locations', {
    method: 'POST',
    body: JSON.stringify({ name: 'Venue', addressLine1: '1 St', addressCity: 'City', addressCountry: 'US' }),
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ success: true, userId: 'admin-1' } as any);
  mockCanManage.mockResolvedValue({ success: true, data: true } as any);
  mockCreate.mockResolvedValue({ success: true, data: { id: 'loc-1' } } as any);
});

describe('POST /api/locations auth', () => {
  it('opts into OAuth bearer auth so MCP tools can call it', async () => {
    await POST(makeRequest());

    expect(mockAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ allowOAuth: true })
    );
  });

  it('still returns 401 when authentication fails', async () => {
    mockAuth.mockResolvedValue({ success: false, error: 'nope' } as any);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
  });
});
