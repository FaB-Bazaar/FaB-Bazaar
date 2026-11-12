// Partner API scopes. A token's `scope` claim is a space-separated list;
// only the names below mean anything on /api/partner/*. The legacy
// "read" / "write" scopes that MCP clients carry grant nothing here.

export const PARTNER_SCOPES = [
  'cards:read',
  'collection:read',
  'collection:write',
  'decks:read',
  'decks:write',
] as const;

export type PartnerScope = (typeof PARTNER_SCOPES)[number];

const KNOWN: ReadonlySet<string> = new Set(PARTNER_SCOPES);

export function parseScopes(claim: string | undefined | null): Set<PartnerScope> {
  const granted = new Set<PartnerScope>();
  for (const part of (claim ?? '').split(/\s+/)) {
    if (KNOWN.has(part)) granted.add(part as PartnerScope);
  }
  return granted;
}

/** A `:write` scope also satisfies the same resource's `:read`. */
export function hasScope(granted: ReadonlySet<PartnerScope>, required: PartnerScope): boolean {
  if (granted.has(required)) return true;
  const [resource, action] = required.split(':');
  return action === 'read' && granted.has(`${resource}:write` as PartnerScope);
}
