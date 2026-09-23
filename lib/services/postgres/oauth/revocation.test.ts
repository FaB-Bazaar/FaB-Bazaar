/**
 * Integration tests: revoking a personal OAuth client cuts off its access.
 *
 * Covers:
 *  - revokeClient deletes the client's tokens and pending authorization codes,
 *    and leaves the user's OTHER clients' tokens alone.
 *  - refreshAccessToken refuses a refresh token whose client no longer exists.
 *    Regression: oauth_access_tokens has no FK to oauth_clients, so tokens
 *    outlived their client and kept refreshing for up to 30 days after
 *    "Revoke" (seen on prod: a deleted client's token refreshed with 200).
 *  - Several personal clients can coexist (one per app).
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import {
  users,
  oauthClients,
  oauthAccessTokens,
  oauthAuthorizationCodes,
} from '@/lib/postgres/schema';
import { PostgresOAuthService } from './PostgresOAuthService';
import { PostgresOAuthFlowService } from '../oauth-flow/PostgresOAuthFlowService';

const oauthService = new PostgresOAuthService();
const flowService = new PostgresOAuthFlowService();

let testUserId: string;
let clientIds: string[];

async function createClient(name: string): Promise<string> {
  const result = await oauthService.createClient(testUserId, name);
  if (!result.success) throw new Error(result.error);
  clientIds.push(result.data.client_id);
  return result.data.client_id;
}

async function insertToken(clientId: string): Promise<string> {
  const refreshToken = flowService.generateRefreshToken(testUserId, clientId, 'read write');
  await db.insert(oauthAccessTokens).values({
    id: crypto.randomUUID(),
    accessToken: flowService.generateAccessToken(testUserId, clientId, 'read write'),
    tokenType: 'Bearer',
    clientId,
    userId: testUserId,
    scope: 'read write',
    expiresAt: new Date(Date.now() + 3600 * 1000),
    refreshToken,
    refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  });
  return refreshToken;
}

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  clientIds = [];
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  if (clientIds.length > 0) {
    await db.delete(oauthAccessTokens).where(inArray(oauthAccessTokens.clientId, clientIds));
    await db.delete(oauthAuthorizationCodes).where(inArray(oauthAuthorizationCodes.clientId, clientIds));
  }
  await db.delete(oauthClients).where(eq(oauthClients.userId, testUserId));
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('personal OAuth client revocation', () => {
  it('keeps several personal clients side by side', async () => {
    await createClient('Muse');
    await createClient('claude.ai');

    const result = await oauthService.listClients(testUserId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map(c => c.client_name).sort()).toEqual(['Muse', 'claude.ai']);
  });

  it('revokeClient deletes that client\'s tokens and codes, not other clients\'', async () => {
    const revoked = await createClient('Muse');
    const kept = await createClient('claude.ai');
    await insertToken(revoked);
    await insertToken(kept);
    await db.insert(oauthAuthorizationCodes).values({
      id: crypto.randomUUID(),
      code: `code-${crypto.randomUUID()}`,
      clientId: revoked,
      userId: testUserId,
      redirectUri: 'https://agent.meta.ai/api/hatch/oauth/callback',
      scope: 'read write',
      expiresAt: new Date(Date.now() + 600 * 1000),
    });

    const result = await oauthService.revokeClient(testUserId, revoked);
    expect(result.success).toBe(true);

    const revokedTokens = await db.select().from(oauthAccessTokens).where(eq(oauthAccessTokens.clientId, revoked));
    const revokedCodes = await db.select().from(oauthAuthorizationCodes).where(eq(oauthAuthorizationCodes.clientId, revoked));
    const keptTokens = await db.select().from(oauthAccessTokens).where(eq(oauthAccessTokens.clientId, kept));
    expect(revokedTokens).toHaveLength(0);
    expect(revokedCodes).toHaveLength(0);
    expect(keptTokens).toHaveLength(1);
  });

  it('refreshAccessToken refuses a token whose client was deleted', async () => {
    const clientId = await createClient('Muse');
    const refreshToken = await insertToken(clientId);

    // Delete the client row only, leaving the token behind: the shape of the
    // orphaned tokens already on prod.
    await db.delete(oauthClients).where(eq(oauthClients.clientId, clientId));

    const result = await flowService.refreshAccessToken(refreshToken, clientId);
    expect(result.success).toBe(false);
  });

  it('refreshAccessToken still works for a live client', async () => {
    const clientId = await createClient('Muse');
    const refreshToken = await insertToken(clientId);

    const result = await flowService.refreshAccessToken(refreshToken, clientId);
    expect(result.success).toBe(true);
  });
});
