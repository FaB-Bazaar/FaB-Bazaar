import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({
  oauthFlowService: {
    validateClient: vi.fn(),
    createAuthorizationCode: vi.fn(),
    listGrantedScopes: vi.fn(),
  },
}));

import { GET } from './route';
import { auth } from '@/auth';
import { oauthFlowService } from '@/lib/services';
import { APPROVAL_COOKIE, signApproval } from '@/lib/oauth/consent-gate';

const mockSession = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
const mockClient = vi.mocked(oauthFlowService.validateClient);
const mockCode = vi.mocked(oauthFlowService.createAuthorizationCode);
const mockGranted = vi.mocked(oauthFlowService.listGrantedScopes);

const ORIGIN = 'http://localhost:3000';
const REDIRECT = 'https://partner.example/callback';
const QUERY = {
  client_id: 'mcp_client',
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: 'read write',
  state: 'xyz',
  code_challenge: 'challenge',
  code_challenge_method: 'S256',
};

function get(over: Record<string, string | undefined> = {}, cookie?: string) {
  const url = new URL('/oauth/authorize', ORIGIN);
  for (const [key, value] of Object.entries({ ...QUERY, ...over })) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return new Request(url, { headers: cookie ? { cookie } : {} });
}

const location = (response: Response) => new URL(response.headers.get('location')!);

describe('GET /oauth/authorize', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'unit-test-base-key';
  });

  beforeEach(() => {
    for (const m of [mockSession, mockClient, mockCode, mockGranted]) m.mockReset();
    vi.stubEnv('AUTH_URL', ORIGIN);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mockSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockGranted.mockResolvedValue({ success: true, data: [] });
    mockCode.mockResolvedValue({ success: true, data: { code: 'auth_code', expiresAt: new Date() } });
    mockClient.mockResolvedValue({
      success: true,
      data: {
        client_id: 'mcp_client',
        client_name: 'Some app',
        redirect_uris: [REDIRECT],
        token_endpoint_auth_method: 'none',
      },
    } as never);
  });

  describe('full-access requests', () => {
    // An app the user has already given full access is not asked again.
    const alreadyGranted = () => mockGranted.mockResolvedValue({ success: true, data: ['read write'] });

    it('goes to the consent screen the first time an app asks', async () => {
      const response = await GET(get());

      expect(location(response).pathname).toBe('/oauth/consent');
      expect(mockCode).not.toHaveBeenCalled();
    });

    it('issues a code straight away for an app the user already authorized', async () => {
      alreadyGranted();

      const response = await GET(get());

      expect(mockCode).toHaveBeenCalledWith({
        clientId: 'mcp_client',
        userId: 'user-1',
        redirectUri: REDIRECT,
        scope: 'read write',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
      });
      const to = location(response);
      expect(to.origin + to.pathname).toBe(REDIRECT);
      expect(to.searchParams.get('code')).toBe('auth_code');
      expect(to.searchParams.get('state')).toBe('xyz');
    });

    it('defaults a missing scope to "read write"', async () => {
      alreadyGranted();

      await GET(get({ scope: undefined }));

      expect(mockCode).toHaveBeenCalledWith(expect.objectContaining({ scope: 'read write' }));
    });

    it('sends a signed-out user to sign in, returning to this request afterwards', async () => {
      mockSession.mockResolvedValue(null);

      const response = await GET(get());

      const to = location(response);
      expect(to.pathname).toBe('/api/auth/signin');
      expect(to.searchParams.get('callbackUrl')).toContain('/oauth/authorize?client_id=mcp_client');
      expect(mockCode).not.toHaveBeenCalled();
    });

    it('rejects an unknown client, a missing client_id, and a response type other than code', async () => {
      mockClient.mockResolvedValueOnce({ success: false, error: 'Client not found' });
      expect(location(await GET(get())).searchParams.get('error')).toBe('invalid_client');

      expect(location(await GET(get({ client_id: undefined }))).searchParams.get('error')).toBe('invalid_request');
      expect(location(await GET(get({ response_type: 'token' }))).searchParams.get('error')).toBe(
        'unsupported_response_type',
      );
      expect(mockCode).not.toHaveBeenCalled();
    });

    it('requires PKCE from a public client', async () => {
      const response = await GET(get({ code_challenge: undefined }));

      expect(location(response).pathname).toBe('/oauth/error');
      expect(mockCode).not.toHaveBeenCalled();
    });
  });

  describe('partner-scoped requests need consent', () => {
    const partner = { scope: 'collection:read decks:read' };

    it('goes to the consent screen instead of issuing a code', async () => {
      const response = await GET(get(partner));

      const to = location(response);
      expect(to.origin + to.pathname).toBe(`${ORIGIN}/oauth/consent`);
      expect(to.searchParams.get('scope')).toBe('collection:read decks:read');
      expect(mockCode).not.toHaveBeenCalled();
    });

    it('issues the code once the user has approved on the consent screen', async () => {
      const cookie = `${APPROVAL_COOKIE}=${signApproval('user-1', new URLSearchParams({ ...QUERY, ...partner }))}`;

      const response = await GET(get(partner, cookie));

      expect(mockCode).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', scope: 'collection:read decks:read' }),
      );
      expect(location(response).searchParams.get('code')).toBe('auth_code');
    });

    it('issues the code without a screen when the user already granted this app as much', async () => {
      mockGranted.mockResolvedValue({ success: true, data: ['collection:write decks:read'] });

      const response = await GET(get(partner));

      expect(location(response).searchParams.get('code')).toBe('auth_code');
    });

    it('still checks sign-in before anything else', async () => {
      mockSession.mockResolvedValue(null);

      const response = await GET(get(partner));

      expect(location(response).pathname).toBe('/api/auth/signin');
      expect(mockGranted).not.toHaveBeenCalled();
    });
  });
});
