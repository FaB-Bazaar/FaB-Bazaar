/**
 * Integration tests: apps a user has authorized (consent grants).
 *
 * Covers:
 *  - a partner-scoped grant issues tokens the rest of the app cannot verify,
 *    and they keep that property across a refresh
 *  - a legacy "read write" grant issues the same tokens as before
 *  - listGrantedScopes / isAccessTokenActive — what the consent screen and the
 *    partner API read
 *  - listAuthorizedApps / revokeAppAccess — what the profile page uses; revoking
 *    removes ONE user's access and leaves the shared client and other users alone
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, oauthClients, oauthAccessTokens, oauthAuthorizationCodes } from '@/lib/postgres/schema';
import { verifyPartnerToken } from '@/lib/oauth/partner-token';
import { PostgresOAuthService } from './PostgresOAuthService';
import { PostgresOAuthFlowService } from '../oauth-flow/PostgresOAuthFlowService';

const oauthService = new PostgresOAuthService();
const flowService = new PostgresOAuthFlowService();

const REDIRECT = 'https://partner.example/callback';

let userId: string;
let otherUserId: string;
let clientIds: string[];

/** A shared (not user-owned) public client, as a partner registers one. */
async function registerPartnerClient(name = 'Partner App'): Promise<string> {
  const result = await flowService.registerClient({
    client_name: name,
    redirect_uris: [REDIRECT],
    token_endpoint_auth_method: 'none',
    client_uri: 'https://partner.example',
  });
  if (!result.success) throw new Error(result.error);
  clientIds.push(result.data.client_id);
  return result.data.client_id;
}

/** Runs the authorize → token exchange for a user, as after they click Allow. */
async function grant(clientId: string, forUser: string, scope: string) {
  const code = await flowService.createAuthorizationCode({ clientId, userId: forUser, redirectUri: REDIRECT, scope });
  if (!code.success) throw new Error(code.error);
  const tokens = await flowService.exchangeAuthorizationCode({ code: code.data.code, clientId, redirectUri: REDIRECT });
  if (!tokens.success) throw new Error(tokens.error);
  return tokens.data;
}

beforeEach(async () => {
  userId = crypto.randomUUID();
  otherUserId = crypto.randomUUID();
  clientIds = [];
  await db.insert(users).values([
    { id: userId, username: `test-${userId}` },
    { id: otherUserId, username: `test-${otherUserId}` },
  ]);
});

afterEach(async () => {
  if (clientIds.length > 0) {
    await db.delete(oauthAccessTokens).where(inArray(oauthAccessTokens.clientId, clientIds));
    await db.delete(oauthAuthorizationCodes).where(inArray(oauthAuthorizationCodes.clientId, clientIds));
    await db.delete(oauthClients).where(inArray(oauthClients.clientId, clientIds));
  }
  await db.delete(oauthClients).where(inArray(oauthClients.userId, [userId, otherUserId]));
  await db.delete(users).where(inArray(users.id, [userId, otherUserId]));
});

describe('partner-scoped grants', () => {
  it('issues tokens only the partner API can verify', async () => {
    const clientId = await registerPartnerClient();

    const tokens = await grant(clientId, userId, 'collection:read decks:read');

    expect(tokens.scope).toBe('collection:read decks:read');
    expect(verifyPartnerToken(tokens.access_token)).toMatchObject({
      sub: userId,
      client_id: clientId,
      scope: 'collection:read decks:read',
      type: 'access_token',
    });
    // The key every other route verifies with must reject both tokens.
    expect(() => jwt.verify(tokens.access_token, process.env.JWT_SECRET!)).toThrow();
    expect(() => jwt.verify(tokens.refresh_token!, process.env.JWT_SECRET!)).toThrow();
  });

  it('keeps the tokens confined after a refresh', async () => {
    const clientId = await registerPartnerClient();
    const tokens = await grant(clientId, userId, 'decks:read');

    const refreshed = await flowService.refreshAccessToken(tokens.refresh_token!, clientId);

    expect(refreshed.success).toBe(true);
    if (!refreshed.success) return;
    expect(verifyPartnerToken(refreshed.data.access_token)).toMatchObject({ sub: userId, scope: 'decks:read' });
    expect(() => jwt.verify(refreshed.data.access_token, process.env.JWT_SECRET!)).toThrow();
  });

  it('leaves a legacy "read write" grant exactly as it was', async () => {
    const clientId = await registerPartnerClient('Legacy MCP client');

    const tokens = await grant(clientId, userId, 'read write');

    expect(jwt.verify(tokens.access_token, process.env.JWT_SECRET!)).toMatchObject({
      sub: userId,
      scope: 'read write',
      type: 'access_token',
    });
    expect(verifyPartnerToken(tokens.access_token)).toBeNull();
    const refreshed = await flowService.refreshAccessToken(tokens.refresh_token!, clientId);
    expect(refreshed.success).toBe(true);
  });
});

