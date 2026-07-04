/**
 * Integration tests for personal OAuth client creation defaults.
 *
 * Covers:
 *  - createClient registers the callback URLs of all supported MCP chat
 *    clients (Claude, Mistral Le Chat), so pasted credentials work in each.
 *    Regression: clients were minted Claude-only, which made /oauth/authorize
 *    reject Le Chat with invalid_client (Invalid redirect_uri).
 *  - Claude's callback stays first (authorize falls back to redirect_uris[0]
 *    when no redirect_uri is supplied).
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { users, oauthClients } from '@/lib/postgres/schema';
import { PostgresOAuthService } from './PostgresOAuthService';

const service = new PostgresOAuthService();

const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';
const MISTRAL_CALLBACK = 'https://callback.mistral.ai/v1/integrations_auth/oauth2_callback';

let testUserId: string;

beforeEach(async () => {
  testUserId = crypto.randomUUID();
  await db.insert(users).values({ id: testUserId, username: `test-${testUserId}` });
});

afterEach(async () => {
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('createClient redirect_uris defaults', () => {
  it('registers both Claude and Mistral Le Chat callbacks', async () => {
    const result = await service.createClient(testUserId, 'Test MCP Client');
    expect(result.success).toBe(true);
    if (!result.success) return;

    const [row] = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, result.data.client_id));

    expect(row.redirectUris).toContain(CLAUDE_CALLBACK);
    expect(row.redirectUris).toContain(MISTRAL_CALLBACK);
  });

  it('keeps the Claude callback first (redirect_uris[0] fallback)', async () => {
    const result = await service.createClient(testUserId, 'Test MCP Client');
    expect(result.success).toBe(true);
    if (!result.success) return;

    const [row] = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, result.data.client_id));

    expect(row.redirectUris[0]).toBe(CLAUDE_CALLBACK);
  });
});
