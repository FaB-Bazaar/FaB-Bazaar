import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services', () => ({
  oauthFlowService: { isAccessTokenActive: vi.fn() },
  userService: { findById: vi.fn() },
}));

import { authenticatePartner } from './auth';
import { oauthFlowService, userService } from '@/lib/services';
import { signPartnerToken } from '@/lib/oauth/partner-token';

const mockActive = vi.mocked(oauthFlowService.isAccessTokenActive);
const mockUser = vi.mocked(userService.findById);

const BASE_KEY = 'unit-test-base-key';

function request(authorization?: string) {
  return new NextRequest('http://localhost/api/partner/v1/binders', {
    headers: authorization ? { authorization } : {},
  });
}

const accessToken = (scope: string) =>
  signPartnerToken({ userId: 'user-1', clientId: 'mcp_abc', scope, type: 'access_token' });

describe('authenticatePartner', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = BASE_KEY;
  });

  beforeEach(() => {
    mockActive.mockReset();
    mockUser.mockReset();
    mockActive.mockResolvedValue({ success: true, data: true });
    mockUser.mockResolvedValue({ success: true, data: { _id: 'user-1' } } as never);
  });

  it('accepts a partner access token that carries the required scope', async () => {
    const bearer = accessToken('collection:read');

    const result = await authenticatePartner(request(`Bearer ${bearer}`), 'collection:read');

    expect(result).toEqual({
      ok: true,
      userId: 'user-1',
      clientId: 'mcp_abc',
      scopes: new Set(['collection:read']),
    });
    expect(mockActive).toHaveBeenCalledWith(bearer);
    expect(mockUser).toHaveBeenCalledWith('user-1');
  });

  it('answers 401 when there is no bearer token', async () => {
    const result = await authenticatePartner(request(), 'collection:read');

    expect(result).toMatchObject({ ok: false, status: 401, code: 'unauthorized' });
    expect(mockActive).not.toHaveBeenCalled();
  });

  it("refuses the app's ordinary tokens — a full-access token is not a partner token", async () => {
    // Signed with the base key, as MCP / legacy "read write" grants are.
    const legacy = jwt.sign(
      { sub: 'user-1', client_id: 'mcp_abc', scope: 'collection:read', type: 'access_token' },
      BASE_KEY,
    );

    const result = await authenticatePartner(request(`Bearer ${legacy}`), 'collection:read');

    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(mockActive).not.toHaveBeenCalled();
  });

  it('refuses a refresh token used as an access token', async () => {
    const refresh = signPartnerToken({
      userId: 'user-1',
      clientId: 'mcp_abc',
      scope: 'collection:read',
      type: 'refresh_token',
    });

    const result = await authenticatePartner(request(`Bearer ${refresh}`), 'collection:read');

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('refuses a token whose access the user has revoked', async () => {
    mockActive.mockResolvedValue({ success: true, data: false });

    const result = await authenticatePartner(request(`Bearer ${accessToken('collection:read')}`), 'collection:read');

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('refuses when the revocation check itself fails, rather than letting the call through', async () => {
    mockActive.mockResolvedValue({ success: false, error: 'db down' });

    const result = await authenticatePartner(request(`Bearer ${accessToken('collection:read')}`), 'collection:read');

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('refuses a token for a user who no longer exists', async () => {
    mockUser.mockResolvedValue({ success: true, data: null } as never);

    const result = await authenticatePartner(request(`Bearer ${accessToken('collection:read')}`), 'collection:read');

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('refuses opaque and malformed bearer tokens', async () => {
    for (const bearer of ['fab_opaque', 'mcp_abc', 'abc.def.ghi']) {
      expect(await authenticatePartner(request(`Bearer ${bearer}`), 'collection:read')).toMatchObject({
        ok: false,
        status: 401,
      });
    }
  });

  it('answers 403 naming the missing scope when the token lacks it', async () => {
    const result = await authenticatePartner(request(`Bearer ${accessToken('decks:read')}`), 'collection:write');

    expect(result).toMatchObject({ ok: false, status: 403, code: 'insufficient_scope' });
    expect((result as { message: string }).message).toContain('collection:write');
  });
});
