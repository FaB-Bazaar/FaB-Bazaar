/**
 * Integration tests: which bearer tokens the two auth paths accept, with
 * nothing mocked but the browser session.
 *
 *  - the shared auth chain (lib/auth/multi-auth — every non-partner route)
 *  - the partner API's auth (lib/partner-api/auth)
 *
 * A partner-scoped token must work on the partner API only; a full-access
 * token (an MCP host's grant, or the token the hosted chat mints for itself)
 * must work on the shared chain only.
 *
 * Tokens come from the real authorize → token exchange against the local
 * Postgres DB. Requires POSTGRES_URL and JWT_SECRET in .env.local.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { eq, inArray } from 'drizzle-orm';

// No browser session: only the bearer token can authenticate these requests.
vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));

import { db } from '@/lib/postgres/db';
import { users, oauthClients, oauthAccessTokens, oauthAuthorizationCodes } from '@/lib/postgres/schema';
import { authenticateRequest } from '@/lib/auth/multi-auth';
import { oauthFlowService, oauthService } from '@/lib/services';
import { authenticatePartner } from './auth';

const REDIRECT = 'https://partner.example/callback';

let userId: string;
let clientId: string;

function bearerRequest(token: string) {
  return new NextRequest('http://localhost/api/anything', { headers: { authorization: `Bearer ${token}` } });
}

/** The shared chain, as a route that accepts OAuth tokens calls it. */
const sharedChain = (token: string) => authenticateRequest(bearerRequest(token), {}, { allowOAuth: true });
const partnerApi = (token: string) => authenticatePartner(bearerRequest(token), 'decks:read');

/** authorize → token exchange, as after the user clicks Allow. */
async function grant(scope: string) {
  const code = await oauthFlowService.createAuthorizationCode({ clientId, userId, redirectUri: REDIRECT, scope });
  if (!code.success) throw new Error(code.error);
  const tokens = await oauthFlowService.exchangeAuthorizationCode({ code: code.data.code, clientId, redirectUri: REDIRECT });
  if (!tokens.success) throw new Error(tokens.error);
  return tokens.data;
}

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  userId = crypto.randomUUID();
  await db.insert(users).values({ id: userId, username: `test-${userId}` });
  const registered = await oauthFlowService.registerClient({
    client_name: 'token confinement test client',
    redirect_uris: [REDIRECT],
    token_endpoint_auth_method: 'none',
  });
  if (!registered.success) throw new Error(registered.error);
  clientId = registered.data.client_id;
});

afterEach(async () => {
  await db.delete(oauthAccessTokens).where(inArray(oauthAccessTokens.clientId, [clientId]));
  await db.delete(oauthAuthorizationCodes).where(inArray(oauthAuthorizationCodes.clientId, [clientId]));
  await db.delete(oauthClients).where(eq(oauthClients.clientId, clientId));
  await db.delete(users).where(eq(users.id, userId));
});

describe('a partner-scoped grant', () => {
  it('is accepted by the partner API', async () => {
    const tokens = await grant('decks:read collection:read');

    expect(await partnerApi(tokens.access_token)).toMatchObject({ ok: true, userId, clientId });
  });

  it('is refused by the shared auth chain — access token and refresh token alike', async () => {
    const tokens = await grant('decks:read collection:read');

    expect((await sharedChain(tokens.access_token)).success).toBe(false);
    expect((await sharedChain(tokens.refresh_token!)).success).toBe(false);
  });

  it('stays that way after a refresh', async () => {
    const tokens = await grant('decks:read');
    const refreshed = await oauthFlowService.refreshAccessToken(tokens.refresh_token!, clientId);
    if (!refreshed.success) throw new Error(refreshed.error);

    expect(await partnerApi(refreshed.data.access_token)).toMatchObject({ ok: true, userId });
    expect((await sharedChain(refreshed.data.access_token)).success).toBe(false);
    expect((await sharedChain(refreshed.data.refresh_token!)).success).toBe(false);
  });

  it('stops working on the partner API as soon as the user removes the app', async () => {
    const tokens = await grant('decks:read');
    expect(await partnerApi(tokens.access_token)).toMatchObject({ ok: true });

    await oauthService.revokeAppAccess(userId, clientId);

    expect(await partnerApi(tokens.access_token)).toMatchObject({ ok: false, status: 401 });
  });

  it('cannot use its refresh token as an access token on the partner API', async () => {
    const tokens = await grant('decks:read');

    expect(await partnerApi(tokens.refresh_token!)).toMatchObject({ ok: false, status: 401 });
  });
});

describe('a full-access grant (what MCP hosts hold)', () => {
  it('is accepted by the shared auth chain as that user', async () => {
    const tokens = await grant('read write');

    expect(await sharedChain(tokens.access_token)).toMatchObject({ success: true, userId, authMethod: 'oauth' });
  });

  it('is refused by the partner API', async () => {
    const tokens = await grant('read write');

    expect(await partnerApi(tokens.access_token)).toMatchObject({ ok: false, status: 401 });
  });
});

describe("the hosted chat's own token", () => {
  // The chat mints this for its internal tool calls; it never goes through
  // the authorize step and is not stored.
  const mint = () => oauthFlowService.generateAccessToken(userId, 'fabbazaar-hosted', 'read write');

  it('is accepted by the shared auth chain as that user', async () => {
    expect(await sharedChain(mint())).toMatchObject({ success: true, userId, authMethod: 'oauth' });
  });

  it('is refused by the partner API', async () => {
    expect(await partnerApi(mint())).toMatchObject({ ok: false, status: 401 });
  });
});
