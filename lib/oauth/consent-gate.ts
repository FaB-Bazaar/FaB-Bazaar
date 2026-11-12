// The consent check /oauth/authorize runs once it knows who the user is and
// which client is asking. Kept out of the route so the route itself changes by
// one call.
//
// A request is let through (null) when no screen is needed; otherwise the
// caller gets a redirect to /oauth/consent. After the user clicks Allow there,
// /oauth/consent/decision sets a short-lived approval cookie and sends the
// browser back to /oauth/authorize, which then passes this check and issues
// the code exactly as it always has.
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { oauthFlowService } from '@/lib/services';
import { classifyScopeRequest, isCoveredBy } from './consent';

/**
 * Whether full-access requests ("read write", as MCP hosts ask for) get the
 * consent screen as partner-scoped requests always do. An app the user has
 * already authorized is not asked again while that grant is live.
 */
export const CONSENT_FOR_FULL_ACCESS = true;

export const APPROVAL_COOKIE = 'oauth_consent';
export const APPROVAL_TTL_SECONDS = 120;

const FORWARDED = [
  'client_id',
  'redirect_uri',
  'response_type',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
] as const;

function approvalKey(): string {
  const base = process.env.JWT_SECRET;
  if (!base) throw new Error('JWT_SECRET is not configured');
  return crypto.createHmac('sha256', base).update('oauth-consent-approval-v1').digest('hex');
}

/** What an approval is bound to: this app, this scope, this callback, this PKCE attempt. */
function binding(params: URLSearchParams) {
  return {
    client_id: params.get('client_id') ?? '',
    scope: classifyScopeRequest(params.get('scope')).scope,
    redirect_uri: params.get('redirect_uri') ?? '',
    code_challenge: params.get('code_challenge') ?? '',
  };
}

export function signApproval(
  userId: string,
  params: URLSearchParams,
  ttlSeconds: number = APPROVAL_TTL_SECONDS,
): string {
  return jwt.sign({ sub: userId, ...binding(params) }, approvalKey(), { expiresIn: ttlSeconds });
}

export function approvalMatches(value: string, userId: string, params: URLSearchParams): boolean {
  try {
    const claims = jwt.verify(value, approvalKey());
    if (!claims || typeof claims !== 'object' || claims.sub !== userId) return false;
    const want = binding(params);
    return (Object.keys(want) as Array<keyof typeof want>).every(key => claims[key] === want[key]);
  } catch {
    return false;
  }
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** The request's OAuth parameters, carried from one step of the flow to the next. */
export function forwardParams(target: URL, source: { get(name: string): unknown }): URL {
  for (const key of FORWARDED) {
    const value = source.get(key);
    if (typeof value === 'string' && value !== '') target.searchParams.set(key, value);
  }
  return target;
}

export async function consentRedirect(
  req: Request,
  input: { userId: string; clientOwnerId?: string; baseUrl: string },
): Promise<NextResponse | null> {
  const params = new URL(req.url).searchParams;
  const request = classifyScopeRequest(params.get('scope'));

  if (request.kind === 'full' && !CONSENT_FOR_FULL_ACCESS) return null;

  // The user's own client needs no screen.
  if (input.clientOwnerId && input.clientOwnerId === input.userId) return null;

  // They just clicked Allow for exactly this request.
  const approval = readCookie(req, APPROVAL_COOKIE);
  if (approval && approvalMatches(approval, input.userId, params)) return null;

  // They approved this app for at least this much before. A failed lookup means ask.
  const granted = await oauthFlowService.listGrantedScopes(input.userId, params.get('client_id') ?? '');
  if (granted.success && isCoveredBy(request, granted.data)) return null;

  return NextResponse.redirect(forwardParams(new URL('/oauth/consent', input.baseUrl), params));
}
