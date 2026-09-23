/**
 * Route unit tests for POST /api/user/oauth-clients.
 *
 * Covers:
 *  - Creating a client no longer revokes the user's other clients (one set of
 *    credentials per app). Regression: the route used to delete every existing
 *    client first, silently breaking whichever app held the old credentials.
 *  - The name is trimmed and required, and there's a per-user cap.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({
  oauthService: {
    listClients: vi.fn(),
    createClient: vi.fn(),
    revokeClient: vi.fn(),
  },
}));

// Import AFTER mocks
import { POST } from './route';
import { MAX_CLIENTS_PER_USER, MAX_CLIENT_NAME_LENGTH } from '@/lib/oauth-client-limits';
import { auth } from '@/auth';
import { oauthService } from '@/lib/services';

const mockAuth = vi.mocked(auth);
const mockList = vi.mocked(oauthService.listClients);
const mockCreate = vi.mocked(oauthService.createClient);
const mockRevoke = vi.mocked(oauthService.revokeClient);

function post(body: unknown) {
  return new Request('https://fabbazaar.app/api/user/oauth-clients', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function existingClients(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    client_id: `mcp_${i}`,
    client_name: `App ${i}`,
    created_at: new Date(),
    grant_types: [],
    scope: 'read write',
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as any);
  mockList.mockResolvedValue({ success: true, data: existingClients(1) } as any);
  mockCreate.mockResolvedValue({
    success: true,
    data: {
      client_id: 'mcp_new',
      client_secret: 'secret',
      client_name: 'Muse',
      created_at: new Date('2026-09-23T00:00:00Z'),
      grant_types: [],
      scope: 'read write',
    },
  } as any);
});

describe('POST /api/user/oauth-clients', () => {
  it('creates a client WITHOUT revoking the existing ones', async () => {
    const res = await POST(post({ client_name: 'Muse' }));

    expect(res.status).toBe(201);
    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith('user-1', 'Muse');
  });

  it('trims the name', async () => {
    await POST(post({ client_name: '  Muse  ' }));
    expect(mockCreate).toHaveBeenCalledWith('user-1', 'Muse');
  });

  it('rejects a blank name', async () => {
    const res = await POST(post({ client_name: '   ' }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects an over-long name', async () => {
    const res = await POST(post({ client_name: 'x'.repeat(MAX_CLIENT_NAME_LENGTH + 1) }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('refuses to exceed the per-user cap', async () => {
    mockList.mockResolvedValue({ success: true, data: existingClients(MAX_CLIENTS_PER_USER) } as any);

    const res = await POST(post({ client_name: 'One too many' }));

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('401s when signed out', async () => {
    mockAuth.mockResolvedValue(null as any);
    const res = await POST(post({ client_name: 'Muse' }));
    expect(res.status).toBe(401);
  });
});
