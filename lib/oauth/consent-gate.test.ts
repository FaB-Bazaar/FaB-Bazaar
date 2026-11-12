import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({ oauthFlowService: { listGrantedScopes: vi.fn() } }));

import { consentRedirect, signApproval, approvalMatches, APPROVAL_COOKIE, CONSENT_FOR_FULL_ACCESS } from './consent-gate';
import { oauthFlowService } from '@/lib/services';

const mockGranted = vi.mocked(oauthFlowService.listGrantedScopes);

const BASE = 'http://localhost:3000';
const QUERY = {
  client_id: 'mcp_partner',
  redirect_uri: 'https://partner.example/callback',
  response_type: 'code',
  scope: 'collection:read decks:read',
  state: 'xyz',
  code_challenge: 'challenge',
  code_challenge_method: 'S256',
};

function authorizeRequest(over: Record<string, string | undefined> = {}, cookie?: string) {
  const url = new URL('/oauth/authorize', BASE);
  for (const [key, value] of Object.entries({ ...QUERY, ...over })) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return new Request(url, { headers: cookie ? { cookie } : {} });
}

const gate = (req: Request, over: { userId?: string; clientOwnerId?: string } = {}) =>
  consentRedirect(req, { userId: 'user-1', baseUrl: BASE, ...over });

const approvalCookie = (userId: string, over: Record<string, string> = {}) =>
  `other=1; ${APPROVAL_COOKIE}=${signApproval(userId, new URLSearchParams({ ...QUERY, ...over }))}`;

describe('consent gate', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'unit-test-base-key';
  });

  beforeEach(() => {
    mockGranted.mockReset();
    mockGranted.mockResolvedValue({ success: true, data: [] });
  });

  it('sends a first-time partner-scoped request to the consent screen with its parameters', async () => {
    const response = await gate(authorizeRequest());

    const to = new URL(response!.headers.get('location')!);
    expect(to.origin + to.pathname).toBe(`${BASE}/oauth/consent`);
    expect(Object.fromEntries(to.searchParams)).toEqual(QUERY);
    expect(mockGranted).toHaveBeenCalledWith('user-1', 'mcp_partner');
  });

  it('lets the request through when the user already granted this app as much', async () => {
    mockGranted.mockResolvedValue({ success: true, data: ['collection:write decks:read'] });

    expect(await gate(authorizeRequest())).toBeNull();
  });

  it('asks again when the app now wants more than was granted', async () => {
    mockGranted.mockResolvedValue({ success: true, data: ['collection:read'] });

    expect(await gate(authorizeRequest({ scope: 'collection:write' }))).not.toBeNull();
  });

  it("lets the user's own client through without asking", async () => {
    expect(await gate(authorizeRequest(), { clientOwnerId: 'user-1' })).toBeNull();
    expect(await gate(authorizeRequest(), { clientOwnerId: 'someone-else' })).not.toBeNull();
  });

  it('asks when the grant lookup fails, rather than assuming yes', async () => {
    mockGranted.mockResolvedValue({ success: false, error: 'db down' });

    expect(await gate(authorizeRequest())).not.toBeNull();
  });

  describe('full-access requests (the "read write" MCP hosts ask for)', () => {
    it('are asked for consent like any other app', async () => {
      expect(CONSENT_FOR_FULL_ACCESS).toBe(true);
      for (const scope of ['read write', undefined, 'claudeai', 'collection:read write']) {
        const response = await gate(authorizeRequest({ scope }));

        expect(response, String(scope)).not.toBeNull();
        expect(new URL(response!.headers.get('location')!).pathname).toBe('/oauth/consent');
      }
    });

    it('are let through for an app the user already gave full access', async () => {
      mockGranted.mockResolvedValue({ success: true, data: ['read write'] });

      expect(await gate(authorizeRequest({ scope: 'read write' }))).toBeNull();
      expect(await gate(authorizeRequest({ scope: 'claudeai' }))).toBeNull();
    });

    it('are not covered by an earlier limited grant', async () => {
      mockGranted.mockResolvedValue({ success: true, data: ['collection:write decks:write cards:read'] });

      expect(await gate(authorizeRequest({ scope: 'read write' }))).not.toBeNull();
    });

    it("are let through for the user's own client and after an explicit Allow", async () => {
      expect(await gate(authorizeRequest({ scope: 'read write' }), { clientOwnerId: 'user-1' })).toBeNull();
      expect(
        await gate(authorizeRequest({ scope: 'read write' }, approvalCookie('user-1', { scope: 'read write' }))),
      ).toBeNull();
    });
  });

  describe('approval from the consent screen', () => {
    it('lets the request through once the user has just approved exactly this request', async () => {
      expect(await gate(authorizeRequest({}, approvalCookie('user-1')))).toBeNull();
    });

    it('does not accept an approval given by a different user', async () => {
      expect(await gate(authorizeRequest({}, approvalCookie('someone-else')))).not.toBeNull();
    });

    it('does not accept an approval for a different app, scope, callback or PKCE challenge', async () => {
      const changes: Array<Record<string, string>> = [
        { client_id: 'mcp_other' },
        { scope: 'decks:read' },
        { redirect_uri: 'https://evil.example/cb' },
        { code_challenge: 'another' },
      ];
      for (const changed of changes) {
        expect(await gate(authorizeRequest({}, approvalCookie('user-1', changed)))).not.toBeNull();
      }
    });

    it('does not accept a made-up or expired approval', async () => {
      expect(await gate(authorizeRequest({}, `${APPROVAL_COOKIE}=not-a-token`))).not.toBeNull();

      const expired = signApproval('user-1', new URLSearchParams(QUERY), -5);
      expect(approvalMatches(expired, 'user-1', new URLSearchParams(QUERY))).toBe(false);
    });

    it('treats the same scopes in another order as the same request', async () => {
      const cookie = approvalCookie('user-1', { scope: 'decks:read collection:read' });

      expect(await gate(authorizeRequest({}, cookie))).toBeNull();
    });
  });
});
