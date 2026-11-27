// Partner API authentication: a partner access token (lib/oauth/partner-token)
// that is still on record, for a user who still exists, carrying the scope
// the route needs.
//
// This deliberately does not go through the shared multi-auth chain: partner
// tokens are signed with their own key, so no other bearer token — a session,
// an MCP token, a full-access OAuth token — is accepted here, and a partner
// token is accepted nowhere else.
import type { NextRequest } from 'next/server';
import { oauthFlowService, userService } from '@/lib/services';
import { verifyPartnerToken } from '@/lib/oauth/partner-token';
import { hasScope, parseScopes, type PartnerScope } from './scopes';
import { APP_NOT_APPROVED } from '@/lib/oauth/allowlist';

export type PartnerAuth =
  | { ok: true; userId: string; clientId: string | null; scopes: Set<PartnerScope> }
  | { ok: false; status: 401 | 403; code: 'unauthorized' | 'insufficient_scope' | 'app_not_approved'; message: string };

const UNAUTHORIZED: PartnerAuth = {
  ok: false,
  status: 401,
  code: 'unauthorized',
  message: 'A valid OAuth access token is required.',
};

export async function authenticatePartner(
  request: NextRequest,
  requiredScope: PartnerScope,
): Promise<PartnerAuth> {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return UNAUTHORIZED;
  const bearer = header.slice('Bearer '.length).trim();

  const claims = verifyPartnerToken(bearer);
  if (!claims || claims.type !== 'access_token') return UNAUTHORIZED;

  // Revoked access (or a token rotated away by a refresh) is refused at once,
  // not when the token expires. A failed check refuses too.
  const active = await oauthFlowService.isAccessTokenActive(bearer);
  if (!active.success || !active.data) return UNAUTHORIZED;

  // Only apps on the allow-list (/admin/oauth-apps) may use the partner API;
  // taking an app off cuts it off within a minute (the list's cache).
  const approved = await oauthFlowService.isClientApproved(claims.client_id, 'partner');
  if (!approved.success) return UNAUTHORIZED;
  if (!approved.data) return { ok: false, status: 403, code: 'app_not_approved', message: APP_NOT_APPROVED };

  const user = await userService.findById(claims.sub);
  if (!user.success || !user.data) return UNAUTHORIZED;

  const scopes = parseScopes(claims.scope);
  if (!hasScope(scopes, requiredScope)) {
    return {
      ok: false,
      status: 403,
      code: 'insufficient_scope',
      message: `This token is missing the "${requiredScope}" scope.`,
    };
  }

  return { ok: true, userId: claims.sub, clientId: claims.client_id, scopes };
}
