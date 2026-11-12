/**
 * Integration tests: validateClient only accepts a callback the client registered.
 *
 * Runs against the local Postgres DB. Requires POSTGRES_URL in .env.local.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { inArray } from 'drizzle-orm';
import { db } from '@/lib/postgres/db';
import { oauthClients } from '@/lib/postgres/schema';
import { PostgresOAuthFlowService } from './PostgresOAuthFlowService';

const service = new PostgresOAuthFlowService();
const REGISTERED = 'https://partner.example/callback';

let clientIds: string[] = [];

async function register(redirectUris: string[]): Promise<string> {
  const result = await service.registerClient({
    client_name: 'redirect-uri test client',
    redirect_uris: redirectUris,
    token_endpoint_auth_method: 'none',
  });
  if (!result.success) throw new Error(result.error);
  clientIds.push(result.data.client_id);
  return result.data.client_id;
}

afterEach(async () => {
  if (clientIds.length > 0) {
    await db.delete(oauthClients).where(inArray(oauthClients.clientId, clientIds));
  }
  clientIds = [];
});

describe('validateClient redirect URI check', () => {
  it('refuses any callback for a client that registered none', async () => {
    const clientId = await register([]);

    const result = await service.validateClient(clientId, 'https://evil.example/steal');

    expect(result.success).toBe(false);
  });

  it('accepts exactly the registered callback', async () => {
    const clientId = await register([REGISTERED]);

    expect((await service.validateClient(clientId, REGISTERED)).success).toBe(true);
  });

  it('refuses a callback that differs from the registered one in any way', async () => {
    const clientId = await register([REGISTERED]);

    for (const uri of [
      'https://evil.example/callback',
      `${REGISTERED}/extra`,
      `${REGISTERED}?next=https://evil.example`,
      'https://partner.example.evil.example/callback',
    ]) {
      expect((await service.validateClient(clientId, uri)).success, uri).toBe(false);
    }
  });

  it('still validates a client when no callback is involved (token endpoint, client credentials)', async () => {
    const withNone = await register([]);
    const withOne = await register([REGISTERED]);

    expect((await service.validateClient(withNone)).success).toBe(true);
    expect((await service.validateClient(withOne)).success).toBe(true);
  });
});
