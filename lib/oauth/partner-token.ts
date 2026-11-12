// Tokens for partner-scoped grants. They are signed with a key DERIVED from the
// app's token key rather than with the key itself, so the rest of the app —
// which verifies bearer tokens against the base key — rejects them. That is
// what keeps a token the user approved for "see your decks" from working on
// any route outside /api/partner/*.
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const AUDIENCE = 'fabbazaar-partner-api';
const LIFETIME_SECONDS = { access_token: 3600, refresh_token: 30 * 24 * 3600 } as const;

export type PartnerTokenType = keyof typeof LIFETIME_SECONDS;

export interface PartnerTokenClaims {
  sub: string;
  client_id: string;
  scope: string;
  type: PartnerTokenType;
}

function partnerKey(): string {
  const base = process.env.JWT_SECRET;
  if (!base) throw new Error('JWT_SECRET is not configured');
  return crypto.createHmac('sha256', base).update('partner-api-token-key-v1').digest('hex');
}

export function signPartnerToken(
  input: { userId: string; clientId: string; scope: string; type: PartnerTokenType },
  expiresInSeconds: number = LIFETIME_SECONDS[input.type],
): string {
  return jwt.sign(
    { sub: input.userId, client_id: input.clientId, scope: input.scope, type: input.type },
    partnerKey(),
    { expiresIn: expiresInSeconds, audience: AUDIENCE },
  );
}

/** The claims of a valid, unexpired partner token; null for anything else. */
export function verifyPartnerToken(token: string): PartnerTokenClaims | null {
  try {
    const claims = jwt.verify(token, partnerKey(), { audience: AUDIENCE });
    if (!claims || typeof claims !== 'object') return null;
    const { sub, client_id, scope, type } = claims as Record<string, unknown>;
    if (typeof sub !== 'string' || typeof client_id !== 'string' || typeof scope !== 'string') return null;
    if (type !== 'access_token' && type !== 'refresh_token') return null;
    return { sub, client_id, scope, type };
  } catch {
    return null;
  }
}
