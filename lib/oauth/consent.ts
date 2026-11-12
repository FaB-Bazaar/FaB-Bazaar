// What an OAuth authorization request is asking for, in the terms the consent
// screen shows the user.
//
// Two kinds of grant exist:
//  - "partner": only partner API scopes (lib/partner-api/scopes). The token is
//    confined to /api/partner/* and to those scopes.
//  - "full":    anything else — the legacy "read write" that MCP clients use,
//    or a request mixing in a scope we don't know. Such a token works across
//    the user's whole account, so the user is told exactly that.
import { hasScope, parseScopes, PARTNER_SCOPES, type PartnerScope } from '@/lib/partner-api/scopes';

export type ConsentRequest =
  | { kind: 'partner'; scopes: PartnerScope[]; scope: string }
  | { kind: 'full'; scope: string };

const DEFAULT_SCOPE = 'read write';
const KNOWN: ReadonlySet<string> = new Set(PARTNER_SCOPES);

export function classifyScopeRequest(scopeParam: string | null | undefined): ConsentRequest {
  const parts = (scopeParam ?? '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { kind: 'full', scope: DEFAULT_SCOPE };

  if (parts.every(part => KNOWN.has(part))) {
    const scopes = [...new Set(parts)].sort() as PartnerScope[];
    return { kind: 'partner', scopes, scope: scopes.join(' ') };
  }
  return { kind: 'full', scope: parts.join(' ') };
}

/**
 * Has the user already approved at least this much for the client?
 * `grantedScopeStrings` holds the scope of each live grant; a request is
 * covered by ONE grant, never by adding several together.
 */
export function isCoveredBy(request: ConsentRequest, grantedScopeStrings: string[]): boolean {
  return grantedScopeStrings.some(granted => {
    const earlier = classifyScopeRequest(granted);
    if (earlier.kind === 'full') return true;
    if (request.kind === 'full') return false;
    const have = parseScopes(earlier.scope);
    return request.scopes.every(scope => hasScope(have, scope));
  });
}

const AREAS: Array<{ read: PartnerScope; write?: PartnerScope; readLine: string; writeLine?: string }> = [
  { read: 'cards:read', readLine: 'Search the card catalog' },
  {
    read: 'collection:read',
    write: 'collection:write',
    readLine: 'See your binders and the cards in them',
    writeLine: 'See your binders, and add, change and remove cards in them',
  },
  {
    read: 'decks:read',
    write: 'decks:write',
    readLine: 'See your decks',
    writeLine: 'See your decks, create new ones, and add or remove cards in them',
  },
];

/** The lines the consent screen (and the "apps with access" list) shows. */
export function consentLines(request: ConsentRequest): string[] {
  if (request.kind === 'full') {
    return ['Full access to your account: see and change your collection, decks, wants and lists'];
  }
  const asked = new Set(request.scopes);
  const lines: string[] = [];
  for (const area of AREAS) {
    if (area.write && asked.has(area.write)) lines.push(area.writeLine!);
    else if (asked.has(area.read)) lines.push(area.readLine);
  }
  return lines;
}
