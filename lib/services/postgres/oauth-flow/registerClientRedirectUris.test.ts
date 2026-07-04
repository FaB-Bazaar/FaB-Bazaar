/**
 * Integration tests for dynamic client registration redirect URI validation.
 *
 * Regression: native MCP clients (LM Studio et al.) register loopback-IP
 * callbacks like http://127.0.0.1:33389/mcp-oauth-callback per RFC 8252 §7.3,
 * but validation only allowed the literal hostname "localhost" — killing DCR
 * for every native app. HTTPS and localhost must keep working; plain http on
 * non-loopback hosts must stay rejected.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { oauthClients } from '@/lib/postgres/schema';
import { PostgresOAuthFlowService } from './PostgresOAuthFlowService';

const service = new PostgresOAuthFlowService();

const createdClientIds: string[] = [];

async function register(redirectUri: string) {
  const result = await service.registerClient({
    client_name: 'redirect-uri-test-client',
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: 'none',
  });
  if (result.success) createdClientIds.push(result.data.client_id);
  return result;
}

afterEach(async () => {
  while (createdClientIds.length) {
    const clientId = createdClientIds.pop()!;
    await db.delete(oauthClients).where(eq(oauthClients.clientId, clientId));
  }
});

describe('registerClient redirect URI validation', () => {
  it.each([
    'http://127.0.0.1:33389/mcp-oauth-callback', // LM Studio's actual callback
    'http://127.0.0.1/callback',
    'http://[::1]:8080/callback',
    'http://localhost:1234/callback',
    'https://callback.mistral.ai/v1/integrations_auth/oauth2_callback',
  ])('accepts %s', async (uri) => {
    const result = await register(uri);
    expect(result.success).toBe(true);
  });

  it.each([
    'http://example.com/callback', // plain http on a real host
    'http://192.168.1.10/callback', // LAN IP is not loopback
    'http://localhost.evil.com/callback', // prefix-spoofed hostname
    'not-a-url',
  ])('rejects %s', async (uri) => {
    const result = await register(uri);
    expect(result.success).toBe(false);
  });
});