describe('listGrantedScopes', () => {
  it("returns the scope of each live grant for this user and client only", async () => {
    const clientId = await registerPartnerClient();
    const otherClient = await registerPartnerClient('Other App');
    await grant(clientId, userId, 'decks:read');
    await grant(clientId, userId, 'collection:write');
    await grant(clientId, otherUserId, 'cards:read');
    await grant(otherClient, userId, 'read write');

    const result = await flowService.listGrantedScopes(userId, clientId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sort()).toEqual(['collection:write', 'decks:read']);
  });

  it('ignores a grant whose tokens have all expired', async () => {
    const clientId = await registerPartnerClient();
    await grant(clientId, userId, 'decks:read');
    const past = new Date(Date.now() - 1000);
    await db
      .update(oauthAccessTokens)
      .set({ expiresAt: past, refreshTokenExpiresAt: past })
      .where(eq(oauthAccessTokens.clientId, clientId));

    const result = await flowService.listGrantedScopes(userId, clientId);

    expect(result).toEqual({ success: true, data: [] });
  });
});

describe('isAccessTokenActive', () => {
  it('is true for an issued token and false once access is revoked', async () => {
    const clientId = await registerPartnerClient();
    const tokens = await grant(clientId, userId, 'decks:read');

    expect(await flowService.isAccessTokenActive(tokens.access_token)).toEqual({ success: true, data: true });

    await oauthService.revokeAppAccess(userId, clientId);

    expect(await flowService.isAccessTokenActive(tokens.access_token)).toEqual({ success: true, data: false });
  });

  it('is false for a token we never issued', async () => {
    expect(await flowService.isAccessTokenActive('never-issued')).toEqual({ success: true, data: false });
  });
});

describe('listAuthorizedApps', () => {
  it('lists each app once with what it was granted', async () => {
    const clientId = await registerPartnerClient('Nanza');
    await grant(clientId, userId, 'decks:read');
    await grant(clientId, userId, 'collection:write');
    await grant(clientId, otherUserId, 'cards:read');

    const result = await oauthService.listAuthorizedApps(userId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      client_id: clientId,
      client_name: 'Nanza',
      client_uri: 'https://partner.example',
    });
    expect([...result.data[0].scopes].sort()).toEqual(['collection:write', 'decks:read']);
    expect(result.data[0].authorized_at).toBeInstanceOf(Date);
  });

  it('lists nothing for a user who authorized nothing', async () => {
    await registerPartnerClient();

    expect(await oauthService.listAuthorizedApps(userId)).toEqual({ success: true, data: [] });
  });
});

describe('revokeAppAccess', () => {
  it("removes this user's tokens and pending codes but not the app or other users", async () => {
    const clientId = await registerPartnerClient();
    const mine = await grant(clientId, userId, 'decks:read');
    const theirs = await grant(clientId, otherUserId, 'decks:read');
    await flowService.createAuthorizationCode({ clientId, userId, redirectUri: REDIRECT, scope: 'decks:read' });

    const result = await oauthService.revokeAppAccess(userId, clientId);

    expect(result.success).toBe(true);
    expect((await oauthService.listAuthorizedApps(userId)).success && (await oauthService.listAuthorizedApps(userId))).toMatchObject({ data: [] });
    const myCodes = await db
      .select()
      .from(oauthAuthorizationCodes)
      .where(eq(oauthAuthorizationCodes.userId, userId));
    expect(myCodes).toHaveLength(0);

    // My refresh token is dead; theirs still works, and the client still exists.
    expect((await flowService.refreshAccessToken(mine.refresh_token!, clientId)).success).toBe(false);
    expect((await flowService.refreshAccessToken(theirs.refresh_token!, clientId)).success).toBe(true);
    expect(await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId))).toHaveLength(1);
  });

  it('reports not found when the user has no access to revoke', async () => {
    const clientId = await registerPartnerClient();

    const result = await oauthService.revokeAppAccess(userId, clientId);

    expect(result.success).toBe(false);
  });
});
