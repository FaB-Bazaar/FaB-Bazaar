import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';

const BASE_KEY = 'unit-test-base-key';

let mod: typeof import('./partner-token');

beforeAll(async () => {
  process.env.JWT_SECRET = BASE_KEY;
  mod = await import('./partner-token');
});

describe('partner tokens', () => {
  it('round-trips an access token', () => {
    const token = mod.signPartnerToken({ userId: 'u-1', clientId: 'c-1', scope: 'decks:read', type: 'access_token' });

    expect(mod.verifyPartnerToken(token)).toMatchObject({
      sub: 'u-1',
      client_id: 'c-1',
      scope: 'decks:read',
      type: 'access_token',
    });
  });

  it('cannot be verified with the key the rest of the app verifies tokens with', () => {
    // This is what confines a partner token to the partner API: every other
    // route verifies bearer tokens against the base key and so rejects it.
    const token = mod.signPartnerToken({ userId: 'u-1', clientId: 'c-1', scope: 'decks:read', type: 'access_token' });

    expect(() => jwt.verify(token, BASE_KEY)).toThrow();
  });

  it('rejects a token signed with the base key, whatever it claims', () => {
    const forged = jwt.sign(
      { sub: 'u-1', client_id: 'c-1', scope: 'decks:read', type: 'access_token', aud: 'fabbazaar-partner-api' },
      BASE_KEY,
    );

    expect(mod.verifyPartnerToken(forged)).toBeNull();
  });

  it('rejects an expired token and garbage', () => {
    const expired = mod.signPartnerToken(
      { userId: 'u-1', clientId: 'c-1', scope: 'decks:read', type: 'access_token' },
      -10,
    );

    expect(mod.verifyPartnerToken(expired)).toBeNull();
    expect(mod.verifyPartnerToken('not.a.token')).toBeNull();
    expect(mod.verifyPartnerToken('')).toBeNull();
  });

  it('gives access tokens an hour and refresh tokens thirty days', () => {
    const access = jwt.decode(
      mod.signPartnerToken({ userId: 'u', clientId: 'c', scope: 'decks:read', type: 'access_token' }),
    ) as { iat: number; exp: number };
    const refresh = jwt.decode(
      mod.signPartnerToken({ userId: 'u', clientId: 'c', scope: 'decks:read', type: 'refresh_token' }),
    ) as { iat: number; exp: number };

    expect(access.exp - access.iat).toBe(3600);
    expect(refresh.exp - refresh.iat).toBe(30 * 24 * 3600);
  });
});
