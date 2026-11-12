import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/services', () => ({ oauthFlowService: { validateClient: vi.fn() } }));

import { POST } from './route';
import { auth } from '@/auth';
import { oauthFlowService } from '@/lib/services';
import { APPROVAL_COOKIE, approvalMatches } from '@/lib/oauth/consent-gate';

const mockSession = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>;
const mockClient = vi.mocked(oauthFlowService.validateClient);

const ORIGIN = 'http://localhost:3000';
const REDIRECT = 'https://partner.example/callback';
const QUERY = {
  client_id: 'mcp_partner',
  redirect_uri: REDIRECT,
  response_type: 'code',
  scope: 'collection:read decks:read',
  state: 'xyz',
  code_challenge: 'challenge',
  code_challenge_method: 'S256',
};

function post(fields: Record<string, string>, headers: Record<string, string> = { origin: ORIGIN }) {
  return new Request(`${ORIGIN}/oauth/consent/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(fields).toString(),
  });
}

const form = (decision: string) => ({ ...QUERY, decision });
const location = (response: Response) => new URL(response.headers.get('location')!);

describe('POST /oauth/consent/decision', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'unit-test-base-key';
  });

  beforeEach(() => {
    mockSession.mockReset();
    mockClient.mockReset();
    vi.stubEnv('AUTH_URL', ORIGIN);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mockSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockClient.mockResolvedValue({
      success: true,
      data: { client_id: 'mcp_partner', client_name: 'Nanza', redirect_uris: [REDIRECT] },
    } as never);
  });

  it('on Allow, records the approval and sends the browser back to the authorize step', async () => {
    const response = await POST(post(form('allow')));

    // 303, so the browser GETs the next page instead of re-POSTing the form.
    expect(response.status).toBe(303);
    const to = location(response);
    expect(to.origin + to.pathname).toBe(`${ORIGIN}/oauth/authorize`);
    expect(Object.fromEntries(to.searchParams)).toEqual(QUERY);

    const cookie = response.headers.get('set-cookie')!;
    expect(cookie).toContain(`${APPROVAL_COOKIE}=`);
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
    expect(cookie).toContain('Path=/oauth/authorize');
    const value = cookie.split(';')[0].split('=').slice(1).join('=');
    expect(approvalMatches(decodeURIComponent(value), 'user-1', new URLSearchParams(QUERY))).toBe(true);
  });

  it('issues no code itself', async () => {
    const response = await POST(post(form('allow')));

    expect(location(response).searchParams.get('code')).toBeNull();
  });

  it('on Deny, sends the app an access_denied error and records nothing', async () => {
    const response = await POST(post(form('deny')));

    expect(response.status).toBe(303);
    const to = location(response);
    expect(to.origin + to.pathname).toBe(REDIRECT);
    expect(to.searchParams.get('error')).toBe('access_denied');
    expect(to.searchParams.get('state')).toBe('xyz');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('treats anything other than an explicit allow as a denial', async () => {
    const response = await POST(post(form('maybe')));

    expect(location(response).searchParams.get('error')).toBe('access_denied');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('refuses a form posted from another site or with no origin', async () => {
    const cases: Array<Record<string, string>> = [{ origin: 'https://evil.example' }, {}];
    for (const headers of cases) {
      const response = await POST(post(form('allow'), headers));

      expect(location(response).pathname).toBe('/oauth/error');
      expect(response.headers.get('set-cookie')).toBeNull();
    }
    expect(mockClient).not.toHaveBeenCalled();
  });

  it('never redirects to a callback the client has not registered', async () => {
    mockClient.mockResolvedValue({ success: false, error: 'Invalid redirect_uri' });

    const response = await POST(post({ ...form('deny'), redirect_uri: 'https://evil.example/steal' }));

    expect(mockClient).toHaveBeenCalledWith('mcp_partner', 'https://evil.example/steal');
    expect(location(response).origin).toBe(ORIGIN);
    expect(location(response).pathname).toBe('/oauth/error');
  });

  it('records nothing when the user is not signed in', async () => {
    mockSession.mockResolvedValue(null);

    const response = await POST(post(form('allow')));

    expect(response.headers.get('set-cookie')).toBeNull();
    // Back to the authorize step, which owns the sign-in redirect.
    expect(location(response).pathname).toBe('/oauth/authorize');
  });
});
