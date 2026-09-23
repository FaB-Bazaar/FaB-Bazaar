/**
 * Route unit tests for POST /oauth/token client authentication.
 *
 * Covers:
 *  - client_secret_basic: credentials in an `Authorization: Basic` header are
 *    accepted for every grant. Regression: the route only read client_id /
 *    client_secret from the body, so Meta Muse (which sends Basic, as our
 *    metadata advertises) got 400 "Missing required parameters".
 *  - client_secret_post keeps working (Claude, Mistral send credentials in
 *    the body).
 *  - Header and body naming DIFFERENT clients is rejected.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  oauthFlowService: {
    exchangeAuthorizationCode: vi.fn(),
    generateClientCredentialsToken: vi.fn(),
    refreshAccessToken: vi.fn(),
  },
}));

// Import AFTER mocks
import { POST } from './route';
import { oauthFlowService } from '@/lib/services';

const mockExchange = vi.mocked(oauthFlowService.exchangeAuthorizationCode);
const mockClientCredentials = vi.mocked(oauthFlowService.generateClientCredentialsToken);
const mockRefresh = vi.mocked(oauthFlowService.refreshAccessToken);

const CLIENT_ID = 'mcp_test_client';
const CLIENT_SECRET = 'test-secret';
const REDIRECT_URI = 'https://agent.meta.ai/api/hatch/oauth/callback';
const TOKENS = { access_token: 'at', token_type: 'Bearer', expires_in: 3600 };

function basic(id: string, secret: string) {
  return 'Basic ' + Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString('base64');
}

function tokenRequest(params: Record<string, string>, authorization?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
  if (authorization) headers.authorization = authorization;
  return new Request('https://fabbazaar.app/oauth/token', {
    method: 'POST',
    headers,
    body: new URLSearchParams(params).toString(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExchange.mockResolvedValue({ success: true, data: TOKENS } as any);
  mockClientCredentials.mockResolvedValue({ success: true, data: TOKENS } as any);
  mockRefresh.mockResolvedValue({ success: true, data: TOKENS } as any);
});

describe('POST /oauth/token — authorization_code', () => {
  it('accepts client credentials from an Authorization: Basic header', async () => {
    const res = await POST(tokenRequest(
      { grant_type: 'authorization_code', code: 'abc', redirect_uri: REDIRECT_URI, code_verifier: 'v' },
      basic(CLIENT_ID, CLIENT_SECRET),
    ));

    expect(res.status).toBe(200);
    expect(mockExchange).toHaveBeenCalledWith(expect.objectContaining({
      code: 'abc',
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
      codeVerifier: 'v',
    }));
  });

  it('url-decodes Basic credentials (RFC 6749 §2.3.1)', async () => {
    await POST(tokenRequest(
      { grant_type: 'authorization_code', code: 'abc', redirect_uri: REDIRECT_URI },
      basic('id:with/odd', 's3cr=t+&'),
    ));

    expect(mockExchange).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'id:with/odd',
      clientSecret: 's3cr=t+&',
    }));
  });

  it('still accepts client credentials in the body', async () => {
    const res = await POST(tokenRequest({
      grant_type: 'authorization_code', code: 'abc', redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    }));

    expect(res.status).toBe(200);
    expect(mockExchange).toHaveBeenCalledWith(expect.objectContaining({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    }));
  });

  it('rejects a body client_id that differs from the Basic header', async () => {
    const res = await POST(tokenRequest(
      { grant_type: 'authorization_code', code: 'abc', redirect_uri: REDIRECT_URI, client_id: 'mcp_other' },
      basic(CLIENT_ID, CLIENT_SECRET),
    ));

    expect(res.status).toBe(400);
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it('still 400s when no client_id is supplied anywhere', async () => {
    const res = await POST(tokenRequest(
      { grant_type: 'authorization_code', code: 'abc', redirect_uri: REDIRECT_URI },
    ));

    expect(res.status).toBe(400);
    expect(mockExchange).not.toHaveBeenCalled();
  });
});

describe('POST /oauth/token — client_credentials', () => {
  it('accepts client credentials from an Authorization: Basic header', async () => {
    const res = await POST(tokenRequest({ grant_type: 'client_credentials' }, basic(CLIENT_ID, CLIENT_SECRET)));

    expect(res.status).toBe(200);
    expect(mockClientCredentials).toHaveBeenCalledWith(CLIENT_ID, CLIENT_SECRET, 'read write');
  });
});

describe('POST /oauth/token — refresh_token', () => {
  it('accepts the client_id from an Authorization: Basic header', async () => {
    const res = await POST(tokenRequest(
      { grant_type: 'refresh_token', refresh_token: 'rt' },
      basic(CLIENT_ID, CLIENT_SECRET),
    ));

    expect(res.status).toBe(200);
    expect(mockRefresh).toHaveBeenCalledWith('rt', CLIENT_ID);
  });
});
